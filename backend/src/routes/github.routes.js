const express = require("express");
const { Octokit } = require("@octokit/rest");
const PDFDocument = require("pdfkit");
const jwt = require("jsonwebtoken");

const auth = require("../middleware/auth");
const User = require("../../models/User");
const Skill = require("../../models/Skill");
const skillKeywords = require("../data/skillKeywords");
const manualSkills = require("../data/manualSkills");
const {
  extractImportsFromSource,
  extractSkillsFromRepo,
  aggregateSkillsAcrossRepos,
  normalizePackageName
} = require("../services/skillExtractor");

const router = express.Router();

const MAX_REPOS = 50;
const MAX_PROJECT_REPOS = 20;
const REPO_ANALYSIS_CONCURRENCY = 4;
const SKILL_UPSERT_CONCURRENCY = 8;
const VALID_CATEGORIES = [
  "frontend",
  "backend",
  "database",
  "devops",
  "language",
  "mobile",
  "ai-ml",
  "data-science",
  "cybersecurity",
  "app-development",
  "tool",
  "other"
];
const CODE_FILE_CANDIDATES = [
  "index.js",
  "app.js",
  "server.js",
  "main.js",
  "main.ts",
  "main.tsx",
  "src/index.js",
  "src/index.ts",
  "src/index.tsx",
  "src/app.js",
  "src/app.ts",
  "src/main.js",
  "src/main.ts",
  "src/main.tsx"
];
const MANIFEST_CANDIDATES = [
  "requirements.txt",
  "pyproject.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "backend/requirements.txt",
  "backend/pyproject.toml",
  "backend/pom.xml",
  "backend/build.gradle",
  "backend/build.gradle.kts",
  "server/requirements.txt",
  "server/pyproject.toml",
  "server/pom.xml",
  "server/build.gradle",
  "server/build.gradle.kts",
  "api/requirements.txt",
  "api/pyproject.toml",
  "api/pom.xml",
  "api/build.gradle",
  "api/build.gradle.kts"
];

