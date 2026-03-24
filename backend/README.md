# SkillVista Backend

## Setup

1. Install dependencies:
   npm install
2. Copy environment file:
   copy .env.example .env
3. Start development server:
   npm run dev

## GitHub OAuth Manual Setup

1. Create an OAuth app in GitHub:
   - Go to https://github.com/settings/developers
   - Open OAuth Apps -> New OAuth App
2. Use these values:
   - Application name: SkillVista
   - Homepage URL: https://skillvista-fl50.onrender.com
   - Authorization callback URL: https://skillvista-fl50.onrender.com/api/auth/github/mobile-callback
3. Copy credentials from GitHub OAuth App:
   - Client ID
   - Client Secret
4. Set backend environment variables (local .env and Render Environment):
   - GITHUB_CLIENT_ID=<your_client_id>
   - GITHUB_CLIENT_SECRET=<your_client_secret>
   - GITHUB_REDIRECT_URI=https://skillvista-fl50.onrender.com/api/auth/github/mobile-callback
   - MOBILE_REDIRECT_URI=skillvista://github-auth-callback
5. Ensure frontend API base URL is set to:
   - EXPO_PUBLIC_API_URL=https://skillvista-fl50.onrender.com/api
6. Redeploy backend on Render after saving environment variables.

Quick verification after login:
- Call GET /api/auth/github/url (authenticated) and confirm authUrl is returned.
- In app, tap Connect GitHub and complete browser authorization.

## API

- `GET /` -> basic server message
- `GET /api/health` -> health check payload
