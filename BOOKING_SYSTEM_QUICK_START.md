# 🚀 Booking System - Quick Start Guide

## For Website Owners

### First Time Setup (One-time)

1. **Firebase Setup** (15 minutes)
   - Go to https://console.firebase.google.com/
   - Create new project
   - Enable Authentication → Email/Password
   - Create Firestore Database
   - Copy your Firebase config values
   - Create admin account

2. **Environment Setup** (5 minutes)
   - Create `.env.local` file in project root
   - Add all Firebase config values
   - Add your Google Form URL

3. **Deploy** (10 minutes)
   - Push to GitHub
   - Deploy to Vercel
   - Add environment variables in Vercel dashboard

### Daily Operations

#### Adding New Appointment Slots

1. Go to `https://yoursite.com/admin` (private route, not in navigation)
2. Login with admin credentials
3. Click "Manage Slots" tab
4. Click "+ Add Slot"
5. Fill in:
   - Date
   - Time
   - Service name
6. Click "Add Slot"

#### Managing Bookings

1. Login to admin dashboard
2. Click "Manage Bookings" tab
3. You'll see three sections:
   - **Pending**: New bookings waiting for confirmation
   - **Confirmed**: Active appointments
   - **Cancelled**: Cancelled bookings

#### Confirming a Booking

1. Find booking in "Pending" section
2. Review client details
3. Click "Confirm" button
4. Slot automatically becomes unavailable on calendar

#### Cancelling a Booking

1. Find booking in "Pending" or "Confirmed" section
2. Click "Cancel" button
3. Booking moved to "Cancelled" section

---

## For Clients

### Booking an Appointment

1. Go to `https://yoursite.com/booking`
2. View calendar with available slots
3. Black slots = Available
4. Grey slots = Unavailable (already booked)
5. Click on an available slot
6. Review slot details in popup
7. Click "Proceed to Booking Form"
8. Fill out Google Form
9. Submit form
10. Your booking is now pending admin confirmation

---

## Common Questions

**Q: How do clients know their booking is confirmed?**  
A: Currently, they need to be contacted directly. You can add email notifications later.

**Q: Can I edit slot times after creating them?**  
A: Not directly in the UI yet. You can delete and recreate slots.

**Q: Where is the admin login page?**  
A: It's at `/admin` but intentionally not linked in navigation. Bookmark it.

**Q: How do I change my admin password?**  
A: Use Firebase Console → Authentication to reset it.

**Q: Can multiple people book the same slot?**  
A: No, confirmed bookings make slots unavailable automatically.

**Q: What if a client cancels?**  
A: Use the admin dashboard to cancel the booking. The slot can then be re-added if needed.

---

## Troubleshooting

### Can't login to admin
- Check Firebase Authentication is enabled
- Verify admin account exists in Firebase
- Clear browser cache and try again

### Slots not showing on calendar
- Check Firestore has slots collection
- Verify slots have correct date/time format
- Check browser console for errors

### Bookings not appearing
- Check Firestore has bookings collection
- Verify Google Form is submitting correctly
- Check Firebase security rules

### Calendar looks broken
- Clear browser cache
- Check that react-big-calendar CSS is loading
- Verify date-fns is installed

---

## Pro Tips

1. **Create slots in advance** - Schedule slots for the next few weeks
2. **Check pending bookings daily** - Don't let clients wait too long
3. **Use clear service names** - Examples: "Russian Manicure", "Nail Art", "Pedicure"
4. **Keep Google Form simple** - Ask only for essential info
5. **Backup your data** - Export Firestore data regularly

---

## Need Help?

- Check `IMPLEMENTATION_COMPLETE.md` for detailed setup
- Review `SETUP_INSTRUCTIONS.md` for Firebase configuration
- Firebase console: https://console.firebase.google.com/
- Vercel dashboard: https://vercel.com/dashboard

---

**You're all set!** 🎉

