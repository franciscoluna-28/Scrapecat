const COOKIE_NAME = "_scrapecat_uid";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function generateUUID(): string {
  return crypto.randomUUID();
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/**
 * Returns a stable anonymous user ID for the current browser.
 * Stored as a first-party cookie — industry standard for anonymous
 * session scoping. No localStorage (XSS risk), no fingerprinting.
 */
export function getAnonymousId(): string {
  let id = getCookie(COOKIE_NAME);
  if (!id) {
    id = generateUUID();
    setCookie(COOKIE_NAME, id, MAX_AGE);
  }
  return id;
}
