# Quick Start Guide - glammednailsbyjhen

Get your website running in under 5 minutes!

## 🚀 Step-by-Step Instructions

### Step 1: Install Dependencies (2 minutes)

Open your terminal in the project directory and run:

```bash
npm install
```

This will install all required dependencies (Next.js, React, Tailwind CSS, Framer Motion, etc.)

### Step 2: Start Development Server (30 seconds)

```bash
npm run dev
```

You'll see output like:
```
▲ Next.js 14.2.13
- Local:        http://localhost:3000
- Environments: .env.local
✓ Ready in 2.3s
```

### Step 3: View Your Website (10 seconds)

Open your browser and go to:
```
http://localhost:3000
```

🎉 **Your website is now running locally!**

## 📝 What You'll See

The website includes:
- ✅ Header with navigation and mobile menu
- ✅ Hero section with "Book Appointment" button
- ✅ Services section (6 cards)
- ✅ About section
- ✅ Gallery (9 images with lightbox)
- ✅ Pricing section
- ✅ FAQ accordion
- ✅ Footer with contact info

## 🖼️ Adding Your Images (Optional for now)

Placeholder images are already generated. To replace them with real images:

1. Go to `public/images/` directory
2. Replace placeholder files with your actual photos
3. Keep the same file names
4. Recommended sizes are listed in `public/images/README.md`

## 🎨 Customize Your Content

### Quick Edits:
1. **Contact Info** - Edit `components/Footer.tsx`
2. **Services** - Edit `components/Services.tsx`
3. **Pricing** - Edit `components/Pricing.tsx`
4. **FAQ** - Edit `components/FAQ.tsx`

### Change Meta Tags (SEO):
Edit `app/layout.tsx` to update title and description.

## 🚀 Deploy to Vercel

When ready to go live:

```bash
# Option 1: Install Vercel CLI
npm i -g vercel
vercel

# Option 2: Push to GitHub and import to Vercel.com
git init
git add .
git commit -m "Initial commit"
git push

# Then go to vercel.com and import your repository
```

## 📚 Need More Help?

- **Full setup guide:** See `SETUP.md`
- **Deployment guide:** See `DEPLOYMENT.md`
- **Project overview:** See `PROJECT_SUMMARY.md`
- **Main documentation:** See `README.md`

## 🛑 To Stop the Server

Press `Ctrl + C` in your terminal.

## ✨ Features

- 🎨 Beautiful, modern design
- 📱 Fully responsive (mobile, tablet, desktop)
- ⚡ Fast loading with Next.js optimization
- 🎭 Smooth animations with Framer Motion
- 🖼️ Image lightbox gallery
- 📞 Contact section
- 🔍 SEO optimized

## 🎯 Next Steps

1. ✅ View your site at http://localhost:3000
2. 📝 Customize content to match your business
3. 🖼️ Add your actual images
4. 🚀 Deploy to Vercel
5. 🌐 Share your live website!

---

**Questions?** Check the other documentation files for detailed information.

**Happy coding!** 🎉

