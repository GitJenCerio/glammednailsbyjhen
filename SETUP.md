# Quick Setup Guide

Follow these steps to get your glammednailsbyjhen website up and running:

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Create Placeholder Images (Optional)

For development purposes, create placeholder images:

```bash
npm run create-placeholders
```

⚠️ **Note:** Replace these placeholder images with actual high-quality images before deploying to production.

## Step 3: Add Your Images

Replace all placeholder images in `public/images/` with your actual images:

### Required Images:
- `hero.jpg` (1920x1080px recommended)
- `service-1.jpg` through `service-6.jpg` (800x600px minimum)
- `about.jpg` (800x600px minimum)
- `gallery-1.jpg` through `gallery-9.jpg` (1200x1200px recommended)

## Step 4: Customize Content

### Edit Contact Information
Open `components/Footer.tsx` and update:
- Address: "123 Main Street, City, State 12345"
- Phone: "(123) 456-7890"
- Email: "info@glammednailsbyjhen.com"

### Update Social Media Links
In `components/Footer.tsx`, replace the placeholder URLs:
- Facebook: `https://facebook.com`
- Instagram: `https://instagram.com`

### Modify Services & Pricing
- Edit `components/Services.tsx` for service offerings
- Edit `components/Pricing.tsx` for pricing details
- Update `components/FAQ.tsx` for FAQ questions

### Change Booking Links
Search for `#book` in all component files and replace with your actual booking URL or appointment system.

## Step 5: Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to preview your site.

## Step 6: Test Everything

✅ Check all sections render correctly
✅ Test mobile responsiveness (use browser DevTools)
✅ Verify all navigation links work
✅ Test gallery lightbox functionality
✅ Test FAQ accordion
✅ Check all images load properly

## Step 7: Deploy to Vercel

### Option A: Using Vercel CLI

```bash
# Install Vercel CLI globally (if not already installed)
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

### Option B: Using GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Vercel will auto-detect Next.js
6. Click "Deploy"

## 🎉 You're Done!

Your site will be live at `https://your-project-name.vercel.app`

## Next Steps

- Add custom domain in Vercel dashboard
- Connect booking system
- Set up Google Analytics (if needed)
- Submit to search engines for SEO

## Need Help?

- Check `README.md` for detailed information
- Review Next.js documentation: https://nextjs.org/docs
- Review Tailwind CSS docs: https://tailwindcss.com/docs