const getOctokit = (token) => {
  return new Octokit({ auth: token });
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

const CATEGORY_COLORS = {
  frontend: "#2A9D8F",
  backend: "#264653",
  database: "#E9C46A",
  devops: "#F4A261",
  language: "#457B9D",
  mobile: "#00A896",
  "app-development": "#3A86FF",
  "ai-ml": "#FB8500",
  "data-science": "#90BE6D",
  cybersecurity: "#E63946",
  tool: "#6D6875",
  other: "#8D99AE"
};

const buildEdgeKey = (a, b) => {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const COMPLEXITY_BANDS = [
  { min: 80, label: "Advanced" },
  { min: 55, label: "Intermediate" },
  { min: 0, label: "Beginner" }
];

const getComplexityLabel = (score) => {
  const band = COMPLEXITY_BANDS.find((entry) => score >= entry.min);
  return band ? band.label : "Beginner";
};

const calculateComplexityScore = (analysis) => {
  const dependencyCount = (analysis.dependencies || []).length;
  const devDependencyCount = (analysis.devDependencies || []).length;
  const ecosystemDependencyCount = (analysis.ecosystemDependencies || []).length;
  const importCount = (analysis.importPackages || []).length;
  const stars = Number(analysis.stargazersCount || 0);

  const rawScore =
    dependencyCount * 2 +
    devDependencyCount * 1 +
    ecosystemDependencyCount * 2 +
    importCount * 1.5 +
    Math.log10(stars + 1) * 8 +
    (analysis.language ? 8 : 0) +
    (analysis.hasPackageJson ? 6 : 0);

  return Math.round(clamp(rawScore, 5, 100));
};

const buildProjectTechStack = (analysis) => {
  const set = new Set();

  if (analysis.language) {
    set.add(String(analysis.language));
  }

  for (const dep of analysis.dependencies || []) {
    if (set.size >= 8) break;
    set.add(dep);
  }
  for (const dep of analysis.ecosystemDependencies || []) {
    if (set.size >= 8) break;
    set.add(dep);
  }
  for (const dep of analysis.importPackages || []) {
    if (set.size >= 8) break;
    set.add(dep);
  }

  return Array.from(set);
};

const buildConnectedSkillsForProject = (analysis, userSkillMap) => {
  const extracted = extractSkillsFromRepo({
    dependencies: [...(analysis.dependencies || []), ...(analysis.ecosystemDependencies || [])],
    devDependencies: analysis.devDependencies || [],
    importPackages: analysis.importPackages || [],
    language: analysis.language,
    hasPackageJson: analysis.hasPackageJson
  });

  return extracted
    .map((entry) => {
      const found = userSkillMap.get(String(entry.name || "").toLowerCase());
      return {
        name: entry.name,
        category: entry.category,
        confidenceScore: Number(found?.confidenceScore ?? entry.confidenceScore ?? 0)
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 6);
};

const ROLE_BASELINES = {
  "fullstack-developer": [
    "javascript",
    "typescript",
    "react",
    "node.js",
    "express",
    "mongodb",
    "git",
    "docker",
    "aws"
  ],
  "data-scientist": ["python", "pandas", "numpy", "scikit-learn", "tensorflow", "sql", "git"],
  "ml-engineer": [
    "python",
    "tensorflow",
    "pytorch",
    "docker",
    "kubernetes",
    "mlflow",
    "sql"
  ]
};

const buildInsightsPayload = (skills, targetRole = "fullstack-developer") => {
  const normalizedRole = ROLE_BASELINES[targetRole] ? targetRole : "fullstack-developer";
  const baseline = ROLE_BASELINES[normalizedRole];
  const skillSet = new Set(skills.map((entry) => String(entry.name || "").toLowerCase()));

  const missing = baseline.filter((skill) => !skillSet.has(skill));
  const strengths = skills
    .slice()
    .sort((a, b) => Number(b.confidenceScore || 0) - Number(a.confidenceScore || 0))
    .slice(0, 5)
    .map((entry) => ({
      name: entry.name,
      category: entry.category,
      score: Math.round(Number(entry.confidenceScore || 0) * 100)
    }));

  const baselineCoverage = baseline.length ? (baseline.length - missing.length) / baseline.length : 0;
  const averageConfidence =
    skills.length > 0
      ? skills.reduce((sum, entry) => sum + Number(entry.confidenceScore || 0), 0) / skills.length
      : 0;

  const careerReadinessScore = Math.round(clamp((baselineCoverage * 0.7 + averageConfidence * 0.3) * 100, 0, 100));

  const certificationSuggestions = [];
  if (missing.includes("aws") || missing.includes("docker") || missing.includes("kubernetes")) {
    certificationSuggestions.push("AWS Certified Cloud Practitioner");
  }
  if (missing.includes("tensorflow") || missing.includes("pytorch")) {
    certificationSuggestions.push("TensorFlow Developer Certificate");
  }
  if (missing.includes("mongodb") || missing.includes("sql")) {
    certificationSuggestions.push("MongoDB Associate Developer");
  }
  if (certificationSuggestions.length === 0) {
    certificationSuggestions.push("GitHub Foundations", "Google Cloud Digital Leader");
  }

  const suggestedProjects = [
    {
      title: "Role-focused Capstone",
      description: `Build a deployable ${normalizedRole.replace(/-/g, " ")} project using at least 3 missing skills.`,
      skillsToPractice: missing.slice(0, 3)
    },
    {
      title: "Production Pipeline Project",
      description: "Create CI/CD-enabled app with testing, linting, and containerized deployment.",
      skillsToPractice: ["git", "docker", "aws"].filter((skill) => missing.includes(skill))
    }
  ];

  return {
    targetRole: normalizedRole,
    careerReadinessScore,
    skillGapAnalysis: {
      baselineSkills: baseline,
      missingSkills: missing,
      coveragePercentage: Math.round(baselineCoverage * 100)
    },
    suggestedNextSkills: missing.slice(0, 6),
    recommendedCertifications: certificationSuggestions,
    suggestedProjects,
    strengths
  };
};

const buildPublicApiBase = (req) => {
  if (process.env.PUBLIC_API_BASE_URL) {
    return process.env.PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }

  return `${req.protocol}://${req.get("host")}/api`;
};

const resolveUserIdFromRequest = (req) => {
  const authHeader = req.header("Authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  const token = bearerToken || queryToken;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    return decoded.userId || null;
  } catch (_error) {
    return null;
  }
};

const buildResumePayload = (user, skills, insights) => {
  const certifications = Array.isArray(user.certifications) ? user.certifications : [];
  const topSkills = skills
    .slice()
    .sort((a, b) => Number(b.confidenceScore || 0) - Number(a.confidenceScore || 0))
    .slice(0, 12)
    .map((entry) => ({
      name: entry.name,
      category: entry.category,
      confidenceScore: Math.round(Number(entry.confidenceScore || 0) * 100)
    }));

  const summary = `${user.name} is a software practitioner with strengths in ${topSkills
    .slice(0, 3)
    .map((entry) => entry.name)
    .join(", ") || "modern development"}. Current role readiness is ${insights.careerReadinessScore}% for ${
    insights.targetRole
  }.`;

  return {
    basics: {
      name: user.name,
      email: user.email,
      githubUsername: user.githubUsername || null,
      headline: "Software Developer",
      summary
    },
    skills: topSkills,
    certifications: certifications.map((item) => ({
      name: item.name,
      issuer: item.issuer || "",
      issuedAt: item.issuedAt || null,
      credentialUrl: item.credentialUrl || ""
    })),
    insights: {
      careerReadinessScore: insights.careerReadinessScore,
      targetRole: insights.targetRole,
      missingSkills: insights.skillGapAnalysis.missingSkills
    }
  };
};

const buildAtsScore = (resumePayload, insights) => {
  const hasSummary = resumePayload.basics.summary && resumePayload.basics.summary.length >= 40;
  const hasSkills = resumePayload.skills.length >= 6;
  const hasCertifications = resumePayload.certifications.length > 0;
  const roleCoverage = Number(insights.skillGapAnalysis.coveragePercentage || 0);

  let score = 0;
  score += hasSummary ? 20 : 8;
  score += hasSkills ? 30 : Math.min(30, resumePayload.skills.length * 4);
  score += hasCertifications ? 10 : 4;
  score += Math.round(roleCoverage * 0.4);
  score += Math.round((insights.careerReadinessScore || 0) * 0.2);

  const atsScore = Math.round(clamp(score, 0, 100));
  const suggestions = [];
  if (!hasSummary) suggestions.push("Add a concise professional summary with measurable impact.");
  if (!hasSkills) suggestions.push("Include at least 6 role-relevant skills with clear prioritization.");
  if (!hasCertifications) suggestions.push("Add one certification or credential URL to improve trust signals.");
  if (roleCoverage < 70) {
    suggestions.push("Reduce role skill gaps by adding baseline technologies for your target role.");
  }

  return {
    score: atsScore,
    band: atsScore >= 80 ? "Strong" : atsScore >= 60 ? "Moderate" : "Needs Work",
    suggestions
  };
};

const buildResumePdfBuffer = (resumePayload, ats) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 42 });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      doc.fontSize(22).text(resumePayload.basics.name || "Unknown", { underline: false });
      doc.moveDown(0.3);
      doc
        .fontSize(11)
        .fillColor("#333")
        .text(`Email: ${resumePayload.basics.email || "N/A"}`)
        .text(`GitHub: ${resumePayload.basics.githubUsername || "N/A"}`)
        .text(`Target Role: ${resumePayload.insights.targetRole || "N/A"}`)
        .text(`ATS Score: ${ats.score} (${ats.band})`);

      doc.moveDown(0.8);
      doc.fontSize(14).fillColor("#111").text("Professional Summary");
      doc.fontSize(11).fillColor("#333").text(resumePayload.basics.summary || "");

      doc.moveDown(0.8);
      doc.fontSize(14).fillColor("#111").text("Top Skills");
      doc
        .fontSize(11)
        .fillColor("#333")
        .text(
          resumePayload.skills
            .map((item) => `${item.name} (${item.confidenceScore}%)`)
            .join(", ") || "No skills available"
        );

      doc.moveDown(0.8);
      doc.fontSize(14).fillColor("#111").text("Certifications");
      if (!resumePayload.certifications.length) {
        doc.fontSize(11).fillColor("#666").text("No certifications added yet.");
      } else {
        resumePayload.certifications.forEach((item) => {
          doc
            .fontSize(11)
            .fillColor("#333")
            .text(`${item.name} - ${item.issuer || "Issuer not specified"}`);
        });
      }

      doc.moveDown(0.8);
      doc.fontSize(14).fillColor("#111").text("ATS Improvement Suggestions");
      if (!ats.suggestions.length) {
        doc.fontSize(11).fillColor("#333").text("Resume is already ATS-ready for this baseline role.");
      } else {
        ats.suggestions.forEach((item) => {
          doc.fontSize(11).fillColor("#333").text(`- ${item}`);
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const buildAnalyticsPayload = (skills, user) => {
  const categoryMap = new Map();
  const confidenceBuckets = {
    strong: 0,
    medium: 0,
    emerging: 0
  };

  for (const entry of skills) {
    const category = entry.category || "other";
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);

    const score = Number(entry.confidenceScore || 0);
    if (score >= 0.75) {
      confidenceBuckets.strong += 1;
    } else if (score >= 0.45) {
      confidenceBuckets.medium += 1;
    } else {
      confidenceBuckets.emerging += 1;
    }
  }

  const distribution = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const avgConfidence =
    skills.length > 0
      ? skills.reduce((sum, entry) => sum + Number(entry.confidenceScore || 0), 0) / skills.length
      : 0;

  const learningTrend = {
    lastSkillSync: user.lastSkillSync || null,
    repositoryCount: Number(user.repositoryCount || 0),
    totalSkills: skills.length,
    averageConfidence: Number(avgConfidence.toFixed(3))
  };

  return {
    categoryDistribution: distribution,
    confidenceBuckets,
    learningTrend,
    metadata: {
      generatedAt: new Date().toISOString()
    }
  };
};


const buildSkillGraphPayload = (skillList, user) => {
  const repoToSkillsMap = new Map();
  const nodeMeta = new Map();

  const nodes = skillList
    .map((entry) => {
      const id = String(entry._id);
      const repos = Array.isArray(entry.detectedInRepos) ? entry.detectedInRepos : [];
      const normalizedRepos = repos
        .filter((repo) => typeof repo === "string" && repo.trim() && repo !== "manual")
        .map((repo) => repo.trim());

      nodeMeta.set(id, {
        confidenceScore: Number(entry.confidenceScore || 0),
        repoSet: new Set(normalizedRepos),
        name: entry.name,
        category: entry.category,
        keywords: (entry.keywords || [entry.name]).map((k) => String(k).toLowerCase())
      });

      for (const repoName of normalizedRepos) {
        if (!repoToSkillsMap.has(repoName)) {
          repoToSkillsMap.set(repoName, new Set());
        }
        repoToSkillsMap.get(repoName).add(id);
      }

      return {
        id,
        type: "skill",
        name: entry.name,
        category: entry.category,
        confidenceScore: Number(entry.confidenceScore || 0),
        repoCount: normalizedRepos.length,
        color: CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);

  const pairCountMap = new Map();

  for (const skillIdSet of repoToSkillsMap.values()) {
    const skillIds = Array.from(skillIdSet);
    for (let i = 0; i < skillIds.length; i += 1) {
      for (let j = i + 1; j < skillIds.length; j += 1) {
        const key = buildEdgeKey(skillIds[i], skillIds[j]);
        pairCountMap.set(key, (pairCountMap.get(key) || 0) + 1);
      }
    }
  }

  // Build initial edges from repo co-occurrence
  let edgeMap = new Map();
  Array.from(pairCountMap.entries())
    .map(([pairKey, overlapCount]) => {
      const [source, target] = pairKey.split("::");
      const sourceMeta = nodeMeta.get(source);
      const targetMeta = nodeMeta.get(target);
      if (!sourceMeta || !targetMeta) {
        return null;
      }
      const sourceRepoCount = sourceMeta.repoSet.size;
      const targetRepoCount = targetMeta.repoSet.size;
      const union = sourceRepoCount + targetRepoCount - overlapCount;
      const jaccard = union > 0 ? overlapCount / union : 0;
      const confidenceBlend = (sourceMeta.confidenceScore + targetMeta.confidenceScore) / 2;
      const weight = Number(Math.min(1, jaccard * 0.7 + confidenceBlend * 0.3).toFixed(3));
      if (weight >= 0.2) {
        const edgeId = `edge-${source}-${target}`;
        edgeMap.set(edgeId, {
          id: edgeId,
          source,
          target,
          overlapCount,
          weight
        });
      }
      return null;
    });

  // Add edges for manual/added skills using category and keyword matching
  // Weights: category match = 0.25, keyword match = 0.6, both = 0.85
  const skillIds = Array.from(nodeMeta.keys());
  for (let i = 0; i < skillIds.length; i++) {
    const nodeA = nodeMeta.get(skillIds[i]);
    for (let j = i + 1; j < skillIds.length; j++) {
      const nodeB = nodeMeta.get(skillIds[j]);
      if (!nodeA || !nodeB) continue;
      if (skillIds[i] === skillIds[j]) continue;

      let matchCategory = nodeA.category === nodeB.category;
      let keywordsA = new Set(nodeA.keywords || []);
      let keywordsB = new Set(nodeB.keywords || []);
      let sharedKeywords = [...keywordsA].filter((k) => keywordsB.has(k));
      let matchKeyword = sharedKeywords.length > 0;

      let extraWeight = 0;
      if (matchCategory && matchKeyword) {
        extraWeight = 0.85;
      } else if (matchKeyword) {
        extraWeight = 0.6;
      } else if (matchCategory) {
        extraWeight = 0.25;
      }

      if (extraWeight > 0) {
        // Only add if not already present or if this is a higher weight
        const edgeId = `edge-${skillIds[i]}-${skillIds[j]}`;
        const reverseEdgeId = `edge-${skillIds[j]}-${skillIds[i]}`;
        let existing = edgeMap.get(edgeId) || edgeMap.get(reverseEdgeId);
        if (!existing || existing.weight < extraWeight) {
          edgeMap.set(edgeId, {
            id: edgeId,
            source: skillIds[i],
            target: skillIds[j],
            overlapCount: 0,
            weight: extraWeight
          });
        }
      }
    }
  }

  const edges = Array.from(edgeMap.values()).sort((a, b) => b.weight - a.weight);

  const categoryStats = new Map();
  for (const node of nodes) {
    const existing = categoryStats.get(node.category) || {
      count: 0,
      confidenceTotal: 0
    };
    existing.count += 1;
    existing.confidenceTotal += node.confidenceScore;
    categoryStats.set(node.category, existing);
  }

  const clusters = Array.from(categoryStats.entries())
    .map(([category, stats]) => ({
      category,
      nodeCount: stats.count,
      averageConfidence: Number((stats.confidenceTotal / Math.max(1, stats.count)).toFixed(3)),
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS.other
    }))
    .sort((a, b) => b.nodeCount - a.nodeCount);

  return {
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      repositoryCount: Number(user.repositoryCount || 0),
      lastSyncedAt: user.lastSkillSync || null,
      clusters
    }
  };
};

const formatActivityDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const buildDashboardSummary = (user, skillList) => {
  const totalSkills = skillList.length;
  const totalProjects = Number(user.repositoryCount || 0);
  const certifications = Array.isArray(user.certifications) ? user.certifications.length : 0;

  const averageConfidence = totalSkills
    ? skillList.reduce((sum, entry) => sum + Number(entry.confidenceScore || 0), 0) / totalSkills
    : 0;

  const skillStrengthScore = Math.round(averageConfidence * 100);

  // Heuristic baseline readiness score (non-NLP) until target-role model is plugged in.
  const breadthComponent = Math.min(totalSkills / 20, 1);
  const projectComponent = Math.min(totalProjects / 10, 1);
  const certificationComponent = Math.min(certifications / 5, 1);
  const readinessPercentage = Math.round(
    (breadthComponent * 0.35 + projectComponent * 0.3 + averageConfidence * 0.25 + certificationComponent * 0.1) *
      100
  );

  const topSkills = skillList
    .slice()
    .sort((a, b) => Number(b.confidenceScore || 0) - Number(a.confidenceScore || 0))
    .slice(0, 5)
    .map((entry) => ({
      name: entry.name,
      category: entry.category,
      confidenceScore: Number(entry.confidenceScore || 0)
    }));

  const recentActivity = [
    user.lastSkillSync
      ? {
          type: "skill_sync",
          title: "Skills synced from GitHub",
          timestamp: formatActivityDate(user.lastSkillSync)
        }
      : null,
    user.githubId
      ? {
          type: "github_connected",
          title: "GitHub connected",
          timestamp: formatActivityDate(user.updatedAt)
        }
      : null,
    {
      type: "account_created",
      title: "Account created",
      timestamp: formatActivityDate(user.createdAt)
    }
  ]
    .filter(Boolean)
    .sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

  return {
    totals: {
      skills: totalSkills,
      projects: totalProjects,
      certifications
    },
    skillStrengthScore,
    readinessPercentage,
    topSkills,
    recentActivity,
    metadata: {
      calculatedAt: new Date().toISOString(),
      lastSkillSync: formatActivityDate(user.lastSkillSync)
    }
  };
};

const buildSkillOptions = () => {
  const optionsMap = new Map();

  for (const value of Object.values(skillKeywords)) {
    if (!value?.name || !value?.category) {
      continue;
    }

    const key = value.name.toLowerCase();
    if (!optionsMap.has(key)) {
      optionsMap.set(key, {
        name: value.name,
        category: VALID_CATEGORIES.includes(value.category) ? value.category : "other"
      });
    }
  }

  for (const item of manualSkills) {
    if (!item?.name || !item?.category) {
      continue;
    }

    const key = item.name.toLowerCase();
    if (!optionsMap.has(key)) {
      optionsMap.set(key, {
        name: item.name,
        category: VALID_CATEGORIES.includes(item.category) ? item.category : "other"
      });
    }
  }

  return Array.from(optionsMap.values()).sort((a, b) => {
    if (a.category === b.category) {
      return a.name.localeCompare(b.name);
    }
    return a.category.localeCompare(b.category);
  });
};

const fetchPackageJson = async (octokit, owner, repo) => {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: "package.json"
    });

    if (!response.data || Array.isArray(response.data) || !response.data.content) {
      return null;
    }

    const content = Buffer.from(response.data.content, "base64").toString("utf8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

const fetchTextFile = async (octokit, owner, repo, path) => {
  try {
    const response = await octokit.repos.getContent({ owner, repo, path });

    if (!response.data || Array.isArray(response.data) || !response.data.content) {
      return null;
    }

    return Buffer.from(response.data.content, "base64").toString("utf8");
  } catch (error) {
    return null;
  }
};

const parseRequirementToken = (value) => {
  if (!value) {
    return "";
  }

  const cleaned = value.trim();
  if (!cleaned || cleaned.startsWith("#") || cleaned.startsWith("-")) {
    return "";
  }

  const match = cleaned.match(/^([A-Za-z0-9_.-]+)/);
  return normalizePackageName(match ? match[1] : "");
};

const parseRequirementsTxt = (content) => {
  const deps = new Set();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const dep = parseRequirementToken(line);
    if (dep) {
      deps.add(dep);
    }
  }

  return Array.from(deps);
};

const parsePyprojectToml = (content) => {
  const deps = new Set();

  const dependenciesArrayMatches = content.matchAll(/dependencies\s*=\s*\[((?:.|\n)*?)\]/g);
  for (const match of dependenciesArrayMatches) {
    const block = match[1] || "";
    const quotedValues = block.matchAll(/["']([^"']+)["']/g);
    for (const quoted of quotedValues) {
      const dep = parseRequirementToken(quoted[1]);
      if (dep) {
        deps.add(dep);
      }
    }
  }

  const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|$)/);
  if (poetrySection?.[1]) {
    const lines = poetrySection[1].split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/);
      if (!match) {
        continue;
      }
      const pkg = normalizePackageName(match[1]);
      if (pkg && pkg !== "python") {
        deps.add(pkg);
      }
    }
  }

  return Array.from(deps);
};

