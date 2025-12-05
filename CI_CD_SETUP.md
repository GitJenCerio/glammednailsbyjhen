# CI/CD Setup Guide

This guide explains how to set up Continuous Integration and Continuous Deployment (CI/CD) for your Glammed Nails by Jhen website.

## 🎯 Overview

Your CI/CD pipeline includes:
- **Automated Linting & Type Checking** - Ensures code quality
- **Automated Builds** - Verifies the app builds successfully
- **Security Audits** - Weekly checks for vulnerable dependencies
- **Automatic Deployments** - Vercel handles deployments automatically

## 🚀 Quick Setup

### Step 1: Connect Your Repository to Vercel

1. **If not already connected:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings

2. **Configure Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add all required environment variables (Firebase, Google APIs, etc.)
   - Set them for Production, Preview, and Development environments

### Step 2: Enable GitHub Actions

GitHub Actions are automatically enabled when you push the `.github/workflows/` directory to your repository.

**First time setup:**
```bash
git add .github/
git commit -m "Add CI/CD workflows"
git push
```

### Step 3: Verify CI/CD is Working

1. **Make a test change:**
   ```bash
   # Make a small change to any file
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test CI/CD pipeline"
   git push
   ```

2. **Check GitHub Actions:**
   - Go to your GitHub repository
   - Click the "Actions" tab
   - You should see workflows running

3. **Check Vercel:**
   - Go to your Vercel dashboard
   - You should see a new deployment starting automatically

## 📋 Workflow Details

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main`, `master`, or `Web-Admin` branches
- Pull requests to these branches

**What it does:**
- ✅ Runs ESLint to check code quality
- ✅ Runs TypeScript type checking
- ✅ Builds the application to verify it compiles
- ✅ Uploads build artifacts (for debugging)

**Duration:** ~2-3 minutes

### 2. Preview Deployment (`deploy-preview.yml`)

**Triggers:**
- Pull requests to main branches

**What it does:**
- ✅ Builds the application
- ✅ Verifies build succeeds before Vercel deploys
- ✅ Comments on PR with build status

**Note:** Vercel automatically creates preview deployments for PRs. This workflow ensures the build succeeds first.

### 3. Security Audit (`security-audit.yml`)

**Triggers:**
- Weekly (Mondays at 9 AM UTC)
- Manual trigger via GitHub Actions UI

**What it does:**
- ✅ Scans dependencies for known vulnerabilities
- ✅ Fails if moderate or higher severity issues found
- ✅ Sends notifications if vulnerabilities detected

## 🔧 Configuration

### Branch Protection (Recommended)

Protect your main branch to require CI checks:

1. Go to GitHub → Settings → Branches
2. Add branch protection rule for `main` or `Web-Admin`
3. Enable:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Select: `lint-and-typecheck` and `build`

### Environment Variables

**Required for Vercel:**
- Firebase configuration
- Google API credentials
- Any other API keys

**Set in Vercel Dashboard:**
- Project Settings → Environment Variables
- Add for: Production, Preview, Development

### Customizing Workflows

Edit workflow files in `.github/workflows/`:

- **Change Node version:** Edit `node-version: '18'` in workflow files
- **Add tests:** Uncomment the test job in `ci.yml`
- **Change schedule:** Edit cron expression in `security-audit.yml`

## 📊 Monitoring

### GitHub Actions Status

- View workflow runs: Repository → Actions tab
- See logs for each step
- Re-run failed workflows

### Vercel Deployments

- View deployments: Vercel Dashboard → Deployments
- See build logs
- Preview deployments for PRs
- Production deployments for main branch

## 🐛 Troubleshooting

### CI Fails on Lint Errors

**Fix:**
```bash
npm run lint -- --fix
git add .
git commit -m "Fix linting errors"
git push
```

### CI Fails on Type Errors

**Fix:**
```bash
npx tsc --noEmit
# Fix any TypeScript errors shown
git add .
git commit -m "Fix TypeScript errors"
git push
```

### Build Fails Locally but Works in CI

**Possible causes:**
- Missing environment variables
- Different Node.js versions
- Cache issues

**Fix:**
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Vercel Deployment Fails

**Check:**
1. Environment variables are set correctly
2. Build command is correct (`npm run build`)
3. Node.js version matches (18.x)
4. No missing dependencies

**View logs:**
- Vercel Dashboard → Deployment → View Logs

## 🎓 Best Practices

### 1. Always Test Locally First

```bash
npm run lint
npx tsc --noEmit
npm run build
```

### 2. Use Feature Branches

```bash
git checkout -b feature/new-feature
# Make changes
git push origin feature/new-feature
# Create PR - CI/CD runs automatically
```

### 3. Review CI Results Before Merging

- Wait for CI to pass before merging PRs
- Review any warnings or errors
- Fix issues before merging

### 4. Keep Dependencies Updated

```bash
# Check for updates
npm outdated

# Update dependencies (test thoroughly!)
npm update
npm audit fix
```

## 📝 Adding Tests (Future)

When you're ready to add tests:

1. **Install testing framework:**
   ```bash
   npm install --save-dev @testing-library/react @testing-library/jest-dom jest
   ```

2. **Uncomment test job in `ci.yml`**

3. **Add test scripts to `package.json`:**
   ```json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch"
   }
   ```

## 🔐 Security

### Secrets Management

**Never commit secrets to git!**

- Use Vercel Environment Variables for production
- Use GitHub Secrets for CI/CD workflows (if needed)
- Keep `.env` files in `.gitignore` ✅ (already done)

### Dependency Security

- Security audit runs weekly automatically
- Fix vulnerabilities promptly
- Review `npm audit` output regularly

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## ✅ Checklist

- [ ] Repository connected to Vercel
- [ ] Environment variables configured in Vercel
- [ ] GitHub Actions workflows pushed to repository
- [ ] Tested CI/CD with a small change
- [ ] Branch protection rules configured (optional but recommended)
- [ ] Team members understand the workflow

---

**Need Help?** Check the troubleshooting section or review the workflow logs in GitHub Actions.

