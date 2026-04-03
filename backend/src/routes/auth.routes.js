const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { Octokit } = require("@octokit/rest");
const User = require("../../models/User");
const auth = require("../middleware/auth");
const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  MOBILE_REDIRECT_URI,
  hasGitHubConfig
} = require("../config/github");

const router = express.Router();

const DEFAULT_PREFERENCES = {
  themeMode: "light",
  privacyLevel: "private",
  autoSync: false,
  notifications: true
};

const sanitizePreferences = (raw) => {
  const source = raw || {};

  return {
    themeMode: source.themeMode === "dark" ? "dark" : "light",
    privacyLevel: source.privacyLevel === "public" ? "public" : "private",
    autoSync: Boolean(source.autoSync),
    notifications: Boolean(source.notifications)
  };
};

const sanitizeCertificationInput = (raw = {}) => {
  const name = String(raw.name || "").trim();
  const issuer = String(raw.issuer || "").trim();
  const credentialUrl = String(raw.credentialUrl || "").trim();
  const issuedAtRaw = raw.issuedAt ? new Date(raw.issuedAt) : null;

  return {
    name,
    issuer,
    credentialUrl,
    issuedAt: issuedAtRaw && !Number.isNaN(issuedAtRaw.getTime()) ? issuedAtRaw : null
  };
};

const serializeCertifications = (certifications = []) => {
  return certifications.map((item) => ({
    id: String(item._id),
    name: item.name,
    issuer: item.issuer || "",
    issuedAt: item.issuedAt || null,
    credentialUrl: item.credentialUrl || ""
  }));
};

const isAllowedMobileRedirectUri = (uri) => {
  if (!uri || typeof uri !== "string") {
    return false;
  }

  return (
    uri.startsWith("skillvista://") ||
    uri.startsWith("exp://") ||
    uri.startsWith("exps://") ||
    uri.startsWith("https://auth.expo.io/")
  );
};

// Register endpoint
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    // Return user data (without password) and token
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        skillExtractionStatus: user.skillExtractionStatus,
        preferences: sanitizePreferences(user.preferences || DEFAULT_PREFERENCES),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0] || "field";
      return res.status(409).json({
        error: `Duplicate value for ${duplicateField}. Please try again with different credentials.`
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    // Return user data (without password) and token
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        skillExtractionStatus: user.skillExtractionStatus,
        preferences: sanitizePreferences(user.preferences || DEFAULT_PREFERENCES),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user (protected route)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
      skillExtractionStatus: user.skillExtractionStatus,
      preferences: sanitizePreferences(user.preferences || DEFAULT_PREFERENCES),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      repositoryCount: user.repositoryCount,
      lastSkillSync: user.lastSkillSync
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout endpoint (client-side mainly, but we can support token blacklisting later)
router.post("/logout", auth, (req, res) => {
  // For JWT, logout is mainly handled on the client by removing the token
  // In production, you might want to blacklist the token in Redis
  res.json({ message: "Logged out successfully" });
});

router.get("/preferences", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("preferences");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      preferences: sanitizePreferences(user.preferences || DEFAULT_PREFERENCES)
    });
  } catch (error) {
    console.error("Get preferences error:", error.message);
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.put("/preferences", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const current = sanitizePreferences(user.preferences || DEFAULT_PREFERENCES);
    const next = {
      ...current,
      ...(typeof req.body === "object" && req.body ? req.body : {})
    };

    user.preferences = sanitizePreferences(next);
    await user.save();

    return res.json({
      message: "Preferences updated",
      preferences: sanitizePreferences(user.preferences)
    });
  } catch (error) {
    console.error("Update preferences error:", error.message);
    return res.status(500).json({ error: "Failed to update preferences" });
  }
});

router.get("/certifications", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("certifications");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ certifications: serializeCertifications(user.certifications || []) });
  } catch (error) {
    console.error("Get certifications error:", error.message);
    return res.status(500).json({ error: "Failed to fetch certifications" });
  }
});