const parsePomXml = (content) => {
  const deps = new Set();
  const matches = content.matchAll(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/g);

  for (const match of matches) {
    const dep = normalizePackageName(match[1]);
    if (dep) {
      deps.add(dep);
    }
  }

  return Array.from(deps);
};

const parseGradle = (content) => {
  const deps = new Set();
  const pattern =
    /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*(?:\(|\s)\s*["']([^"']+)["']/g;

  let match = pattern.exec(content);
  while (match) {
    const notation = match[1] || "";
    const parts = notation.split(":");
    const artifact = parts.length >= 2 ? parts[1] : parts[0];
    const dep = normalizePackageName(artifact);
    if (dep) {
      deps.add(dep);
    }
    match = pattern.exec(content);
  }

  pattern.lastIndex = 0;
  return Array.from(deps);
};

const fetchEcosystemDependencies = async (octokit, owner, repo) => {
  const deps = new Set();

  for (const manifestPath of MANIFEST_CANDIDATES) {
    const content = await fetchTextFile(octokit, owner, repo, manifestPath);
    if (!content) {
      continue;
    }

    let parsed = [];
    if (manifestPath.endsWith("requirements.txt")) {
      parsed = parseRequirementsTxt(content);
    } else if (manifestPath.endsWith("pyproject.toml")) {
      parsed = parsePyprojectToml(content);
    } else if (manifestPath.endsWith("pom.xml")) {
      parsed = parsePomXml(content);
    } else if (manifestPath.endsWith("build.gradle") || manifestPath.endsWith("build.gradle.kts")) {
      parsed = parseGradle(content);
    }

    for (const dep of parsed) {
      if (dep) {
        deps.add(dep);
      }
    }
  }

  return Array.from(deps);
};

const fetchImportsFromRepo = async (octokit, owner, repo) => {
  const packages = new Set();

  for (const filePath of CODE_FILE_CANDIDATES) {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath
      });

      if (!response.data || Array.isArray(response.data) || !response.data.content) {
        continue;
      }

      const sourceCode = Buffer.from(response.data.content, "base64").toString("utf8");
      const extracted = extractImportsFromSource(sourceCode);
      for (const pkg of extracted) {
        const normalized = normalizePackageName(pkg);
        if (normalized) {
          packages.add(normalized);
        }
      }
    } catch (error) {
      // Ignore missing files and continue scanning likely entry files.
    }
  }

  return Array.from(packages);
};

