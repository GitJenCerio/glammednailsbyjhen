// 30-minute intervals from 7:00 AM to 8:00 PM (20:00)
export const SLOT_TIMES = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00'
] as const;

export type SlotTime = (typeof SLOT_TIMES)[number];

export function getNextSlotTime(time: string): string | null {
  const index = SLOT_TIMES.indexOf(time as SlotTime);
  if (index === -1 || index === SLOT_TIMES.length - 1) return null;
  return SLOT_TIMES[index + 1];
}

export function getPreviousSlotTime(time: string): string | null {
  const index = SLOT_TIMES.indexOf(time as SlotTime);
  if (index === -1 || index === 0) return null;
  return SLOT_TIMES[index - 1];
}

