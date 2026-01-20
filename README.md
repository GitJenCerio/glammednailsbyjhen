# glammednailsbyjhen

## Project Title
glammednailsbyjhen

## Description
A booking website for a nail salon. It includes a public site for customers and an admin dashboard for managing slots, bookings, and customers.

## Live Demo
glammednailsbyjhen.com

## Features
- Public marketing site with services, gallery, pricing, FAQ, and policy pages
- Booking flow with availability and slot management
- Admin dashboard for bookings, customers, and analytics
- Google Sheets sync and Google Forms submission support
- Scheduled/cron routes for reminders and maintenance tasks

## Tech Stack
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Backend/Database: Next.js API routes, Firebase Firestore (client + admin SDK), Google APIs
- Hosting/Deployment: Vercel

## Project Structure
Main folders and files:
```
glammednailsbyjhen/
├── app/                      # Routes, layouts, and API endpoints
│   ├── admin/                # Admin pages
│   ├── api/                  # Serverless API routes
│   ├── booking/              # Booking flow
│   ├── cookies-policy/       # Policy pages
│   ├── privacy-policy/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/               # UI components and admin views
├── lib/                      # Services, Firebase, Google, utilities
├── public/                   # Images, fonts, static assets
├── scripts/                  # Maintenance and migration scripts
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## Setup and Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env.local` file in the project root and add the required environment variables.
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

## Environment Variables
Create a `.env.local` file and add the following variables:

### Site
- `NEXT_PUBLIC_SITE_URL` — Base URL used for metadata, sitemap, and structured data

### Firebase (Client SDK)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase (Admin SDK)
- `FIREBASE_PROJECT_ID` — Firebase project ID for admin access
- `FIREBASE_CLIENT_EMAIL` — Service account email
- `FIREBASE_PRIVATE_KEY` — Service account private key

### Google Service Account + Sheets
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — Service account email for Google APIs
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — Service account private key
- `GOOGLE_SHEETS_ID` — Spreadsheet ID
- `GOOGLE_SHEETS_RANGE` — Sheet range (default: `'Form Responses 1'!A:Z`)
- `GOOGLE_SHEETS_BOOKING_ID_COLUMN` — Column name for booking IDs

### Google Forms (Booking Submission)
- `GOOGLE_FORM_BASE_URL` — Base URL for the booking form
- `GOOGLE_FORM_BOOKING_ID_ENTRY`
- `GOOGLE_FORM_DATE_ENTRY`
- `GOOGLE_FORM_TIME_ENTRY`
- `GOOGLE_FORM_SERVICE_LOCATION_ENTRY`
- `GOOGLE_FORM_NAME_ENTRY`
- `GOOGLE_FORM_FIRST_NAME_ENTRY`
- `GOOGLE_FORM_LAST_NAME_ENTRY`
- `GOOGLE_FORM_EMAIL_ENTRY`
- `GOOGLE_FORM_PHONE_ENTRY`
- `GOOGLE_FORM_CONTACT_NUMBER_ENTRY`
- `GOOGLE_FORM_SOCIAL_MEDIA_ENTRY`
- `GOOGLE_FORM_REFERRAL_SOURCE_ENTRY`
- `GOOGLE_FORM_DATE_FORMAT` — Date format used for form submissions

### Cron (Optional)
- `CRON_SECRET` — Protects cron endpoints

## Usage
Customers can browse services, view pricing, and book an appointment. Admin users can manage slots, view bookings, track customers, and monitor analytics from the admin dashboard.


## Deployment
This project is configured for Vercel. Deploy by connecting the repo to Vercel and setting the environment variables in the Vercel dashboard. The build output is `.next`.

## Future Improvements
- Add SMS/email notifications for booking confirmations and reminders
- Add a customer account area to view booking history and reschedule
- Improve analytics with exportable reports and filters

## Author
Jennifer Cerio

## License
All rights reserved.

