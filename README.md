# Bookish Delight Ghana

An online bookstore in progress. The current public app is a **store preview** showing the official logo, an illustrative homepage image, and contact details. The catalogue is empty until real stock and cover photos are supplied. Purchasing is intentionally disabled until real stock, delivery rates, Paystack, and mNotify are connected and verified.

The public preview is live at [Bookish Delight GH](https://bookish-delight-gh--bookishdelightghh.europe-west4.hosted.app/). It is marked as a preview and excluded from search indexing while the catalogue and checkout are prepared. The [staff sign-in](https://bookish-delight-gh--bookishdelightghh.europe-west4.hosted.app/admin/sign-in) uses the real Firebase project. An approved staff account can sign in with its password even if its email has not yet been verified.

The custom domain `bookishdelightgh.com` and a `www` redirect are registered with App Hosting. Namecheap DNS and Firebase certificate verification must complete before the custom address is considered live.

## Review the storefront

Use Node.js 22 or newer.

```bash
npm install
npm run dev -- --port 3005
```

Open `http://localhost:3005/`. The preview includes the homepage, browse/search page, empty cart, contact page, and a disabled checkout layout. No order or payment is created. `src/lib/stock-catalog.ts` is empty until verified inventory and real cover photos are available.

## Policies and order tracking

`/terms`, `/privacy`, `/returns`, `/delivery` and `/safety` are drafted for a Ghanaian children's books and educational resources shop. Unconfirmed business facts (registered name, registration and Data Protection Commission numbers, privacy email, return window, refund time, pickup) live in `src/lib/legal.ts` and render as highlighted “To confirm” markers until filled. Have a Ghanaian lawyer review the final text before online ordering opens.

`/track` lets a customer check an order with its `BD-` reference and the phone number on the order. Both must match; mismatches return one generic “not found” message, lookups are rate-limited per address, and the public view omits names, contact details, street address and staff notes (`src/lib/storefront/order-tracking.ts`).

## Shared work

- `PROJECT_PLAN.md` is the product, data, commerce, delivery, and launch plan.
- `CLAUDE_ADMIN_PORTAL.md` is the complete admin assignment for Claude Code. It defines file ownership and acceptance evidence.
- `BRAND_GUIDE.md` records the owner-supplied logo, palette, WhatsApp number, and Kumasi address. The storefront uses the original mark for the header, favicon, home-screen icon, and share artwork.
- `src/lib/contracts/` holds shared catalogue and commerce shapes. Admin should consume these contracts and request missing server interfaces in `ADMIN_INTEGRATION_NOTES.md`.
- `src/lib/firebase/` contains the client SDK, Admin SDK, and Firestore/Auth/Storage adapters. Local Firebase web configuration is in ignored `.env.local`; the public web configuration and Firestore admin selection for App Hosting are in `apphosting.yaml`. Keep Paystack and mNotify secrets server-side.
- `firestore.rules` and `storage.rules` currently deny all client access. Update them narrowly with tested real data flows; do not deploy the default rules as a claim of working commerce.

As checked on 2026-10-09, the Firebase web app, default Cloud Firestore Standard database, and default Storage bucket exist in `europe-west4` (Netherlands). Firestore deletion protection is enabled. The first Owner profile and Auth staff claim are provisioned and audited. Sign-in requires the Firebase password, staff claim, active admin profile, and valid session; email verification is not required for the temporary Owner address. Local `.env.local` selects the real Firestore admin. Public ordering remains disabled.

To review a different first-owner account before provisioning it, run `node --env-file=.env.local scripts/bootstrap-owner.mjs --project bookishdelightghh --uid FIREBASE_UID` without `--apply`. The script is idempotent for the already provisioned first Owner and refuses a conflicting Owner. Do not expose it as a web route.

## Checks

```bash
npm run typecheck
npm run build
npm run test:admin
npm audit --audit-level=high
```

## Deployment

The App Hosting backend `bookish-delight-gh` runs in `europe-west4`. To deploy only the app from this directory, use `firebase deploy --only apphosting:bookish-delight-gh --project bookishdelightghh`. The current deployment was checked on 2026-10-09 for the home, shop, contact, checkout preview, staff sign-in, favicon and share image; desktop and phone widths had no horizontal overflow. The ignored `.env.local` was absent from the uploaded source archive. This is a public preview, not an online-ordering launch.

## Before online ordering

Approve real catalogue data and delivery rate card, then implement and test server-side checkout repricing, stock reservations, Paystack verification, mNotify event delivery, role-gated admin actions, and privacy/support pages. See `PROJECT_PLAN.md` for the full gate.