const buildRepoAnalysis = async (octokit, repo) => {
  const owner = repo.owner?.login;
  const repoName = repo.name;

  const pkg = await fetchPackageJson(octokit, owner, repoName);
  const importPackages = await fetchImportsFromRepo(octokit, owner, repoName);
  const ecosystemDependencies = await fetchEcosystemDependencies(octokit, owner, repoName);

  return {
    id: repo.id,
    name: repoName,
    fullName: repo.full_name,
    private: repo.private,
    htmlUrl: repo.html_url,
    language: repo.language,
    pushedAt: repo.pushed_at,
    stargazersCount: repo.stargazers_count,
    dependencies: pkg ? Object.keys(pkg.dependencies || {}) : [],
    devDependencies: pkg ? Object.keys(pkg.devDependencies || {}) : [],
    ecosystemDependencies,
    importPackages,
    hasPackageJson: Boolean(pkg)
  };
};

router.get("/repos", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.githubAccessToken) {
      return res.status(400).json({ error: "GitHub account not connected" });
    }

    const octokit = getOctokit(user.githubAccessToken);

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      visibility: "all",
      sort: "updated",
      per_page: Math.min(MAX_REPOS, 30)
    });

    const analyses = await mapWithConcurrency(repos, REPO_ANALYSIS_CONCURRENCY, async (repo) => {
      return buildRepoAnalysis(octokit, repo);
    });

    res.json({
      total: analyses.length,
      repos: analyses
    });
  } catch (error) {
    console.error("GitHub repos error:", error.message);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

router.get("/skill-options", auth, async (_req, res) => {
  try {
    const options = buildSkillOptions();
    res.json(options);
  } catch (error) {
    console.error("Skill options error:", error.message);
    res.status(500).json({ error: "Failed to fetch skill options" });
  }
});

router.post("/manual-skill", auth, async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Name and category are required" });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Invalid skill category" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const normalizedName = String(name).trim().toLowerCase();
    if (!normalizedName) {
      return res.status(400).json({ error: "Invalid skill name" });
    }

    const skillDoc = await Skill.findOneAndUpdate(
      { name: normalizedName },
      {
        $setOnInsert: {
          name: normalizedName,
          category,
          keywords: [normalizedName],
          baseConfidence: 0.75
        }
      },
      { new: true, upsert: true }
    );

    const alreadyExists = user.skills.some((entry) => {
      return String(entry.skillId) === String(skillDoc._id);
    });

    if (alreadyExists) {
      return res.json({
        message: "Skill already added",
        existing: true
      });
    }

    user.skills.push({
      skillId: skillDoc._id,
      confidenceScore: 0.75,
      detectedInRepos: ["manual"]
    });

    await user.save();

    return res.json({
      message: "Skill added successfully",
      existing: false,
      skill: {
        _id: skillDoc._id,
        name: skillDoc.name,
        category: skillDoc.category,
        confidenceScore: 0.75,
        detectedInRepos: ["manual"]
      }
    });
  } catch (error) {
    console.error("Add manual skill error:", error.message);
    return res.status(500).json({ error: "Failed to add manual skill" });
  }
});

