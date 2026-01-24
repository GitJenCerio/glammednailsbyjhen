# 💅 glammednailsbyjhen

**A Full-Stack Booking System for Modern Nail Studios**

> Production-ready booking platform combining a beautiful public-facing website with a powerful admin dashboard for managing appointments, customers, finances, and operations.

---

![Banner Placeholder](./public/images/home.jpg)

*[Screenshot of the glammednailsbyjhen homepage - hero section with call-to-action]*

---

## ✨ Features

### 🌐 **Public Website**
- 🏠 **Marketing Homepage** - Showcase services, gallery, pricing, and FAQs
- 📅 **Interactive Booking Calendar** - Real-time availability with slot selection
- 🎨 **Service Catalog** - Detailed service descriptions with pricing
- 📸 **Portfolio Gallery** - Visual showcase of nail art work
- 💰 **Dynamic Pricing** - Google Sheets integration for real-time pricing updates
- 📱 **Fully Responsive** - Mobile-first design optimized for all devices

### 🔐 **Admin Dashboard**
- 📊 **Analytics Dashboard** - Real-time insights, revenue tracking, and performance metrics
- 📅 **Calendar Management** - Visual calendar with slot creation, editing, and blocking
- 👥 **Customer Management** - CRM features with booking history and lifetime value tracking
- 💳 **Finance Management** - Invoice generation, payment tracking, and revenue reports
- 🔔 **Notification System** - Real-time alerts for bookings, slots, and updates
- 👨‍💼 **Multi-Technician Support** - Manage multiple nail technicians with individual calendars
- 🔄 **Booking Operations** - Confirm, reschedule, cancel, split, and recover bookings
- 📈 **Advanced Analytics** - Charts and graphs for bookings, revenue, and service popularity

---

## 🏗️ Architecture & Tech Stack

### System Architecture

