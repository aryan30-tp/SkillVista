const express = require("express");
const { Octokit } = require("@octokit/rest");

const auth = require("../middleware/auth");
const User = require("../../models/User");
const Skill = require("../../models/Skill");
const {
  extractImportsFromSource,
  extractSkillsFromRepo,
  aggregateSkillsAcrossRepos,
  normalizePackageName
} = require("../services/skillExtractor");

const router = express.Router();

const MAX_REPOS = 50;
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

const getOctokit = (token) => {
  return new Octokit({ auth: token });
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

    const repoSkillData = [];
    for (const repo of repos) {
      const analysis = await buildRepoAnalysis(octokit, repo);
      const skills = extractSkillsFromRepo({
        dependencies: analysis.dependencies,
        devDependencies: analysis.devDependencies,
        importPackages: analysis.importPackages,
        language: analysis.language
      });

      repoSkillData.push({
        repoName: analysis.fullName,
        skills
      });
    }

    const aggregatedSkills = aggregateSkillsAcrossRepos(repoSkillData);

    const userSkills = [];
    for (const skillEntry of aggregatedSkills) {
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

      userSkills.push({
        skillId: doc._id,
        confidenceScore: skillEntry.confidenceScore,
        detectedInRepos: skillEntry.detectedInRepos
      });
    }

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