router.post("/sync-skills", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.githubAccessToken) {
      return res.status(400).json({ error: "GitHub account not connected" });
    }

    user.skillExtractionStatus = "in-progress";
    await user.save();

    const octokit = getOctokit(user.githubAccessToken);

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      visibility: "all",
      sort: "updated",
      per_page: MAX_REPOS
    });

    const repoSkillData = await mapWithConcurrency(
      repos,
      REPO_ANALYSIS_CONCURRENCY,
      async (repo) => {
        const analysis = await buildRepoAnalysis(octokit, repo);
        const skills = extractSkillsFromRepo({
          dependencies: [...analysis.dependencies, ...analysis.ecosystemDependencies],
          devDependencies: analysis.devDependencies,
          importPackages: analysis.importPackages,
          language: analysis.language,
          hasPackageJson: analysis.hasPackageJson
        });

        return {
          repoName: analysis.fullName,
          skills
        };
      }
    );

    const aggregatedSkills = aggregateSkillsAcrossRepos(repoSkillData);

    const skillDocs = await mapWithConcurrency(
      aggregatedSkills,
      SKILL_UPSERT_CONCURRENCY,
      async (skillEntry) => {
        const doc = await Skill.findOneAndUpdate(
          { name: skillEntry.name.toLowerCase() },
          {
            $set: {
              name: skillEntry.name.toLowerCase(),
              category: skillEntry.category,
              keywords: [skillEntry.name.toLowerCase()],
              baseConfidence: skillEntry.confidenceScore
            }
          },
          { new: true, upsert: true }
        );

        return {
          skillId: doc._id,
          confidenceScore: skillEntry.confidenceScore,
          detectedInRepos: skillEntry.detectedInRepos
        };
      }
    );

    const userSkills = skillDocs;

    user.skills = userSkills;
    user.repositoryCount = repos.length;
    user.lastSkillSync = new Date();
    user.skillExtractionStatus = "completed";
    await user.save();

    res.json({
      message: "Skills synced successfully",
      repositoriesAnalyzed: repos.length,
      totalSkills: aggregatedSkills.length,
      skills: aggregatedSkills
    });
  } catch (error) {
    console.error("Skill sync error:", error.message);

    try {
      await User.findByIdAndUpdate(req.userId, {
        skillExtractionStatus: "failed"
      });
    } catch (_e) {
      // no-op
    }

    res.status(500).json({
      error: `Failed to sync skills from GitHub: ${error.message}`
    });
  }
});

