# Vercel Deployment - Image Files Checklist

## ✅ CRITICAL: Ensure All Images Are Committed to Git

Vercel only deploys files that are in your Git repository. If images aren't committed, they won't be on Vercel.

## Required Image Files (Case-Sensitive on Vercel)

### Logo
- [ ] `public/logo.svg`

### Hero Section
- [ ] `public/images/hero.jpg` (lowercase)

### About Section  
- [ ] `public/images/about.JPG` (uppercase)

### Services Section
- [ ] `public/images/service-1.JPG` (uppercase)
- [ ] `public/images/service-2.JPG` (uppercase)
- [ ] `public/images/service-3.JPG` (uppercase)
- [ ] `public/images/service-4.JPG` (uppercase)
- [ ] `public/images/service-5.JPG` (uppercase)
- [ ] `public/images/service-6.jpg` (lowercase)

### Gallery Section (40 images)
- [ ] `public/images/gallery-1.JPG` through `gallery-26.JPG` (uppercase)
- [ ] `public/images/gallery-28.JPG` through `gallery-41.JPG` (uppercase)
- [ ] Note: `gallery-27.JPG` is skipped (file is misspelled as `galley-27.JPG`)

## ⚠️ Important Notes

1. **Case Sensitivity**: Vercel (Linux) is case-sensitive. File extensions must match exactly:
   - `.JPG` ≠ `.jpg` 
   - `about.JPG` ≠ `about.jpg`

2. **File Extensions in Code**:
   - Gallery: Uses `.JPG` (uppercase)
   - Services 1-5: Uses `.JPG` (uppercase)
   - Service 6: Uses `.jpg` (lowercase)
   - Hero: Uses `.jpg` (lowercase)
   - About: Uses `.JPG` (uppercase)

3. **Verify Files Are Committed**:
   ```bash
   git ls-files public/images/ | grep -E '\.(jpg|JPG)$'
   ```

4. **If Images Don't Show on Vercel**:
   - Check browser console for 404 errors
   - Verify file names match exactly (case-sensitive)
   - Ensure files are committed to git
   - Check Vercel build logs for missing file warnings

## Quick Fix Commands

To check if all images are tracked in git:
```bash
# List all image files in git
git ls-files public/images/

# Check specific files
git ls-files public/images/hero.jpg
git ls-files public/images/about.JPG
```

To add missing images:
```bash
git add public/images/
git commit -m "Add missing image files"
git push
```

