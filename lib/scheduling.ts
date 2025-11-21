import { BlockedDate, Slot } from './types';

export function normalizeDate(value: string): string {
  return value.slice(0, 10);
}

export function isDateWithinBlockedRange(date: string, block: BlockedDate): boolean {
  const target = normalizeDate(date);
  return target >= block.startDate && target <= block.endDate;
}

export function slotIsBlocked(slot: Slot, blocks: BlockedDate[]): boolean {
  return blocks.some((block) => isDateWithinBlockedRange(slot.date, block));
}

export function preventSlotInBlockedRange(slot: Slot, blocks: BlockedDate[]) {
  if (slotIsBlocked(slot, blocks)) {
    throw new Error('Cannot create or update slot inside a blocked range.');
  }
}