router.get("/skills", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("skills.skillId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skillList = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        _id: entry.skillId._id,
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: entry.confidenceScore,
        detectedInRepos: entry.detectedInRepos || []
      }))
      .sort((a, b) => b.confidenceScore - a.confidenceScore);

    res.json(skillList);
  } catch (error) {
    console.error("Get skills error:", error.message);
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

router.get("/projects", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("skills.skillId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.githubAccessToken) {
      return res.status(400).json({ error: "GitHub account not connected" });
    }

    const userSkillMap = new Map(
      user.skills
        .filter((entry) => entry.skillId)
        .map((entry) => [String(entry.skillId.name || "").toLowerCase(), entry])
    );

    const octokit = getOctokit(user.githubAccessToken);
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      visibility: "all",
      sort: "updated",
      per_page: MAX_PROJECT_REPOS
    });

    const analyses = await mapWithConcurrency(repos, REPO_ANALYSIS_CONCURRENCY, async (repo) => {
      return buildRepoAnalysis(octokit, repo);
    });

    const projects = analyses.map((analysis) => {
      const complexityScore = calculateComplexityScore(analysis);
      return {
        id: analysis.id,
        name: analysis.name,
        description: "",
        repositoryUrl: analysis.htmlUrl,
        updatedAt: analysis.pushedAt,
        stars: analysis.stargazersCount,
        techStack: buildProjectTechStack(analysis),
        complexityScore,
        complexityLabel: getComplexityLabel(complexityScore),
        connectedSkills: buildConnectedSkillsForProject(analysis, userSkillMap)
      };
    });

    return res.json({
      total: projects.length,
      projects
    });
  } catch (error) {
    console.error("Get projects error:", error.message);
    return res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/insights", auth, async (req, res) => {
  try {
    const targetRole = typeof req.query.targetRole === "string" ? req.query.targetRole : "fullstack-developer";
    const user = await User.findById(req.userId).populate("skills.skillId");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skills = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: Number(entry.confidenceScore || 0)
      }));

    const payload = buildInsightsPayload(skills, targetRole);
    return res.json(payload);
  } catch (error) {
    console.error("Get insights error:", error.message);
    return res.status(500).json({ error: "Failed to fetch AI insights" });
  }
});

