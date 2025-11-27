/**
 * Converts 24-hour time format (HH:mm) to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (e.g., "14:30", "09:00")
 * @returns Time in 12-hour format (e.g., "2:30 PM", "9:00 AM")
 */
export function formatTime12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  // Ensure minutes are always 2 digits
  const mins = minutes.padStart(2, '0');
  return `${hour12}:${mins} ${ampm}`;
}



