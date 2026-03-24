const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true
    },
    githubAccessToken: {
      type: String
    },
    githubUsername: {
      type: String
    },
    skills: [
      {
        skillId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Skill"
        },
        confidenceScore: {
          type: Number,
          min: 0,
          max: 1,
          default: 0.5
        },
        detectedInRepos: [String]
      }
    ],
    skillExtractionStatus: {
      type: String,
      enum: ["pending", "in-progress", "completed", "failed"],
      default: "pending"
    },
    lastSkillSync: {
      type: Date,
      default: null
    },
    repositoryCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
