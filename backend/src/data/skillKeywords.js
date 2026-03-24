/**
 * Skill Keywords Database
 * Maps npm packages and imports to skill objects
 * Used for automatic skill detection from repositories
 */

const skillKeywords = {
  // Frontend Frameworks & Libraries
  react: {
    name: "React",
    category: "frontend",
    confidence: 1.0
  },
  "react-native": {
    name: "React Native",
    category: "frontend",
    confidence: 1.0
  },
  "react-dom": {
    name: "React",
    category: "frontend",
    confidence: 0.9
  },
  vue: {
    name: "Vue.js",
    category: "frontend",
    confidence: 1.0
  },
  "vue-next": {
    name: "Vue.js",
    category: "frontend",
    confidence: 0.95
  },
  "@angular/core": {
    name: "Angular",
    category: "frontend",
    confidence: 1.0
  },
  svelte: {
    name: "Svelte",
    category: "frontend",
    confidence: 1.0
  },
  "next.js": {
    name: "Next.js",
    category: "frontend",
    confidence: 1.0
  },
  next: {
    name: "Next.js",
    category: "frontend",
    confidence: 0.95
  },
  nuxt: {
    name: "Nuxt.js",
    category: "frontend",
    confidence: 1.0
  },
  jquery: {
    name: "jQuery",
    category: "frontend",
    confidence: 0.9
  },
  bootstrap: {
    name: "Bootstrap",
    category: "frontend",
    confidence: 0.9
  },
  tailwindcss: {
    name: "Tailwind CSS",
    category: "frontend",
    confidence: 1.0
  },
  "styled-components": {
    name: "Styled Components",
    category: "frontend",
    confidence: 0.9
  },
  less: {
    name: "LESS",
    category: "frontend",
    confidence: 0.8
  },
  sass: {
    name: "Sass/SCSS",
    category: "frontend",
    confidence: 0.9
  },
  webpack: {
    name: "Webpack",
    category: "tool",
    confidence: 0.9
  },
  vite: {
    name: "Vite",
    category: "tool",
    confidence: 0.95
  },
  parcel: {
    name: "Parcel",
    category: "tool",
    confidence: 0.8
  },
  "babel-core": {
    name: "Babel",
    category: "tool",
    confidence: 0.9
  },
  babel: {
    name: "Babel",
    category: "tool",
    confidence: 0.85
  },

  // Backend Frameworks
  express: {
    name: "Express.js",
    category: "backend",
    confidence: 1.0
  },
  fastify: {
    name: "Fastify",
    category: "backend",
    confidence: 1.0
  },
  koa: {
    name: "Koa",
    category: "backend",
    confidence: 0.95
  },
  nestjs: {
    name: "NestJS",
    category: "backend",
    confidence: 1.0
  },
  "@nestjs/core": {
    name: "NestJS",
    category: "backend",
    confidence: 0.95
  },
  hapi: {
    name: "Hapi",
    category: "backend",
    confidence: 0.9
  },
  django: {
    name: "Django",
    category: "backend",
    confidence: 1.0
  },
  flask: {
    name: "Flask",
    category: "backend",
    confidence: 1.0
  },
  "fastapi-core": {
    name: "FastAPI",
    category: "backend",
    confidence: 0.9
  },
  fastapi: {
    name: "FastAPI",
    category: "backend",
    confidence: 0.95
  },
  spring: {
    name: "Spring Boot",
    category: "backend",
    confidence: 0.9
  },
  rails: {
    name: "Ruby on Rails",
    category: "backend",
    confidence: 1.0
  },
  laravel: {
    name: "Laravel",
    category: "backend",
    confidence: 1.0
  },
  gin: {
    name: "Gin",
    category: "backend",
    confidence: 0.95
  },
  "echo-framework": {
    name: "Echo",
    category: "backend",
    confidence: 0.9
  },

  // Databases & ORMs
  mongoose: {
    name: "MongoDB",
    category: "database",
    confidence: 1.0
  },
  mongodb: {
    name: "MongoDB",
    category: "database",
    confidence: 1.0
  },
  "mongo-db": {
    name: "MongoDB",
    category: "database",
    confidence: 0.9
  },
  sequelize: {
    name: "MySQL/PostgreSQL",
    category: "database",
    confidence: 0.8
  },
  "typeorm": {
    name: "TypeORM",
    category: "database",
    confidence: 0.9,
  },
  prisma: {
    name: "Prisma",
    category: "database",
    confidence: 0.95
  },
  "@prisma/client": {
    name: "Prisma",
    category: "database",
    confidence: 0.95
  },
  knex: {
    name: "Knex.js",
    category: "database",
    confidence: 0.85
  },
  ormconfig: {
    name: "ORM",
    category: "database",
    confidence: 0.7
  },
  mysql: {
    name: "MySQL",
    category: "database",
    confidence: 0.95
  },
  "mysql2": {
    name: "MySQL",
    category: "database",
    confidence: 0.95
  },
  pg: {
    name: "PostgreSQL",
    category: "database",
    confidence: 0.95
  },
  postgres: {
    name: "PostgreSQL",
    category: "database",
    confidence: 0.9
  },
  sqlite3: {
    name: "SQLite",
    category: "database",
    confidence: 0.95
  },
  redis: {
    name: "Redis",
    category: "database",
    confidence: 0.95
  },
  firebase: {
    name: "Firebase",
    category: "database",
    confidence: 0.9
  },
  "firebase-admin": {
    name: "Firebase",
    category: "database",
    confidence: 0.95
  },
  supabase: {
    name: "Supabase",
    category: "database",
    confidence: 0.9
  },
  elasticsearch: {
    name: "Elasticsearch",
    category: "database",
    confidence: 0.9
  },

  // Programming Languages (detected from package.json or imports)
  python: {
    name: "Python",
    category: "language",
    confidence: 0.95
  },
  typescript: {
    name: "TypeScript",
    category: "language",
    confidence: 1.0
  },
  "@types/node": {
    name: "TypeScript",
    category: "language",
    confidence: 0.9
  },
  golang: {
    name: "Go",
    category: "language",
    confidence: 0.9
  },
  rust: {
    name: "Rust",
    category: "language",
    confidence: 0.95
  },
  java: {
    name: "Java",
    category: "language",
    confidence: 0.85
  },
  "c#": {
    name: "C#",
    category: "language",
    confidence: 0.9
  },
  csharp: {
    name: "C#",
    category: "language",
    confidence: 0.85
  },
  "c++": {
    name: "C++",
    category: "language",
    confidence: 0.9
  },
  cpp: {
    name: "C++",
    category: "language",
    confidence: 0.85
  },
  solidity: {
    name: "Solidity",
    category: "language",
    confidence: 0.95
  },
  ruby: {
    name: "Ruby",
    category: "language",
    confidence: 0.9
  },
  php: {
    name: "PHP",
    category: "language",
    confidence: 0.9
  },
  swift: {
    name: "Swift",
    category: "language",
    confidence: 0.95
  },
  kotlin: {
    name: "Kotlin",
    category: "language",
    confidence: 0.9
  },
  cpp17: {
    name: "C++",
    category: "language",
    confidence: 0.85
  },

  // DevOps & Deployment
  docker: {
    name: "Docker",
    category: "devops",
    confidence: 1.0
  },
  kubernetes: {
    name: "Kubernetes",
    category: "devops",
    confidence: 1.0
  },
  k8s: {
    name: "Kubernetes",
    category: "devops",
    confidence: 0.95
  },
  terraform: {
    name: "Terraform",
    category: "devops",
    confidence: 0.95
  },
  ansible: {
    name: "Ansible",
    category: "devops",
    confidence: 0.95
  },
  "aws-sdk": {
    name: "AWS",
    category: "devops",
    confidence: 0.95
  },
  "aws-cdk": {
    name: "AWS",
    category: "devops",
    confidence: 0.9
  },
  aws: {
    name: "AWS",
    category: "devops",
    confidence: 0.9
  },
  "@google-cloud/storage": {
    name: "Google Cloud",
    category: "devops",
    confidence: 0.9
  },
  "azure-storage-blob": {
    name: "Azure",
    category: "devops",
    confidence: 0.9
  },
  nginx: {
    name: "Nginx",
    category: "devops",
    confidence: 0.85
  },
  jenkins: {
    name: "Jenkins",
    category: "devops",
    confidence: 0.9
  },
  "github-actions": {
    name: "GitHub Actions",
    category: "devops",
    confidence: 0.95
  },
  gitlab: {
    name: "GitLab CI/CD",
    category: "devops",
    confidence: 0.9
  },
  circleci: {
    name: "CircleCI",
    category: "devops",
    confidence: 0.9
  },

  // Testing & Quality
  jest: {
    name: "Jest",
    category: "tool",
    confidence: 0.95
  },
  mocha: {
    name: "Mocha",
    category: "tool",
    confidence: 0.95
  },
  chai: {
    name: "Chai",
    category: "tool",
    confidence: 0.85
  },
  jasmine: {
    name: "Jasmine",
    category: "tool",
    confidence: 0.9
  },
  cypress: {
    name: "Cypress",
    category: "tool",
    confidence: 0.95
  },
  selenium: {
    name: "Selenium",
    category: "tool",
    confidence: 0.9
  },
  playwright: {
    name: "Playwright",
    category: "tool",
    confidence: 0.95
  },
  vitest: {
    name: "Vitest",
    category: "tool",
    confidence: 0.9
  },
  pytest: {
    name: "Pytest",
    category: "tool",
    confidence: 0.9
  },
  unittest: {
    name: "Unit Testing",
    category: "tool",
    confidence: 0.7
  },

  // Other Tools
  git: {
    name: "Git",
    category: "tool",
    confidence: 0.8
  },
  eslint: {
    name: "ESLint",
    category: "tool",
    confidence: 0.9
  },
  prettier: {
    name: "Prettier",
    category: "tool",
    confidence: 0.9
  },
  graphql: {
    name: "GraphQL",
    category: "backend",
    confidence: 0.95
  },
  "apollo-server": {
    name: "GraphQL",
    category: "backend",
    confidence: 0.9
  },
  "graphql-core": {
    name: "GraphQL",
    category: "backend",
    confidence: 0.85
  },
  axios: {
    name: "HTTP Client",
    category: "tool",
    confidence: 0.8
  },
  "node-fetch": {
    name: "HTTP Client",
    category: "tool",
    confidence: 0.75
  },
  fetch: {
    name: "HTTP Client",
    category: "tool",
    confidence: 0.7
  },
  lodash: {
    name: "Utility Library",
    category: "tool",
    confidence: 0.7
  },
  underscore: {
    name: "Utility Library",
    category: "tool",
    confidence: 0.7
  },
  moment: {
    name: "Date/Time",
    category: "tool",
    confidence: 0.75
  },
  "date-fns": {
    name: "Date/Time",
    category: "tool",
    confidence: 0.8
  },
  dayjs: {
    name: "Date/Time",
    category: "tool",
    confidence: 0.8
  },
  dotenv: {
    name: "Configuration",
    category: "tool",
    confidence: 0.8
  },
  cors: {
    name: "Security",
    category: "tool",
    confidence: 0.75
  },
  passport: {
    name: "Authentication",
    category: "tool",
    confidence: 0.85
  },
  jwt: {
    name: "Authentication",
    category: "tool",
    confidence: 0.85
  },
  "jsonwebtoken": {
    name: "Authentication",
    category: "tool",
    confidence: 0.9
  },
  bcrypt: {
    name: "Security",
    category: "tool",
    confidence: 0.9
  },
  "bcryptjs": {
    name: "Security",
    category: "tool",
    confidence: 0.9
  },
  openssl: {
    name: "Security",
    category: "tool",
    confidence: 0.8
  },
  "node-sass": {
    name: "Sass/SCSS",
    category: "frontend",
    confidence: 0.85
  },
  "sass-loader": {
    name: "Sass/SCSS",
    category: "frontend",
    confidence: 0.8
  },
  postcss: {
    name: "CSS Processing",
    category: "frontend",
    confidence: 0.75
  },
  purifycss: {
    name: "CSS Optimization",
    category: "frontend",
    confidence: 0.7
  },
  "react-router": {
    name: "React Router",
    category: "frontend",
    confidence: 0.95
  },
  "react-router-dom": {
    name: "React Router",
    category: "frontend",
    confidence: 0.95
  },
  "expo-router": {
    name: "Expo Router",
    category: "frontend",
    confidence: 0.9
  },
  expo: {
    name: "Expo",
    category: "frontend",
    confidence: 0.9
  },
  react_navigation: {
    name: "React Navigation",
    category: "frontend",
    confidence: 0.85
  },
  "react-navigation": {
    name: "React Navigation",
    category: "frontend",
    confidence: 0.85
  },
  "state-management": {
    name: "State Management",
    category: "frontend",
    confidence: 0.6
  },
  redux: {
    name: "Redux",
    category: "frontend",
    confidence: 0.95
  },
  "react-redux": {
    name: "Redux",
    category: "frontend",
    confidence: 0.9
  },
  zustand: {
    name: "State Management",
    category: "frontend",
    confidence: 0.85
  },
  jotai: {
    name: "State Management",
    category: "frontend",
    confidence: 0.8
  },
  recoil: {
    name: "State Management",
    category: "frontend",
    confidence: 0.85
  },
  "mobx-react": {
    name: "State Management",
    category: "frontend",
    confidence: 0.85
  },
  mobx: {
    name: "State Management",
    category: "frontend",
    confidence: 0.8
  },

  // App & Mobile Development
  flutter: {
    name: "Flutter",
    category: "mobile",
    confidence: 0.95
  },
  dart: {
    name: "Dart",
    category: "language",
    confidence: 0.9
  },
  ionic: {
    name: "Ionic",
    category: "mobile",
    confidence: 0.85
  },
  xamarin: {
    name: "Xamarin",
    category: "mobile",
    confidence: 0.85
  },
  android: {
    name: "Android",
    category: "app-development",
    confidence: 0.85
  },
  ios: {
    name: "iOS",
    category: "app-development",
    confidence: 0.85
  },

  // AI / Machine Learning
  tensorflow: {
    name: "TensorFlow",
    category: "ai-ml",
    confidence: 1.0
  },
  "tensorflow-cpu": {
    name: "TensorFlow",
    category: "ai-ml",
    confidence: 0.95
  },
  pytorch: {
    name: "PyTorch",
    category: "ai-ml",
    confidence: 1.0
  },
  torch: {
    name: "PyTorch",
    category: "ai-ml",
    confidence: 1.0
  },
  keras: {
    name: "Keras",
    category: "ai-ml",
    confidence: 0.95
  },
  "scikit-learn": {
    name: "Scikit-learn",
    category: "ai-ml",
    confidence: 0.95
  },
  sklearn: {
    name: "Scikit-learn",
    category: "ai-ml",
    confidence: 0.95
  },
  "opencv-python": {
    name: "OpenCV",
    category: "ai-ml",
    confidence: 0.9
  },
  opencv: {
    name: "OpenCV",
    category: "ai-ml",
    confidence: 0.9
  },
  xgboost: {
    name: "XGBoost",
    category: "ai-ml",
    confidence: 0.9
  },
  lightgbm: {
    name: "LightGBM",
    category: "ai-ml",
    confidence: 0.9
  },
  huggingface: {
    name: "Hugging Face",
    category: "ai-ml",
    confidence: 0.9
  },
  transformers: {
    name: "Transformers",
    category: "ai-ml",
    confidence: 0.95
  },

  // Data Science
  numpy: {
    name: "NumPy",
    category: "data-science",
    confidence: 0.95
  },
  pandas: {
    name: "Pandas",
    category: "data-science",
    confidence: 0.95
  },
  scipy: {
    name: "SciPy",
    category: "data-science",
    confidence: 0.9
  },
  matplotlib: {
    name: "Matplotlib",
    category: "data-science",
    confidence: 0.9
  },
  seaborn: {
    name: "Seaborn",
    category: "data-science",
    confidence: 0.9
  },
  jupyter: {
    name: "Jupyter",
    category: "data-science",
    confidence: 0.9
  },
  pyspark: {
    name: "PySpark",
    category: "data-science",
    confidence: 0.9
  },
  tableau: {
    name: "Tableau",
    category: "data-science",
    confidence: 0.85
  },
  powerbi: {
    name: "Power BI",
    category: "data-science",
    confidence: 0.85
  },

  // Cybersecurity
  nmap: {
    name: "Nmap",
    category: "cybersecurity",
    confidence: 0.9
  },
  wireshark: {
    name: "Wireshark",
    category: "cybersecurity",
    confidence: 0.9
  },
  burpsuite: {
    name: "Burp Suite",
    category: "cybersecurity",
    confidence: 0.9
  },
  metasploit: {
    name: "Metasploit",
    category: "cybersecurity",
    confidence: 0.9
  },
  "kali-linux": {
    name: "Kali Linux",
    category: "cybersecurity",
    confidence: 0.9
  },
  owasp: {
    name: "OWASP",
    category: "cybersecurity",
    confidence: 0.85
  },

  // Additional language signals
  nodejs: {
    name: "Node.js",
    category: "backend",
    confidence: 0.95
  },
  python3: {
    name: "Python",
    category: "language",
    confidence: 0.9
  },
  cpp: {
    name: "C++",
    category: "language",
    confidence: 0.9
  },
  "g++": {
    name: "C++",
    category: "language",
    confidence: 0.85
  },
  openjdk: {
    name: "Java",
    category: "language",
    confidence: 0.85
  },
  springboot: {
    name: "Spring Boot",
    category: "backend",
    confidence: 0.95
  },
  "spring-boot-starter-web": {
    name: "Spring Boot",
    category: "backend",
    confidence: 0.95
  },
  "spring-boot-starter-data-jpa": {
    name: "Spring Boot",
    category: "backend",
    confidence: 0.9
  },
  djangorestframework: {
    name: "Django",
    category: "backend",
    confidence: 0.95
  },
  flaskrestful: {
    name: "Flask",
    category: "backend",
    confidence: 0.9
  }
};

module.exports = skillKeywords;
