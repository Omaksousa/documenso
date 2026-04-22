import { gregorianToHijri, hijriToGregorian } from '@tabby_ai/hijri-converter';

/** Parses a DD/MM/YYYY string into a JS Date at noon (avoids UTC midnight shift). */
const parseDDMMYYYY = (date: string): Date | null => {
  if (!date) return null;
  const parts = date.split('/').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [day, month, year] = parts;
  const d = new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`,
  );
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Converts an AD date string (DD/MM/YYYY) to a Hijri date string (DD/MM/YYYY).
 * Returns an empty string if conversion fails or input is empty.
 */
export const convertGregorianToHijri = (adDate: string): string => {
  const d = parseDDMMYYYY(adDate);
  if (!d) return '';
  try {
    const hijri = gregorianToHijri({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    });
    const dd = String(hijri.day).padStart(2, '0');
    const mm = String(hijri.month).padStart(2, '0');
    return `${dd}/${mm}/${hijri.year}`;
  } catch {
    return '';
  }
};

/**
 * Converts a Hijri date string (DD/MM/YYYY) to a JS Date (Gregorian).
 * Returns null if the input is invalid or conversion fails.
 */
export const convertHijriToGregorianDate = (hijriDate: string): Date | null => {
  const parts = hijriDate?.split('/').map(Number);
  if (!parts || parts.length !== 3 || parts.some(isNaN)) return null;
  const [day, month, year] = parts;
  try {
    const g = hijriToGregorian({ year, month, day });
    return new Date(
      `${g.year}-${String(g.month).padStart(2, '0')}-${String(g.day).padStart(2, '0')}T12:00:00`,
    );
  } catch {
    return null;
  }
};

/**
 * Returns the absolute difference in days between an AD date (DD/MM/YYYY) and a Hijri date (DD/MM/YYYY).
 * Returns null if either value is missing or invalid.
 */
export const dateDifferenceInDays = (adDate: string, hijriDate: string): number | null => {
  const adParsed = parseDDMMYYYY(adDate);
  if (!adParsed) return null;
  const hijriAsGregorian = convertHijriToGregorianDate(hijriDate);
  if (!hijriAsGregorian) return null;
  return Math.abs(adParsed.getTime() - hijriAsGregorian.getTime()) / (1000 * 60 * 60 * 24);
};
