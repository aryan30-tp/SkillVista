const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    category: {
      type: String,
      enum: [
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
      ],
      required: true
    },
    keywords: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    description: {
      type: String,
      default: ""
    },
    baseConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    icon: {
      type: String,
      default: null
    },
    color: {
      type: String,
      default: "#666666"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Skill", skillSchema);
