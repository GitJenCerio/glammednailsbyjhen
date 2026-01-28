/**
 * Simple script to call the recover-from-sheet API endpoint
 * Usage: npx tsx scripts/recover-booking-api.ts GN-00113
 */

const bookingId = process.argv[2];

if (!bookingId) {
  console.error('Usage: npx tsx scripts/recover-booking-api.ts <BOOKING_ID>');
  console.error('Example: npx tsx scripts/recover-booking-api.ts GN-00113');
  process.exit(1);
}

const port = process.env.PORT || 3000;
const url = `http://localhost:${port}/api/bookings/recover-from-sheet`;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ bookingId }),
})
  .then(async (response) => {
    const data = await response.json();
    if (response.ok) {
      console.log('\n✅ Success!');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('\n❌ Error:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to call API:', error.message);
    console.error('\nMake sure the Next.js dev server is running: npm run dev');
    process.exit(1);
  });
