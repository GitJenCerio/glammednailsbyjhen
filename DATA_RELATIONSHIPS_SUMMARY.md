# Data Relationships Summary

This document explains how the three main modules (Bookings, Finance, and Customers) are connected and work together.

## Overview

The system now has three integrated modules:
1. **Customers** - Central customer database
2. **Bookings** - Appointment bookings linked to customers
3. **Finance** - Financial records linked to bookings (and thus customers)

## Data Structure

### Customer
- **ID**: Unique identifier
- **Name**: Customer full name
- **Email**: Optional email address
- **Phone**: Optional phone number
- **Notes**: Optional notes about the customer
- **Created/Updated timestamps**

### Booking
- **ID**: Unique identifier
- **customerId**: **REQUIRED** - Links to Customer record
- **bookingId**: Human-readable booking ID (e.g., GN-00001)
- **slotId**: Links to Slot
- **status**: Booking status (pending_form, pending_payment, confirmed)
- **customerData**: Raw form data (kept for backward compatibility)
- **invoice**: Invoice details (items, total, notes)
- **paymentStatus**: unpaid, partial, paid, refunded
- **paidAmount**: Amount paid (excluding deposit)
- **depositAmount**: Deposit amount
- **tipAmount**: Tip amount
- **Created/Updated timestamps**

### Finance
Finance data is **stored directly on Booking records**, not as separate documents. This ensures:
- Automatic synchronization when bookings change
- No data duplication
- Single source of truth

Finance fields on Booking:
- `invoice`: Invoice details
- `paymentStatus`: Payment status
- `paidAmount`: Amount paid
- `depositAmount`: Deposit amount
- `tipAmount`: Tip amount

## Relationships

```
Customer (1) ──< (Many) Bookings
                      │
                      └──> Finance Data (stored on Booking)
```

### Customer → Bookings
- One customer can have many bookings
- Every booking **must** have a `customerId`
- Customer information is extracted from booking form data when form is submitted
- If customer already exists (by email or phone), booking links to existing customer
- If customer doesn't exist, a new customer record is created

### Booking → Finance
- Finance data is stored directly on the booking record
- When booking status changes, finance records are automatically updated
- When payment is recorded, booking's finance fields are updated
- Finance view reads from bookings and displays financial information

### Customer → Finance (via Bookings)
- Customer lifetime value is calculated by summing all booking invoices and tips
- Finance view can filter by customer
- Customer detail panel shows all bookings and their financial status

## Data Flow

### Creating a Booking

1. **Initial Booking Creation** (when slot is selected):
   - Booking created with `customerId: 'PENDING_FORM_SUBMISSION'`
   - Status: `pending_form`
   - No customer record yet (will be created when form is submitted)

2. **Form Submission** (when customer fills out Google Form):
   - `syncBookingWithForm()` is called
   - Customer extracted from form data using `findOrCreateCustomer()`
   - Customer matched by email or phone (or created if new)
   - Booking updated with:
     - `customerId`: Links to customer record
     - `customerData`: Raw form data (for display)
     - `status`: Changed to `pending_payment`

### Updating a Booking

1. **Status Changes**:
   - When booking is confirmed: `status` → `confirmed`
   - If deposit provided: `depositAmount` and `paymentStatus` updated
   - Finance records automatically reflect changes

2. **Payment Updates**:
   - When payment recorded: `paidAmount`, `paymentStatus`, `tipAmount` updated
   - Booking status may change to `confirmed` if fully paid
   - Finance view automatically shows updated information

3. **Invoice Creation**:
   - Invoice saved to booking's `invoice` field
   - Booking status updated to `pending_payment` (if not already confirmed)
   - Finance view shows invoice details

### Customer Updates

1. **Auto-Sync**:
   - When booking form is submitted, customer info is updated if changed
   - Email and phone are used to match existing customers
   - Name is updated if different from existing record

2. **Manual Updates**:
   - Admin can edit customer info in Customer tab
   - Updates are saved to customer record
   - All bookings remain linked to same customer

## Helper Functions

### Customer Service
- `getCustomerById(id)`: Get customer by ID
- `getBookingsByCustomer(customerId)`: Get all bookings for a customer
- `calculateCustomerLifetimeValue(customerId)`: Calculate total revenue from customer
- `findOrCreateCustomer(customerData)`: Find existing or create new customer

### Booking Service
- All booking operations automatically maintain customer linkage
- Finance data is updated when booking status/payment changes

## Validation Rules

1. **No booking without customer**: Every booking must have a `customerId`
   - New bookings start with `'PENDING_FORM_SUBMISSION'`
   - Updated to real customer ID when form is submitted
   - Migration script handles old bookings

2. **Customer matching**: Customers are matched by:
   - Email (primary)
   - Phone (secondary)
   - If neither matches, new customer is created

3. **Finance consistency**: Finance data is always in sync because it's stored on booking
   - No separate finance records to maintain
   - Updates to booking automatically update finance view

## Migration

For existing bookings without `customerId`:
1. Run migration script: `npx ts-node scripts/migrate-bookings-to-customers.ts`
2. Script will:
   - Extract customer info from `customerData`
   - Create customer records (or link to existing)
   - Update bookings with `customerId`

## Benefits of This Structure

1. **Data Consistency**: Single source of truth for finance data
2. **Automatic Sync**: Finance updates automatically when bookings change
3. **Customer Insights**: Easy to see all bookings and revenue per customer
4. **No Duplication**: Customer info stored once, referenced by bookings
5. **Backward Compatible**: Old `customerData` field preserved for display

## Example Queries

### Get all bookings for a customer
```typescript
const bookings = await getBookingsByCustomer(customerId);
```

### Calculate customer lifetime value
```typescript
const ltv = await calculateCustomerLifetimeValue(customerId);
```

### Get customer with all related data
```typescript
const customer = await getCustomerById(customerId);
const bookings = await getBookingsByCustomer(customerId);
const ltv = await calculateCustomerLifetimeValue(customerId);
```

## UI Integration

### Customer Tab
- Shows list of all customers
- Click customer to see:
  - Customer details (name, email, phone, notes)
  - All bookings for that customer
  - Lifetime value
  - Booking statistics

### Finance Tab
- Shows all bookings with finance data
- Can filter by payment status
- Customer names shown from customer records (not raw form data)
- Links to customer records

### Bookings Tab
- Shows all bookings
- Customer names displayed from customer records
- Can navigate to customer detail from booking