router.get("/resume-portfolio", auth, async (req, res) => {
  try {
    const targetRole = typeof req.query.targetRole === "string" ? req.query.targetRole : "fullstack-developer";
    const user = await User.findById(req.userId).populate("skills.skillId");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skills = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: Number(entry.confidenceScore || 0)
      }));

    const insights = buildInsightsPayload(skills, targetRole);
    const resume = buildResumePayload(user, skills, insights);
    const ats = buildAtsScore(resume, insights);
    const apiBase = buildPublicApiBase(req);
    const username = user.githubUsername || String(user._id);

    return res.json({
      resume,
      ats,
      portfolioLink: `${apiBase}/github/portfolio/${encodeURIComponent(username)}`
    });
  } catch (error) {
    console.error("Get resume portfolio error:", error.message);
    return res.status(500).json({ error: "Failed to generate resume portfolio" });
  }
});

router.get("/resume.pdf", async (req, res) => {
  try {
    const targetRole = typeof req.query.targetRole === "string" ? req.query.targetRole : "fullstack-developer";
    const resolvedUserId = resolveUserIdFromRequest(req);
    if (!resolvedUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(resolvedUserId).populate("skills.skillId");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skills = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: Number(entry.confidenceScore || 0)
      }));

    const insights = buildInsightsPayload(skills, targetRole);
    const resume = buildResumePayload(user, skills, insights);
    const ats = buildAtsScore(resume, insights);
    const pdfBuffer = await buildResumePdfBuffer(resume, ats);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(user.name || "resume").replace(/\s+/g, "-")}-resume.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Get resume pdf error:", error.message);
    return res.status(500).json({ error: "Failed to generate resume PDF" });
  }
});

