const skillKeywords = require("../data/skillKeywords");

const languageSkillMap = {
  Node: { name: "Node.js", category: "backend", confidence: 0.9 },
  JavaScript: { name: "JavaScript", category: "language", confidence: 0.85 },
  TypeScript: { name: "TypeScript", category: "language", confidence: 0.95 },
  Python: { name: "Python", category: "language", confidence: 0.9 },
  Java: { name: "Java", category: "language", confidence: 0.85 },
  C: { name: "C", category: "language", confidence: 0.85 },
  Go: { name: "Go", category: "language", confidence: 0.85 },
  Rust: { name: "Rust", category: "language", confidence: 0.9 },
  Dart: { name: "Dart", category: "language", confidence: 0.9 },
  Scala: { name: "Scala", category: "language", confidence: 0.9 },
  R: { name: "R", category: "language", confidence: 0.85 },
  Shell: { name: "Shell", category: "language", confidence: 0.8 },
  Lua: { name: "Lua", category: "language", confidence: 0.85 },
  Perl: { name: "Perl", category: "language", confidence: 0.85 },
  PHP: { name: "PHP", category: "language", confidence: 0.85 },
  Ruby: { name: "Ruby", category: "language", confidence: 0.85 },
  Kotlin: { name: "Kotlin", category: "language", confidence: 0.85 },
  Swift: { name: "Swift", category: "language", confidence: 0.85 },
  "C#": { name: "C#", category: "language", confidence: 0.85 },
  "C++": { name: "C++", category: "language", confidence: 0.85 }
};

const NODE_BACKEND_PACKAGES = new Set([
  "express",
  "fastify",
  "koa",
  "hapi",
  "nestjs",
  "@nestjs/core",
  "graphql",
  "apollo-server",
  "mongoose",
  "sequelize",
  "prisma",
  "typeorm",
  "knex"
]);

const IMPORT_REGEX_PATTERNS = [
  /import\s+[^"']+\s+from\s+["']([^"']+)["']/g,
  /import\s*\(["']([^"']+)["']\)/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
  /from\s+["']([^"']+)["']/g
];

const normalizePackageName = (pkg) => {
  if (!pkg || typeof pkg !== "string") {
    return "";
  }

  const trimmed = pkg.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith(".") || trimmed.startsWith("/")) {
    return "";
  }

  // Keep scoped package root only: @scope/name/subpath -> @scope/name
  if (trimmed.startsWith("@")) {
    const parts = trimmed.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}`.toLowerCase() : trimmed.toLowerCase();
  }

  // Non-scoped package root only: lodash/fp -> lodash
  return trimmed.split("/")[0].toLowerCase();
};

const extractImportsFromSource = (sourceCode) => {
  const packages = new Set();

  if (!sourceCode || typeof sourceCode !== "string") {
    return [];
  }

  for (const regex of IMPORT_REGEX_PATTERNS) {
    let match = regex.exec(sourceCode);
    while (match) {
      const normalized = normalizePackageName(match[1]);
      if (normalized) {
        packages.add(normalized);
      }
      match = regex.exec(sourceCode);
    }
    regex.lastIndex = 0;
  }

  return Array.from(packages);
};

const mapKeywordToSkill = (keyword, sourceType = "package") => {
  const key = normalizePackageName(keyword);
  const mapped = skillKeywords[key];

  if (!mapped) {
    return null;
  }

  const sourceMultiplier = sourceType === "import" ? 0.7 : 1;

  return {
    name: mapped.name,
    category: mapped.category,
    confidence: Number((mapped.confidence * sourceMultiplier).toFixed(2)),
    keyword: key,
    sourceType
  };
};

const extractSkillsFromRepo = (repoData) => {
  const extracted = [];
  const seen = new Set();

  const dependencies = repoData.dependencies || [];
  const devDependencies = repoData.devDependencies || [];
  const importPackages = repoData.importPackages || [];

  const addMapped = (value, sourceType) => {
    const skill = mapKeywordToSkill(value, sourceType);
    if (!skill) {
      return;
    }

    const dedupeKey = `${skill.name}:${sourceType}`;
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    extracted.push(skill);
  };

  for (const dep of dependencies) {
    addMapped(dep, "package");
  }

  for (const dep of devDependencies) {
    addMapped(dep, "package");
  }

  for (const pkg of importPackages) {
    addMapped(pkg, "import");
  }

  const allNodePackages = new Set([
    ...dependencies.map((dep) => normalizePackageName(dep)),
    ...devDependencies.map((dep) => normalizePackageName(dep)),
    ...importPackages.map((pkg) => normalizePackageName(pkg))
  ]);

  const hasNodeBackendSignals = Array.from(allNodePackages).some((pkg) =>
    NODE_BACKEND_PACKAGES.has(pkg)
  );

  const hasNodeEcosystem =
    Boolean(repoData.hasPackageJson) ||
    allNodePackages.size > 0 ||
    repoData.language === "JavaScript" ||
    repoData.language === "TypeScript";

  if (hasNodeEcosystem && (hasNodeBackendSignals || repoData.language === "JavaScript" || repoData.language === "TypeScript")) {
    extracted.push({
      name: "Node.js",
      category: "backend",
      confidence: hasNodeBackendSignals ? 0.95 : 0.8,
      keyword: "nodejs",
      sourceType: "runtime"
    });
  }

  if (repoData.language && languageSkillMap[repoData.language]) {
    const languageSkill = languageSkillMap[repoData.language];
    extracted.push({
      ...languageSkill,
      keyword: repoData.language.toLowerCase(),
      sourceType: "language"
    });
  }

  return extracted;
};

const aggregateSkillsAcrossRepos = (repoSkillData) => {
  const aggregate = new Map();

  for (const repo of repoSkillData) {
    const repoName = repo.repoName;

    for (const skill of repo.skills) {
      const key = `${skill.name}:${skill.category}`;
      const existing = aggregate.get(key);

      if (!existing) {
        aggregate.set(key, {
          name: skill.name,
          category: skill.category,
          confidenceScore: skill.confidence,
          sources: new Set([skill.sourceType]),
          detectedInRepos: new Set([repoName])
        });
      } else {
        existing.confidenceScore += skill.confidence;
        existing.sources.add(skill.sourceType);
        existing.detectedInRepos.add(repoName);
      }
    }
  }

  // Normalize confidence score with capped logistic-like scaling.
  const normalized = Array.from(aggregate.values()).map((entry) => {
    const repoCount = entry.detectedInRepos.size;
    const sourceBonus = entry.sources.size * 0.1;
    const normalizedScore = Math.min(
      1,
      Number((entry.confidenceScore / Math.max(1, repoCount) + sourceBonus).toFixed(2))
    );

    return {
      name: entry.name,
      category: entry.category,
      confidenceScore: normalizedScore,
      detectedInRepos: Array.from(entry.detectedInRepos),
      sources: Array.from(entry.sources)
    };
  });

  return normalized.sort((a, b) => b.confidenceScore - a.confidenceScore);
};

module.exports = {
  extractImportsFromSource,
  extractSkillsFromRepo,
  aggregateSkillsAcrossRepos,
  normalizePackageName
};
