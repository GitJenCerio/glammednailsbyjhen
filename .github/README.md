# GitHub Workflows

This directory contains CI/CD workflows for automated testing, building, and deployment.

## Workflows

### `ci.yml`
Main CI pipeline that runs on every push and pull request:
- Linting (ESLint)
- Type checking (TypeScript)
- Build verification

### `deploy-preview.yml`
Ensures builds succeed before Vercel creates preview deployments for pull requests.

### `security-audit.yml`
Weekly security audit to check for vulnerable dependencies.

## How It Works

1. **Push to branch** → CI runs automatically
2. **Create PR** → Preview deployment + CI checks
3. **Merge to main** → Production deployment (via Vercel)
4. **Weekly** → Security audit runs automatically

## Viewing Workflow Runs

Go to your repository → Actions tab to see:
- Workflow run status
- Detailed logs for each step
- Build artifacts (if any)

## Customization

Edit the workflow files to:
- Change Node.js version
- Add test steps
- Modify triggers
- Add deployment steps

See [CI_CD_SETUP.md](../CI_CD_SETUP.md) for detailed documentation.