router.post("/certifications", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const certification = sanitizeCertificationInput(req.body || {});
    if (!certification.name) {
      return res.status(400).json({ error: "Certification name is required" });
    }

    user.certifications.push(certification);
    await user.save();

    return res.status(201).json({
      message: "Certification added",
      certifications: serializeCertifications(user.certifications || [])
    });
  } catch (error) {
    console.error("Add certification error:", error.message);
    return res.status(500).json({ error: "Failed to add certification" });
  }
});

router.delete("/certifications/:certificationId", auth, async (req, res) => {
  try {
    const { certificationId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const cert = user.certifications.id(certificationId);
    if (!cert) {
      return res.status(404).json({ error: "Certification not found" });
    }

    cert.deleteOne();
    await user.save();

    return res.json({
      message: "Certification removed",
      certifications: serializeCertifications(user.certifications || [])
    });
  } catch (error) {
    console.error("Delete certification error:", error.message);
    return res.status(500).json({ error: "Failed to delete certification" });
  }
});

router.get("/github/url", auth, (req, res) => {
  if (!hasGitHubConfig()) {
    return res.status(500).json({
      error: "GitHub OAuth is not configured on the server"
    });
  }

  const requestedMobileRedirect =
    typeof req.query.mobileRedirectUri === "string" ? req.query.mobileRedirectUri : null;

  const mobileRedirectUri = isAllowedMobileRedirectUri(requestedMobileRedirect)
    ? requestedMobileRedirect
    : MOBILE_REDIRECT_URI;

  const encodedState = Buffer.from(
    JSON.stringify({ mobileRedirectUri }),
    "utf8"
  ).toString("base64url");

  const scope = "read:user user:email repo read:org";
  const authUrl =
    `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(encodedState)}`;

  return res.json({ authUrl, redirectUri: mobileRedirectUri });
});

router.get("/github/mobile-callback", (req, res) => {
  const params = new URLSearchParams();
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const error = typeof req.query.error === "string" ? req.query.error : null;
  const errorDescription =
    typeof req.query.error_description === "string" ? req.query.error_description : null;

  if (code) {
    params.set("code", code);
  }
  if (error) {
    params.set("error", error);
  }
  if (errorDescription) {
    params.set("error_description", errorDescription);
  }

  let mobileRedirectUri = MOBILE_REDIRECT_URI;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  if (state) {
    try {
      const parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
      if (isAllowedMobileRedirectUri(parsedState?.mobileRedirectUri)) {
        mobileRedirectUri = parsedState.mobileRedirectUri;
      }
    } catch (error) {
      console.warn("Invalid OAuth state for mobile redirect", error.message);
    }
  }

  const queryString = params.toString();
  const redirectTarget = queryString
    ? `${mobileRedirectUri}?${queryString}`
    : mobileRedirectUri;

  return res.redirect(302, redirectTarget);
});

router.post("/github/callback", auth, async (req, res) => {
  try {
    if (!hasGitHubConfig()) {
      return res.status(500).json({
        error: "GitHub OAuth is not configured on the server"
      });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "GitHub authorization code is required" });
    }

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI
      },
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!tokenResponse.data?.access_token) {
      return res.status(400).json({ error: "Failed to exchange GitHub code" });
    }

    const githubAccessToken = tokenResponse.data.access_token;
    const octokit = new Octokit({ auth: githubAccessToken });
    const { data: githubUser } = await octokit.users.getAuthenticated();

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.githubAccessToken = githubAccessToken;
    user.githubId = String(githubUser.id);
    user.githubUsername = githubUser.login;

    await user.save();

    return res.json({
      message: "GitHub connected successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        skillExtractionStatus: user.skillExtractionStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error("GitHub callback error:", error.message);
    return res.status(500).json({ error: "Failed to connect GitHub account" });
  }
});

router.post("/github/disconnect", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.githubAccessToken = undefined;
    user.githubId = undefined;
    user.githubUsername = undefined;
    user.skillExtractionStatus = "pending";
    user.repositoryCount = 0;
    user.lastSkillSync = null;
    user.skills = [];
    await user.save();

    return res.json({ message: "GitHub disconnected successfully" });
  } catch (error) {
    console.error("GitHub disconnect error:", error.message);
    return res.status(500).json({ error: "Failed to disconnect GitHub" });
  }
});

module.exports = router;
