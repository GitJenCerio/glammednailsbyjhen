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

/**
 * Formats nail tech name with "Ms." prefix
 * @param name - Name without prefix (e.g., "Jhen")
 * @returns Formatted name with "Ms." prefix (e.g., "Ms. Jhen")
 */
export function formatNailTechName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  // Remove "Ms." prefix if already present (case insensitive)
  const normalized = trimmed.toLowerCase().startsWith('ms.') 
    ? trimmed.substring(3).trim() 
    : trimmed;
  return `Ms. ${normalized}`;
}



