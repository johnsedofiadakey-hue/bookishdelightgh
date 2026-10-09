/** Pure validators shared by forms, CSV import and server operations. */

export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** Validates ISBN-10 or ISBN-13 check digits. Input may contain hyphens/spaces. */
export function isValidIsbn(input: string): boolean {
  const isbn = normalizeIsbn(input);
  if (/^\d{13}$/.test(isbn)) {
    const sum = isbn
      .slice(0, 12)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === Number(isbn[12]);
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = isbn
      .split("")
      .reduce((total, char, index) => total + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
    return sum % 11 === 0;
  }
  return false;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}

/** SKUs: uppercase letters, digits and hyphens, 3–40 chars. */
export function normalizeSku(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isValidSku(sku: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/.test(sku);
}

/** Ghana phone numbers: 0XXXXXXXXX or +233XXXXXXXXX. Returns E.164 or null. */
export function normalizeGhanaPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^\+233\d{9}$/.test(digits)) return digits;
  if (/^233\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function splitList(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

export function clampText(input: string, max: number): string {
  return input.trim().slice(0, max);
}

export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Central",
  "Eastern",
  "Western",
  "Western North",
  "Volta",
  "Oti",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
] as const;

export function isGhanaRegion(region: string): boolean {
  return (GHANA_REGIONS as readonly string[]).includes(region);
}
