# Glammed Nails by Jhen Website

A beautiful, modern nail salon website built with Next.js, Tailwind CSS, and Framer Motion.

## 🚀 Features

- **Fully Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
- **Modern UI** - Clean, minimalist design with black and white color scheme
- **Smooth Animations** - Powered by Framer Motion for delightful user experience
- **SEO Optimized** - Built-in meta tags and Next.js Image optimization
- **Fast Performance** - Optimized for Core Web Vitals

## 🛠️ Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **UI Components:** Custom built with HeadlessUI for accordions
- **Fonts:** Playfair Display (headings) and Lato (body)
- **Deployment:** Vercel

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd glammednailsbyjhen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add images to `/public/images`**
   - Place all required images in the `public/images` directory
   - See `/public/images/README.md` for required image list
   - Recommended dimensions are listed in the README

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Navigate to `http://localhost:3000`

## 🏗️ Project Structure

```
glammednailsbyjhen/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main page component
│   └── globals.css         # Global styles and Tailwind imports
├── components/
│   ├── Header.tsx          # Navigation header with mobile menu
│   ├── Hero.tsx            # Hero section with frame effect
│   ├── Services.tsx        # Services grid section
│   ├── About.tsx           # About us section
│   ├── Gallery.tsx         # Gallery with lightbox
│   ├── Pricing.tsx         # Pricing cards
│   ├── FAQ.tsx             # FAQ accordion
│   └── Footer.tsx          # Footer with social links
├── public/
│   └── images/             # All website images
├── package.json
├── tailwind.config.ts
└── next.config.js
```

## 🎨 Customization

### Update Booking Links
- Search for `#book` hrefs throughout the codebase
- Replace with your actual booking URL or form

### Change Colors
- Edit `tailwind.config.ts` to modify color scheme
- Primary color: Black (#000000)
- Background: White (#FFFFFF)
- Subtext: Gray (#666666)

### Update Contact Information
- Edit `components/Footer.tsx` for address, phone, email
- Update social media links (Facebook, Instagram)

### Modify Services & Pricing
- Edit `components/Services.tsx` for service offerings
- Edit `components/Pricing.tsx` for pricing plans
- Adjust FAQ in `components/FAQ.tsx`

## 📱 Sections

1. **Header** - Fixed navigation with logo, menu items, and Book Appointment button
2. **Hero** - Full-screen hero with frame effect and call-to-action
3. **Services** - 6 service cards with images and descriptions
4. **About** - About section with image and text content
5. **Gallery** - Image gallery with lightbox functionality
6. **Pricing** - Pricing cards with service details
7. **FAQ** - Accordion-style frequently asked questions
8. **Footer** - Contact info, social links, and copyright

## 🚀 Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not already installed)
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy the project**
   ```bash
   vercel
   ```

4. **Follow the prompts:**
   - Link to existing project or create new
   - Confirm project settings
   - Deploy!

### Option 2: Deploy via GitHub

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

### Option 3: Connect via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your Git repository
4. Configure project settings (auto-detected)
5. Click "Deploy"

## 🌐 After Deployment

Your site will be available at:
- `https://your-project-name.vercel.app`

### Custom Domain (Optional)
1. Go to your Vercel project dashboard
2. Navigate to Settings → Domains
3. Add your custom domain
4. Follow DNS configuration instructions

## 📝 Notes

- Make sure to add all required images to `/public/images` before deployment
- Update booking links with actual appointment system URLs
- Customize contact information in the Footer component
- Test all sections on mobile, tablet, and desktop before going live
- Update meta tags in `app/layout.tsx` for SEO

## 🐛 Troubleshooting

### Images not loading?
- Ensure images are in `/public/images` directory
- Check file names match exactly (case-sensitive)
- Use JPG or PNG format

### Build errors?
- Run `npm install` to ensure all dependencies are installed
- Check that TypeScript compilation passes: `npm run build`

### Styling issues?
- Clear `.next` cache: `rm -rf .next`
- Rebuild: `npm run build`

## 📄 License

This project is private and proprietary.

## 👤 Contact

For questions or support, please contact:
- Email: info@glammednailsbyjhen.com
- Website: [Your Website URL]

---

**Built with ❤️ using Next.js and Tailwind CSS**

