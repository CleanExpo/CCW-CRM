# Workflow Examples

This directory contains example workflow templates for optional deployment and advanced features.

## Available Templates

### `deploy-backend.yml.example`
Example workflow for deploying the FastAPI backend to DigitalOcean App Platform.

**To use:**
1. Copy to `.github/workflows/deploy-backend.yml`
2. Add required secrets to your repository:
   - `DIGITALOCEAN_ACCESS_TOKEN`
3. Customize the workflow for your deployment target

### `deploy-frontend.yml.example`
Example workflow for deploying the Next.js frontend to Vercel.

**To use:**
1. Copy to `.github/workflows/deploy-frontend.yml`
2. Add required secrets to your repository:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
3. Customize the workflow for your deployment target

## Other Deployment Options

The starter template is self-contained and can be deployed to various platforms:

### Backend Deployment Options
- **DigitalOcean** - App Platform (example provided)
- **Railway** - https://railway.app
- **Fly.io** - https://fly.io
- **Render** - https://render.com
- **AWS** - Elastic Beanstalk, ECS, or Lambda
- **Google Cloud** - Cloud Run or App Engine
- **Azure** - App Service

### Frontend Deployment Options
- **Vercel** - https://vercel.com (example provided)
- **Netlify** - https://netlify.com
- **Cloudflare Pages** - https://pages.cloudflare.com
- **AWS Amplify** - https://aws.amazon.com/amplify
- **GitHub Pages** - https://pages.github.com

## Notes

- These workflows are **optional** - the template works locally without any deployment
- Deployment workflows require external service accounts and API tokens
- The main CI workflow (`.github/workflows/ci.yml`) runs without any secrets
- For production deployments, ensure you:
  - Change JWT secret keys
  - Use proper database credentials
  - Configure environment variables
  - Set up proper monitoring and logging

## Self-Hosting

You can also self-host the entire stack using Docker:

```bash
# Build and run with Docker Compose
docker compose up --build

# Or deploy to your own server
# See docs/DEPLOYMENT.md for details
```

---

**Questions?** See the main documentation at the repository root.
