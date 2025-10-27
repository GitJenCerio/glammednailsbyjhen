# Deployment Guide for Glammed Nails by Jhen

## 📋 Pre-Deployment Checklist

Before deploying your website, make sure you've completed the following:

### ✅ Content Customization
- [ ] Updated contact information in `components/Footer.tsx`
- [ ] Replaced social media URLs with your actual profiles
- [ ] Updated services and pricing in their respective components
- [ ] Modified FAQ questions to match your business needs
- [ ] Replaced placeholder images with high-quality photos
- [ ] Updated meta tags in `app/layout.tsx` for SEO

### ✅ Booking Integration
- [ ] Replaced all `#book` links with your actual booking system URL
- [ ] Tested booking flow end-to-end
- [ ] Added booking confirmation pages (if applicable)

### ✅ Images
- [ ] All images are optimized (under 500KB each)
- [ ] Images are in correct format (JPG/WebP)
- [ ] All required images are present (17 total)
- [ ] Images showcase your actual work and services

## 🚀 Deploy to Vercel

### Method 1: Deploy via Vercel CLI (Recommended for Developers)

```bash
# 1. Install Vercel CLI globally
npm i -g vercel

# 2. Login to your Vercel account
vercel login

# 3. Deploy from project directory
vercel

# Follow the prompts:
# - Link to existing project or create new
# - Confirm build settings (auto-detected)
# - Deploy!
```

### Method 2: Deploy via GitHub (Recommended for Teams)

1. **Create a GitHub repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Glammed Nails by Jhen website"
   git branch -M main
   git remote add origin https://github.com/yourusername/glammednailsbyjhen.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Select "Import Git Repository"
   - Choose your repository from the list
   - Vercel will auto-detect Next.js configuration
   - Click "Deploy"

### Method 3: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=YOUR_REPO_URL)

Replace `YOUR_REPO_URL` with your GitHub repository URL.

## 🌐 Post-Deployment Steps

### 1. Verify Your Live Site
- Visit your site at `https://your-project-name.vercel.app`
- Test all navigation links
- Check mobile responsiveness
- Verify all images load correctly
- Test booking buttons

### 2. Add Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project
2. Navigate to Settings → Domains
3. Add your custom domain (e.g., `www.glammednailsbyjhen.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation (5-60 minutes)

### 3. Configure Environment Variables (If Needed)

If you have any environment variables:
1. Go to Project Settings → Environment Variables
2. Add your variables
3. Redeploy to apply changes

### 4. Set Up Analytics (Optional)

**Google Analytics**
1. Create a Google Analytics account
2. Get your tracking ID
3. Add to `app/layout.tsx`:

```tsx
// Add to <head> section
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_TRACKING_ID"></script>
```

### 5. Submit to Search Engines

**Google Search Console**
1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add your website property
3. Verify ownership
4. Submit sitemap (Next.js auto-generates at `/sitemap.xml`)

**Bing Webmaster Tools**
1. Go to [bing.com/webmasters](https://www.bing.com/webmasters)
2. Add your site
3. Submit sitemap

## 🔄 Updating Your Site

### Making Changes to Live Site

1. **Edit files locally**
2. **Commit and push to GitHub**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```
3. **Vercel automatically rebuilds and deploys**
   - Watch deployment in Vercel dashboard
   - Usually takes 1-2 minutes

### Preview Deployments

Vercel automatically creates preview deployments for:
- Pull requests
- Git branches
- Test changes before merging to production

Access previews in your GitHub PR or Vercel dashboard.

## 📊 Monitoring & Performance

### Vercel Analytics (Built-in)
- Monitor page views, visitors, and performance
- Access via Vercel Dashboard

### Core Web Vitals
- Lighthouse scores
- Performance metrics
- SEO insights

Visit: `https://your-domain.vercel.app` → Open in Chrome DevTools → Lighthouse

## 🐛 Troubleshooting Deployment

### Build Fails
```bash
# Check build logs in Vercel dashboard
# Common issues:
- Missing dependencies → Add to package.json
- TypeScript errors → Fix in local dev
- Image loading errors → Check image paths
```

### Images Not Loading
- Verify images are in `/public/images/`
- Check file names match exactly (case-sensitive)
- Ensure images are committed to git

### Styling Issues
- Clear Vercel cache: Vercel Dashboard → Project Settings → Clear Build Cache
- Redeploy

### Navigation Links Not Working
- Verify all href IDs match section IDs
- Test smooth scroll behavior
- Check for hash routing issues

## 📱 Performance Optimization

### Before Going Live
- [ ] Run `npm run build` locally to catch errors
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Check all forms and interactive elements
- [ ] Verify images are optimized
- [ ] Test load times (aim for < 3 seconds)

### After Going Live
- Monitor Vercel Analytics
- Check Core Web Vitals
- Review Lighthouse scores
- Optimize based on real user data

## 🔒 Security Checklist

- [ ] No sensitive information in code
- [ ] API keys in environment variables (not in code)
- [ ] Regular updates to dependencies
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Forms have validation and spam protection

## 📞 Need Help?

- Vercel Documentation: https://vercel.com/docs
- Next.js Documentation: https://nextjs.org/docs
- Contact support: support@vercel.com

## 🎉 Congratulations!

Your website is now live and ready to attract customers!

**Next Steps:**
1. Share your new website on social media
2. Update your business cards with the new URL
3. Submit to local business directories
4. Start collecting customer feedback
5. Monitor analytics and optimize based on data

---

**Live Site:** https://your-project-name.vercel.app  
**Built with Next.js, Tailwind CSS, and deployed on Vercel** 🚀

