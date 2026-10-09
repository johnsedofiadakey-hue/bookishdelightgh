/**
 * Admin runtime configuration. Server-only values; nothing here is a secret.
 *
 * BOOKISH_ADMIN_STORE      "memory" (default outside production) | "firestore"
 * BOOKISH_ADMIN_DEV_STORE  "1" to allow the in-memory store in a production
 *                          build for local review (`next build && next start`).
 * BOOKISH_ADMIN_DEV_SEED   "0" to start the dev store empty.
 */

export type AdminStoreKind = "memory" | "firestore";

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function devStoreAllowed(): boolean {
  return !isProductionRuntime() || process.env.BOOKISH_ADMIN_DEV_STORE === "1";
}

export function configuredStoreKind(): AdminStoreKind {
  const kind = process.env.BOOKISH_ADMIN_STORE;
  if (kind === "firestore") return "firestore";
  if (kind === "memory") return "memory";
  return devStoreAllowed() ? "memory" : "firestore";
}

/** Development sign-in (pick a fixture staff account) exists only with the dev store. */
export function devSignInEnabled(): boolean {
  return configuredStoreKind() === "memory" && devStoreAllowed();
}

export function firebaseWebConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    authEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "",
  };
}

export function firebaseSignInConfigured(): boolean {
  const config = firebaseWebConfig();
  return Boolean(config.apiKey && config.projectId);
}

export const SESSION_COOKIE = "bd_admin_session";
export const SESSION_TTL_HOURS = 8;
/** Staff must have signed in to Firebase within this window to open a session. */
export const MAX_AUTH_AGE_SECONDS = 10 * 60;
