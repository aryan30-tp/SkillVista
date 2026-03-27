const express = require("express");
const { Octokit } = require("@octokit/rest");

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
        repoSet: new Set(normalizedRepos)
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

  const edges = Array.from(pairCountMap.entries())
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

      // Blend structural overlap and detection confidence into one stable edge weight.
      const weight = Number(Math.min(1, jaccard * 0.7 + confidenceBlend * 0.3).toFixed(3));

      return {
        id: `edge-${source}-${target}`,
        source,
        target,
        overlapCount,
        weight
      };
    })
    .filter((edge) => edge && edge.weight >= 0.2)
    .sort((a, b) => b.weight - a.weight);

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
      per_page: MAX_REPOS
    });

    const analyses = [];
    for (const repo of repos) {
      const analyzed = await buildRepoAnalysis(octokit, repo);
      analyses.push(analyzed);
    }

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
