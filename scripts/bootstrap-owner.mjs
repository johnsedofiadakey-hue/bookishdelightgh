/** One-off, operator-run first-owner bootstrap. Never expose this as a web route. */
import { randomUUID } from "node:crypto";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const uid = flag("--uid");
const expectedProject = flag("--project");
const apply = args.includes("--apply");

if (!uid || !expectedProject || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
  throw new Error("Usage: node --env-file=.env.local scripts/bootstrap-owner.mjs --project PROJECT_ID --uid FIREBASE_UID [--apply]");
}
if (process.env.FIREBASE_PROJECT_ID !== expectedProject || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== expectedProject) {
  throw new Error("The requested project must match both server and web Firebase project IDs.");
}

const app = initializeApp({ credential: applicationDefault(), projectId: expectedProject });
const auth = getAuth(app);
const db = getFirestore(app);
const user = await auth.getUser(uid);
if (!user.email || user.disabled) throw new Error("The selected Firebase account must be active and have an email address.");

const profileRef = db.collection("adminProfiles").doc(uid);
const anchorRef = db.collection("adminBootstrap").doc("firstOwner");
const [profile, anchor, ownerQuery] = await Promise.all([
  profileRef.get(),
  anchorRef.get(),
  db.collection("adminProfiles").where("role", "==", "owner").limit(2).get(),
]);
if (anchor.exists && anchor.data()?.uid !== uid) throw new Error("A different first Owner is already recorded.");
if (ownerQuery.docs.some((doc) => doc.id !== uid)) throw new Error("A different Owner profile already exists.");
if (profile.exists && (profile.data()?.role !== "owner" || profile.data()?.status !== "active")) {
  throw new Error("This account already has a conflicting staff profile.");
}

console.log(JSON.stringify({
  projectId: expectedProject,
  uid,
  emailVerified: user.emailVerified,
  disabled: user.disabled,
  ownerProfileExists: profile.exists,
  staffClaimExists: user.customClaims?.bookish_staff === true,
  action: apply ? "apply" : "dry_run",
}, null, 2));

if (!apply) process.exit(0);

await db.runTransaction(async (tx) => {
  const [freshAnchor, freshProfile, freshOwners] = await Promise.all([
    tx.get(anchorRef),
    tx.get(profileRef),
    tx.get(db.collection("adminProfiles").where("role", "==", "owner").limit(2)),
  ]);
  if (freshAnchor.exists && freshAnchor.data()?.uid !== uid) throw new Error("A different first Owner is already recorded.");
  if (freshOwners.docs.some((doc) => doc.id !== uid)) throw new Error("A different Owner profile already exists.");
  if (freshProfile.exists) {
    if (freshProfile.data()?.role !== "owner" || freshProfile.data()?.status !== "active") {
      throw new Error("This account already has a conflicting staff profile.");
    }
    return;
  }

  const now = Timestamp.now();
  const auditRef = db.collection("auditEvents").doc(`aud_${randomUUID().replaceAll("-", "")}`);
  if (!freshAnchor.exists) tx.create(anchorRef, { uid, createdAt: now });
  tx.create(profileRef, {
    uid,
    email: user.email,
    displayName: user.displayName || "Bookish Delight Owner",
    role: "owner",
    status: "active",
    sessionsValidAfter: now,
    createdAt: now,
    createdBy: "system:bootstrap",
    updatedAt: now,
    schemaVersion: 1,
  });
  tx.create(auditRef, {
    id: auditRef.id,
    actorUid: "system",
    actorName: "System",
    actorRole: "system",
    action: "staff.bootstrap_owner",
    entityType: "adminProfile",
    entityId: uid,
    summary: "First Owner account provisioned",
    requestId: `bootstrap_${randomUUID()}`,
    at: now,
  });
});

const freshUser = await auth.getUser(uid);
if (freshUser.customClaims?.bookish_staff !== true) {
  await auth.setCustomUserClaims(uid, { ...freshUser.customClaims, bookish_staff: true });
}
console.log(JSON.stringify({ ownerProfileReady: true, staffClaimReady: true, signInRequiresVerifiedEmail: false }));
