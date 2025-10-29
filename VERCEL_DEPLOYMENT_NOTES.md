# Vercel Deployment Notes - Image Loading Issues

## Important: Case Sensitivity on Vercel

Vercel runs on Linux servers which are **case-sensitive** (unlike Windows/Mac). This means file extensions and paths must match exactly.

## Current Image File Extensions

Based on the codebase, ensure your image files match these extensions:

### Gallery Images
- All use `.JPG` (uppercase)
- Files: `gallery-1.JPG` through `gallery-41.JPG` (excluding `gallery-27.JPG`)

### Service Images  
- Service 1-5: `.JPG` (uppercase) - `service-1.JPG`, `service-2.JPG`, etc.
- Service 6: `.jpg` (lowercase) - `service-6.jpg`

### Other Images
- Hero: `hero.jpg` (lowercase)
- About: `about.JPG` (uppercase)

## If Images Don't Load on Vercel

1. **Check file extensions match exactly** - Use the exact case shown above
2. **Verify files are committed to git** - Ensure all image files are tracked in git
3. **Check file paths** - All images should be in `/public/images/`
4. **Case sensitivity** - `gallery-1.JPG` ≠ `gallery-1.jpg` on Vercel

## Quick Fix Checklist

✅ Gallery component now uses Next.js Image component (better error handling)
✅ About image updated to use `.JPG` extension
✅ All components use Next.js Image for better optimization and error handling

## Verification Steps

Before deploying to Vercel:
1. Check that all image files exist in `public/images/`
2. Verify file extensions match the code exactly
3. Test locally with `npm run build` to catch any build-time issues
4. Check browser console on Vercel deployment for any 404 errors on images

