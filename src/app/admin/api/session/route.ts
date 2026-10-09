import { NextResponse, type NextRequest } from "next/server";
import { revokeSession, signInWithIdToken } from "@/lib/admin/auth/session";
import { isProductionRuntime, SESSION_COOKIE } from "@/lib/admin/env";
import { httpStatusFor, isAdminError } from "@/lib/admin/errors";
import { getAdminStore } from "@/lib/admin/store";

/**
 * POST { idToken } → exchanges a fresh Firebase ID token for an httpOnly
 * staff session cookie. DELETE → revokes the current session.
 * Same-origin only; the cookie is SameSite=Strict and scoped to /admin.
 */

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  let idToken: unknown;
  try {
    ({ idToken } = (await request.json()) as { idToken?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length > 4096) return NextResponse.json({ error: "Missing sign-in token." }, { status: 400 });
  try {
    const issued = await signInWithIdToken(getAdminStore(), idToken, request.headers.get("user-agent") ?? undefined);
    const response = NextResponse.json({ ok: true, name: issued.profile.displayName });
    response.cookies.set({ name: SESSION_COOKIE, value: issued.cookieValue, httpOnly: true, secure: isProductionRuntime(), sameSite: "strict", path: "/admin", expires: new Date(issued.expiresAt) });
    return response;
  } catch (error) {
    if (isAdminError(error)) return NextResponse.json({ error: error.message }, { status: httpStatusFor[error.code] });
    console.error("[admin session]", error);
    return NextResponse.json({ error: "Sign-in failed on the server." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request refused." }, { status: 403 });
  await revokeSession(getAdminStore(), request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete({ name: SESSION_COOKIE, path: "/admin" });
  return response;
}
