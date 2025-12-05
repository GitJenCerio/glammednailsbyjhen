# Sitemap 404 Error - Fix Guide

## Problem
Getting 404 error when accessing: `https://www.glammednailsbyjhen.com/sitemap.xml`

## Solutions

### ✅ Solution 1: Set Environment Variable (REQUIRED)

The sitemap needs to know your site URL. Set this in Vercel:

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Go to **Settings** → **Environment Variables**

2. **Add Environment Variable:**
   ```
   Name: NEXT_PUBLIC_SITE_URL
   Value: https://www.glammednailsbyjhen.com
   Environment: Production, Preview, Development (select all)
   ```

3. **Redeploy:**
   - After adding the variable, trigger a new deployment
   - Go to **Deployments** tab
   - Click **Redeploy** on the latest deployment
   - Or push a new commit to trigger auto-deploy

### ✅ Solution 2: Clear Build Cache and Redeploy

Sometimes Vercel's cache can cause issues:

1. **In Vercel Dashboard:**
   - Go to **Settings** → **General**
   - Scroll to **Build & Development Settings**
   - Click **Clear Build Cache**
   - Redeploy your project

### ✅ Solution 3: Verify Sitemap File Exists

The sitemap file should be at: `app/sitemap.ts`

**Check:**
- ✅ File exists: `app/sitemap.ts`
- ✅ File exports default function
- ✅ Returns proper MetadataRoute.Sitemap format

### ✅ Solution 4: Test Locally First

Before deploying, test locally:

```bash
# Run development server
npm run dev

# Visit in browser
http://localhost:3000/sitemap.xml
```

If it works locally but not on Vercel, it's likely an environment variable issue.

### ✅ Solution 5: Check Build Logs

1. **In Vercel Dashboard:**
   - Go to **Deployments**
   - Click on the latest deployment
   - Check **Build Logs** for any errors

Look for:
- TypeScript errors
- Build failures
- Missing dependencies

## Quick Fix Steps

1. ✅ **Set `NEXT_PUBLIC_SITE_URL` in Vercel environment variables**
2. ✅ **Redeploy the project**
3. ✅ **Wait 1-2 minutes for deployment to complete**
4. ✅ **Test: `https://www.glammednailsbyjhen.com/sitemap.xml`**

## Verification

After redeploying, check:

1. **Sitemap URL:**
   ```
   https://www.glammednailsbyjhen.com/sitemap.xml
   ```

2. **Robots.txt (should reference sitemap):**
   ```
   https://www.glammednailsbyjhen.com/robots.txt
   ```

3. **Expected Response:**
   - Should return XML format
   - Should list all your pages
   - Should have correct URLs

## Common Issues

### Issue: Still 404 after setting environment variable
**Solution:** Make sure you selected all environments (Production, Preview, Development) when adding the variable.

### Issue: Sitemap shows wrong domain
**Solution:** The environment variable might not be set correctly. Double-check the value in Vercel dashboard.

### Issue: Sitemap works locally but not on Vercel
**Solution:** This confirms it's an environment variable issue. Set it in Vercel and redeploy.

## After Fixing

Once the sitemap is working:

1. **Submit to Google Search Console:**
   - Go to [Google Search Console](https://search.google.com/search-console)
   - Add property: `https://www.glammednailsbyjhen.com`
   - Go to **Sitemaps** section
   - Submit: `https://www.glammednailsbyjhen.com/sitemap.xml`

2. **Submit to Bing Webmaster Tools:**
   - Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
   - Add site and submit sitemap

## Need Help?

If the sitemap still doesn't work after these steps:

1. Check Vercel build logs for errors
2. Verify the sitemap.ts file is committed to git
3. Make sure Next.js version supports sitemap.ts (Next.js 13.3+)
4. Try accessing via the Vercel domain first: `https://your-project.vercel.app/sitemap.xml`