```mermaid
graph TB
    subgraph "Frontend"
        A[Next.js App Router] --> B[React Components]
        B --> C[Tailwind CSS]
        B --> D[Client Firebase SDK]
    end
    
    subgraph "Backend"
        E[Next.js API Routes] --> F[Firebase Admin SDK]
        E --> G[Google APIs]
    end
    
    subgraph "Database"
        F --> H[(Firestore)]
        H --> I[Bookings]
        H --> J[Slots]
        H --> K[Customers]
        H --> L[Nail Techs]
    end
    
    subgraph "External Services"
        G --> M[Google Sheets]
        G --> N[Google Forms]
        D --> O[Firebase Auth]
    end
    
    subgraph "Deployment"
        P[Vercel] --> A
        P --> E
    end
    
    A --> E
    D --> O
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | React framework with SSR, API routes, and file-based routing |
| **Language** | TypeScript | Type-safe development with enhanced IDE support |
| **UI Library** | React 18 | Component-based UI development |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Animations** | Framer Motion | Smooth animations and transitions |
| **Database** | Firebase Firestore | NoSQL database for real-time data |
| **Auth** | Firebase Authentication | Secure admin authentication |
| **Backend Admin** | Firebase Admin SDK | Server-side database operations |
| **Charts** | Recharts | Data visualization for analytics |
| **Calendar** | react-big-calendar, react-calendar | Calendar components |
| **Date Utilities** | date-fns | Date manipulation and formatting |
| **Integration** | Google APIs (Sheets, Forms) | External data sync |
| **Deployment** | Vercel | Serverless hosting and CI/CD |

---

## 🗄️ Database Schema

The application uses **Firebase Firestore** (NoSQL) as the primary database. All collections are stored in a single Firestore database with the following structure:

### Firestore Collections

```mermaid
erDiagram
    BOOKINGS ||--o{ SLOTS : "references"
    BOOKINGS ||--|| CUSTOMERS : "references"
    BOOKINGS ||--|| NAIL_TECHS : "references"
    SLOTS ||--|| NAIL_TECHS : "references"
    
    BOOKINGS {
        string id PK
        string slotId FK
        string customerId FK
        string nailTechId FK
        string bookingId
        string status
        string serviceType
        object invoice
        string paymentStatus
        number paidAmount
        number depositAmount
        number tipAmount
        timestamp createdAt
        timestamp updatedAt
    }
    
    SLOTS {
        string id PK
        string date
        string time
        string status
        string nailTechId FK
        string slotType
        string notes
        timestamp createdAt
        timestamp updatedAt
    }
    
    CUSTOMERS {
        string id PK
        string name
        string email
        string phone
        string socialMediaName
        boolean isRepeatClient
        timestamp createdAt
        timestamp updatedAt
    }
    
    NAIL_TECHS {
        string id PK
        string name
        string role
        string serviceAvailability
        array workingDays
        number discount
        number commissionRate
        string status
        timestamp createdAt
        timestamp updatedAt
    }
    
    BLOCKED_DATES {
        string id PK
        string startDate
        string endDate
        string reason
        string scope
        timestamp createdAt
        timestamp updatedAt
    }
    
    NOTIFICATIONS {
        string id PK
        string type
        string title
        string message
        boolean read
        string relatedId
        string relatedType
        timestamp createdAt
        timestamp updatedAt
    }
    
    ANALYTICS_EVENTS {
        string id PK
        string type
        string page
        string referrer
        string userAgent
        timestamp timestamp
        string sessionId
        string bookingId
        timestamp createdAt
    }
```

### Collection Details

#### 📅 **`bookings`** Collection
Stores all booking records with customer and slot associations.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `slotId` | `string` | Reference to primary slot |
| `linkedSlotIds` | `string[]` | References to additional slots (for multi-slot services) |
| `bookingId` | `string` | Human-readable booking ID (e.g., "GN-00001") |
| `customerId` | `string` | Reference to customer document |
| `nailTechId` | `string` | Reference to nail technician |
| `status` | `string` | `pending_form` \| `pending_payment` \| `confirmed` \| `cancelled` |
| `serviceType` | `string` | `manicure` \| `pedicure` \| `mani_pedi` \| `home_service_2slots` \| `home_service_3slots` |
| `serviceLocation` | `string` | `homebased_studio` \| `home_service` |
| `clientType` | `string` | `new` \| `repeat` |
| `invoice` | `object` | Invoice/quotation details (items, total, notes) |
| `paymentStatus` | `string` | `unpaid` \| `partial` \| `paid` \| `refunded` \| `forfeited` |
| `paidAmount` | `number` | Total amount paid |
| `depositAmount` | `number` | Deposit amount |
| `tipAmount` | `number` | Tip amount |
| `depositPaymentMethod` | `string` | `PNB` \| `CASH` \| `GCASH` |
| `paidPaymentMethod` | `string` | `PNB` \| `CASH` \| `GCASH` |
| `depositDate` | `string` | ISO date string when deposit was paid |
| `paidDate` | `string` | ISO date string when payment was made |
| `tipDate` | `string` | ISO date string when tip was received |
| `customerData` | `object` | Legacy form data (for backward compatibility) |
| `formResponseId` | `string` | Google Forms response ID |
| `createdAt` | `timestamp` | Creation timestamp |
| `updatedAt` | `timestamp` | Last update timestamp |

#### ⏰ **`slots`** Collection
Stores available time slots for appointments.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `date` | `string` | Date in `YYYY-MM-DD` format |
| `time` | `string` | Time in `HH:mm` format (24-hour) |
| `status` | `string` | `available` \| `blocked` \| `pending` \| `confirmed` |
| `slotType` | `string` | `regular` \| `with_squeeze_fee` \| `null` |
| `notes` | `string` | Optional notes about the slot |
| `nailTechId` | `string` | Reference to nail technician (required) |
| `createdAt` | `timestamp` | Creation timestamp |
| `updatedAt` | `timestamp` | Last update timestamp |

#### 👥 **`customers`** Collection
Stores customer information and profiles.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `name` | `string` | Full name |
| `firstName` | `string` | First name (optional) |
| `lastName` | `string` | Last name (optional) |
| `email` | `string` | Email address (optional) |
| `phone` | `string` | Phone number (optional) |
| `socialMediaName` | `string` | Facebook/Instagram handle |
| `referralSource` | `string` | How customer found the business |
| `isRepeatClient` | `boolean` | Whether customer is a repeat client |
| `notes` | `string` | Additional notes about customer |
| `createdAt` | `timestamp` | Creation timestamp |
| `updatedAt` | `timestamp` | Last update timestamp |

#### 👨‍💼 **`nailTechs`** Collection
Stores nail technician profiles and settings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `name` | `string` | Name without "Ms." prefix (e.g., "Jhen") |
| `role` | `string` | `Owner` \| `Junior Tech` \| `Senior Tech` |
| `serviceAvailability` | `string` | `Studio only` \| `Home service only` \| `Studio and Home Service` |
| `workingDays` | `string[]` | Array of day names: `['Monday', 'Tuesday', ...]` |
| `discount` | `number` | Discount percentage (e.g., 15 for 15%) |
| `commissionRate` | `number` | Commission rate (e.g., 0.3 for 30%) |
| `status` | `string` | `Active` \| `Inactive` |
| `createdAt` | `timestamp` | Creation timestamp |
| `updatedAt` | `timestamp` | Last update timestamp |

#### 🚫 **`blockedDates`** Collection
Stores date ranges that are blocked (holidays, closures, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `startDate` | `string` | Start date in `YYYY-MM-DD` format |
| `endDate` | `string` | End date in `YYYY-MM-DD` format |
| `reason` | `string` | Reason for blocking (optional) |
| `scope` | `string` | `single` \| `range` \| `month` |
| `createdAt` | `timestamp` | Creation timestamp |
| `updatedAt` | `timestamp` | Last update timestamp |

#### 🔔 **`notifications`** Collection
Stores admin notifications for real-time alerts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `type` | `string` | `booking_created` \| `booking_pending` \| `booking_confirmed` \| `booking_cancelled` \| `slot_added` \| `slot_removed` \| `slot_updated` |
| `title` | `string` | Notification title |
| `message` | `string` | Notification message |
| `read` | `boolean` | Whether notification has been read |
| `relatedId` | `string` | ID of related entity (bookingId, slotId, etc.) |
| `relatedType` | `string` | `booking` \| `slot` |
| `section` | `string` | Admin section to navigate to (e.g., 'bookings', 'overview') |
| `createdAt` | `timestamp` | Creation timestamp |
| `updatedAt` | `timestamp` | Last update timestamp |

#### 📊 **`analytics_events`** Collection
Stores analytics events for tracking user behavior.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Document ID (auto-generated) |
| `type` | `string` | `page_view` \| `book_now_click` \| `booking_started` \| `booking_completed` |
| `page` | `string` | Page URL where event occurred |
| `referrer` | `string` | Referrer URL |
| `userAgent` | `string` | User agent string |
| `timestamp` | `timestamp` | Event timestamp |
| `sessionId` | `string` | Session identifier |
| `bookingId` | `string` | Related booking ID (if applicable) |
| `createdAt` | `timestamp` | Creation timestamp |

### Database Relationships

- **Bookings → Slots**: One booking can reference multiple slots (via `slotId` and `linkedSlotIds`)
- **Bookings → Customers**: Many-to-one relationship (multiple bookings per customer)
- **Bookings → Nail Techs**: Many-to-one relationship (multiple bookings per technician)
- **Slots → Nail Techs**: Many-to-one relationship (multiple slots per technician)
- **Notifications → Bookings/Slots**: Optional relationships via `relatedId` and `relatedType`

### Indexes

Firestore automatically creates indexes for:
- Single-field queries (e.g., `status`, `date`, `customerId`)
- Composite queries used in the application (e.g., `date + status`, `nailTechId + date`)

### Data Validation

- All timestamps are stored as Firestore `Timestamp` objects
- Date strings follow `YYYY-MM-DD` format
- Time strings follow `HH:mm` format (24-hour)
- Required fields are enforced at the application level
- Foreign key relationships are maintained through application logic

---

## 📋 Booking Flow

```mermaid
sequenceDiagram
    participant Client
    participant Public Website
    participant API
    participant Firebase
    participant Admin Dashboard
    participant Google Forms
    
    Client->>Public Website: Browse Services & Pricing
    Client->>Public Website: Select Date & Time Slot
    Client->>Public Website: Fill Booking Form
    Public Website->>API: Submit Booking
    API->>Firebase: Create Booking Record
    API->>Firebase: Update Slot Status
    API->>Google Forms: Submit Form Data
    Firebase-->>API: Confirm Booking
    API-->>Public Website: Show Confirmation
    Public Website-->>Client: Booking Confirmed
    
    Firebase->>Admin Dashboard: Real-time Update
    Admin Dashboard->>Admin: Notification
    Admin->>Admin Dashboard: Review & Confirm
    Admin Dashboard->>Firebase: Update Booking Status
```

---

## 🔄 Booking Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending: Customer Books
    Pending --> Pending_Payment: Admin Reviews
    Pending_Payment --> Confirmed: Payment Received
    Confirmed --> Completed: Service Rendered
    Confirmed --> Cancelled: Admin/Customer Cancels
    Pending --> Cancelled: Cancelled Before Payment
    Cancelled --> [*]
    Completed --> [*]
    
    note right of Pending
        Slot reserved
        Awaiting admin confirmation
    end note
    
    note right of Confirmed
        Deposit/Full payment received
        Slot confirmed
    end note
    
    note right of Cancelled
        Slot released
        Can be recovered if needed
    end note
```

---

## 📸 Screenshots

### Public Website
![Homepage](./public/images/services-sc.jpg)
*[Homepage with hero section and service showcase]*

![Booking Calendar](./public/images/booking-calendar.jpg)
*[Interactive booking calendar with available slots]*

### Admin Dashboard
![Admin Dashboard Overview](./public/images/admin.jpg)
*[Analytics dashboard with key metrics and charts]*

![Calendar Management](./public/images/admin-calendar.jpg)
*[Admin calendar view for managing slots and bookings]*

![Finance View](./public/images/finance.jpg)
*[Finance management with invoice generation]*

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Firebase project with Firestore enabled
- Google Cloud project with Sheets and Forms API enabled
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/glammednailsbyjhen.git
   cd glammednailsbyjhen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory with the required variables (see [Environment Variables](#-environment-variables) section below).

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🔐 Environment Variables

Create a `.env.local` file in the project root with the following variables:

### Site Configuration
```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Firebase Client SDK
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Firebase Admin SDK
```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Google Service Account
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SHEETS_RANGE='Form Responses 1'!A:Z
GOOGLE_SHEETS_BOOKING_ID_COLUMN=Booking ID
```

### Google Forms Integration
```env
GOOGLE_FORM_BASE_URL=https://docs.google.com/forms/d/e/...
GOOGLE_FORM_BOOKING_ID_ENTRY=entry.123456789
GOOGLE_FORM_DATE_ENTRY=entry.123456790
GOOGLE_FORM_TIME_ENTRY=entry.123456791
GOOGLE_FORM_SERVICE_LOCATION_ENTRY=entry.123456792
GOOGLE_FORM_NAME_ENTRY=entry.123456793
GOOGLE_FORM_FIRST_NAME_ENTRY=entry.123456794
GOOGLE_FORM_LAST_NAME_ENTRY=entry.123456795
GOOGLE_FORM_EMAIL_ENTRY=entry.123456796
GOOGLE_FORM_PHONE_ENTRY=entry.123456797
GOOGLE_FORM_CONTACT_NUMBER_ENTRY=entry.123456798
GOOGLE_FORM_SOCIAL_MEDIA_ENTRY=entry.123456799
GOOGLE_FORM_REFERRAL_SOURCE_ENTRY=entry.123456800
GOOGLE_FORM_DATE_FORMAT=MM/dd/yyyy
```



> ⚠️ **Important**: Never commit `.env.local` to version control. All sensitive keys should be kept secure.

---

## 🛠️ Build & Deployment

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Deployment to Vercel

1. **Connect Repository**
   - Push your code to GitHub/GitLab/Bitbucket
   - Import the repository in Vercel dashboard

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required environment variables from `.env.local`

3. **Deploy**
   - Vercel automatically deploys on every push to main branch
   - Preview deployments are created for pull requests

4. **Configure Cron Jobs** (Optional)
   - Set up Vercel Cron Jobs in `vercel.json` for scheduled tasks:
     - Daily cleanup of expired slots
     - Daily booking reminders
     - Release expired bookings

### Vercel Configuration

The project includes `vercel.json` for serverless function configuration and cron job scheduling.

---

## 👥 Client Features

### Public Booking Experience

- ✅ **Browse Services** - View all available nail services with descriptions and pricing
- ✅ **View Gallery** - Explore portfolio of completed nail art work
- ✅ **Check Pricing** - Dynamic pricing loaded from Google Sheets
- ✅ **Select Appointment** - Interactive calendar showing available time slots
- ✅ **Book Appointment** - Simple form to enter customer details
- ✅ **Service Selection** - Choose from various service types (manicure, pedicure, nail art, extensions)
- ✅ **Location Selection** - Book for home-based studio or home service
- ✅ **Repeat Customer Recognition** - Existing customers can quickly rebook
- ✅ **Booking Confirmation** - Instant confirmation with booking ID

---

## 🔐 Admin Features

### Dashboard Overview
- **Real-time Analytics** - Key metrics at a glance (bookings, revenue, customers)
- **Monthly Trends** - Visual charts showing bookings and revenue over time
- **Service Popularity** - Track which services are most booked
- **Quick Stats** - Today's, week's, and month's performance

### Booking Management

#### Calendar View
- **Visual Calendar** - Month view with color-coded slot statuses
- **Slot Management** - Create individual or bulk slots for specific dates
- **Multi-Technician Support** - Filter calendar by nail technician
- **Date Blocking** - Block unavailable dates (holidays, closures)
- **Drag & Drop** - Intuitive interface for managing appointments

#### List View
- **Booking List** - Table view of all bookings with filters
- **Status Management** - Track pending, confirmed, completed, cancelled bookings
- **Quick Actions** - Confirm, cancel, reschedule with one click
- **Search & Filter** - Find bookings by customer, date, service, or status

#### Booking Operations
- **Confirm Bookings** - Review and confirm customer bookings
- **Reschedule** - Move bookings to different time slots
- **Split Reschedule** - Split multi-slot bookings across technicians
- **Cancel & Release** - Cancel bookings and release slots
- **Recover Bookings** - Restore accidentally cancelled bookings

### Customer Management
- **Customer Database** - Complete customer profiles with contact information
- **Booking History** - View all past and upcoming bookings per customer
- **Lifetime Value** - Track total revenue per customer
- **Customer Segmentation** - Identify new vs repeat clients
- **Edit Customer Data** - Update customer information and preferences

### Finance Management
- **Invoice Generation** - Create professional invoices/quotations
- **Payment Tracking** - Record deposits, full payments, and tips
- **Payment Methods** - Track cash, bank transfer, GCash payments
- **Revenue Reports** - Filter by date range, technician, or service
- **Financial Analytics** - Revenue trends, payment status tracking

### Services Management
- **Service Catalog** - Add, edit, and manage service offerings
- **Pricing Updates** - Update service prices (synced with Google Sheets)
- **Service Types** - Configure different service categories
- **Duration Settings** - Set appointment durations per service

### Nail Technician Management
- **Tech Profiles** - Manage technician information and availability
- **Role Assignment** - Assign roles (Owner, Technician, etc.)
- **Status Management** - Activate/deactivate technicians
- **Individual Calendars** - Separate calendar views per technician

### Notification System
- **Real-time Alerts** - Get notified of new bookings, slot changes
- **Notification Bell** - Unread count badge in admin header
- **Action Notifications** - Alerts for bookings confirmed, cancelled, etc.
- **Mark as Read** - Manage notification status

---

## 📊 Admin Workflow

```mermaid
flowchart TD
    A[Admin Logs In] --> B[View Dashboard]
    B --> C{Choose Section}
    
    C -->|Overview| D[View Analytics]
    C -->|Bookings| E[Manage Calendar/List]
    C -->|Finance| F[Track Revenue & Invoices]
    C -->|Customers| G[Manage Customer Database]
    C -->|Services| H[Update Service Catalog]
    C -->|Nail Techs| I[Manage Technicians]
    
    E --> J{Booking Action}
    J -->|New Booking| K[Confirm Booking]
    J -->|Existing| L[Reschedule/Cancel/Update]
    
    K --> M[Update Slot Status]
    L --> M
    M --> N[Create Invoice]
    N --> O[Track Payment]
    O --> P[Mark Complete]
    
    F --> Q[Generate Reports]
    G --> R[View Customer History]
    
    style A fill:#e1f5ff
    style B fill:#e1f5ff
    style P fill:#90ee90
```

---

## 🗂️ Project Structure

```
glammednailsbyjhen/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin dashboard pages
│   │   ├── dashboard/            # Main admin dashboard
│   │   └── page.tsx              # Admin login page
│   ├── api/                      # Serverless API routes
│   │   ├── analytics/            # Analytics endpoints
│   │   ├── availability/         # Slot availability checks
│   │   ├── blocks/               # Date blocking management
│   │   ├── bookings/             # Booking CRUD operations
│   │   ├── cron/                 # Scheduled tasks
│   │   ├── customers/            # Customer management
│   │   ├── google/               # Google Sheets/Forms sync
│   │   ├── nail-techs/           # Technician management
│   │   └── slots/                # Slot management
│   ├── booking/                  # Public booking flow
│   ├── cookies-policy/           # Legal pages
│   ├── privacy-policy/
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Homepage
│   ├── robots.ts                 # SEO robots.txt
│   └── sitemap.ts                # SEO sitemap
├── components/                   # React components
│   ├── admin/                    # Admin-specific components
│   │   ├── analytics/            # Analytics charts and cards
│   │   ├── calendar/             # Calendar grid component
│   │   └── modals/               # Admin modal dialogs
│   ├── booking/                  # Booking flow components
│   └── [public components]       # Header, Footer, Hero, etc.
├── lib/                          # Core libraries and utilities
│   ├── constants/                # Application constants
│   ├── services/                 # Business logic services
│   │   ├── analyticsService.ts   # Analytics calculations
│   │   ├── blockService.ts       # Date blocking logic
│   │   ├── bookingService.ts     # Booking operations
│   │   ├── customerService.ts    # Customer management
│   │   ├── nailTechService.ts    # Technician operations
│   │   ├── notificationService.ts # Notification system
│   │   └── slotService.ts        # Slot management
│   ├── utils/                    # Utility functions
│   ├── firebase.ts               # Firebase client config
│   ├── firebaseAdmin.ts          # Firebase admin config
│   ├── googleForms.ts            # Google Forms integration
│   ├── googleSheets.ts           # Google Sheets integration
│   ├── scheduling.ts             # Scheduling utilities
│   ├── types.ts                  # TypeScript type definitions
│   └── utils.ts                  # General utilities
├── public/                       # Static assets
│   ├── images/                   # Images and photos
│   └── [fonts and assets]        # Fonts and static files
├── scripts/                      # Utility scripts
│   ├── clean-database.ts         # Database cleanup
│   ├── create-placeholders.js    # Generate placeholder data
│   └── [migration scripts]       # Data migration utilities
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

---

## 🔮 Future Improvements

### Short-term Roadmap

- [ ] **SMS Notifications** - Integrate SMS service for booking confirmations and reminders
- [ ] **Email Notifications** - Automated email system for booking confirmations and follow-ups
- [ ] **Customer Portal** - Allow customers to view booking history and reschedule appointments
- [ ] **Online Payments** - Integrate payment gateway for deposit and full payment processing
- [ ] **Multi-language Support** - Add support for multiple languages (Filipino, English)

### Medium-term Enhancements

- [ ] **Mobile App** - Native mobile application for iOS and Android
- [ ] **Advanced Analytics** - Exportable reports, custom date ranges, comparative analytics
- [ ] **Recurring Appointments** - Support for regular customer schedules
- [ ] **Waitlist Feature** - Allow customers to join waitlist for fully booked slots
- [ ] **Staff Management** - Advanced scheduling and shift management for technicians
- [ ] **Inventory Management** - Track nail polish, tools, and supplies

### Long-term Vision

- [ ] **AI-Powered Recommendations** - Suggest optimal appointment times based on patterns
- [ ] **Customer Loyalty Program** - Points system and rewards for repeat customers
- [ ] **Social Media Integration** - Share booking confirmations and gallery photos
- [ ] **Video Consultations** - Pre-consultation video calls for nail art designs
- [ ] **Franchise Management** - Multi-location support for expansion
- [ ] **Advanced Reporting** - Predictive analytics and business intelligence

---

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on `localhost:3000` |
| `npm run build` | Build production-optimized application |
| `npm start` | Start production server (requires build first) |
| `npm run lint` | Run ESLint for code quality checks |
| `npm run create-placeholders` | Generate placeholder slots for testing |
| `npm run clean-database` | Clean up database (use with caution) |

---

## 🤝 Contributing

This is a private project for glammednailsbyjhen. For questions or suggestions, please contact the project maintainer.

---

## 📄 License

All rights reserved. This project is proprietary software for glammednailsbyjhen.

---

## 👤 Author

**Jennifer Cerio**  
*Full-Stack Developer & Project Owner*

---

## 🔗 Links

- **Live Website**: [glammednailsbyjhen.com](https://glammednailsbyjhen.com)
- **Admin Dashboard**: [glammednailsbyjhen.com/admin](https://glammednailsbyjhen.com/admin)

---

<div align="center">

**Built with ❤️ using Next.js, Firebase, and Vercel**

*Last updated: 2026*

</div>