router.get("/portfolio/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const user = await User.findOne({
      $or: [{ githubUsername: username }, { _id: username.match(/^[a-f\d]{24}$/i) ? username : null }]
    }).populate("skills.skillId");

    if (!user) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const skills = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: Number(entry.confidenceScore || 0)
      }));

    const insights = buildInsightsPayload(skills, "fullstack-developer");
    const resume = buildResumePayload(user, skills, insights);

    return res.json({
      profile: {
        name: user.name,
        githubUsername: user.githubUsername || null
      },
      resume,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Get public portfolio error:", error.message);
    return res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

router.get("/summary", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("skills.skillId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skillList = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        _id: entry.skillId._id,
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: entry.confidenceScore,
        detectedInRepos: entry.detectedInRepos || []
      }));

    const payload = buildDashboardSummary(user, skillList);
    return res.json(payload);
  } catch (error) {
    console.error("Get dashboard summary error:", error.message);
    return res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.get("/analytics", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("skills.skillId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skills = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: Number(entry.confidenceScore || 0),
        detectedInRepos: entry.detectedInRepos || []
      }));

    const payload = buildAnalyticsPayload(skills, user);
    return res.json(payload);
  } catch (error) {
    console.error("Get analytics error:", error.message);
    return res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.get("/skill-graph", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("skills.skillId");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const skillList = user.skills
      .filter((entry) => entry.skillId)
      .map((entry) => ({
        _id: entry.skillId._id,
        name: entry.skillId.name,
        category: entry.skillId.category,
        confidenceScore: entry.confidenceScore,
        detectedInRepos: entry.detectedInRepos || []
      }));

    const payload = buildSkillGraphPayload(skillList, user);
    return res.json(payload);
  } catch (error) {
    console.error("Get skill graph error:", error.message);
    return res.status(500).json({ error: "Failed to build skill graph" });
  }
});

router.get("/orgs", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.githubAccessToken) {
      return res.status(400).json({ error: "GitHub account not connected" });
    }

    const octokit = getOctokit(user.githubAccessToken);
    const { data } = await octokit.orgs.listForAuthenticatedUser({ per_page: 100 });

    res.json(data.map((org) => ({
      id: org.id,
      login: org.login,
      avatarUrl: org.avatar_url,
      url: org.html_url
    })));
  } catch (error) {
    console.error("GitHub orgs error:", error.message);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

module.exports = router;
