# Admin integration notes

Owner: Claude Code (admin portal). Audience: Codex (storefront + shared commerce/Firebase) and the business owner.
Status: the admin is functionally complete against a typed persistence port. Firestore, Firebase staff identity, and Firebase Storage adapters now load from their server-side admin registries when `BOOKISH_ADMIN_STORE=firestore`; the local `.env.local` selects this mode. The first Owner was provisioned in `bookishdelightghh` with an audit event and staff claim. Email verification is not required for staff sign-in because the initial Owner address is temporary. The storefront catalogue and commerce adapters are still not connected. Nothing here certifies a live ordering store.

Last updated: 2026-10-09.

---

## 1. What exists in the repo today (shared side)

| Shared item | State | Admin impact |
| --- | --- | --- |
| `src/lib/contracts/catalog.ts` | `PublicBook` with one `variant`, `author: string`, optional `coverImageUrl`, `BookFormat = Paperback \| Hardcover`, `formatGhs()` | Admin reuses `formatGhs`. Admin model is richer (see R4). |
| `src/lib/commerce`, `src/lib/firebase`, `src/app/api` | Firebase client, Admin SDK, and R1/R2/R7 adapters exist; commerce and customer order API are missing | Admin uses real Firestore/Auth/Storage when selected; refunds remain a port |
| `firebase`, `firebase-admin` packages | Installed | Firebase ID tokens and staff identities are checked against the selected project. |
| `sharp` | Direct dependency | Used for cover compression via dynamic import. |
| Firebase rules/indexes/config | Local default-deny rules, index file, and web config exist; deployment and rule tests remain | See §5 |

Codex connected the shared Firebase adapters, added the one-off Owner bootstrap, and connected the admin sign-in form to Firebase password authentication. The local dev server on :3005 runs with the Firestore admin store.

---

## 2. Shared contract requests

Each request names the interface the admin already calls. A registration function in the admin accepts the implementation, so the admin needs no change when the shared owner delivers.

### R1 — Firestore `AdminDataStore` adapter (blocking for production)
- Implemented in `src/lib/firebase/admin-adapters.ts`; loaded by the admin store registry. The owner profile was read back from the live database. Full transaction and index coverage still needs emulator testing.
- Interface: `src/lib/admin/store/types.ts` (`AdminDataStore`, `AdminTransaction`).
- Register: `registerAdminStore(store)` from `src/lib/admin/store/index.ts`, with `BOOKISH_ADMIN_STORE=firestore`. Do this once at server start, e.g. in `instrumentation.ts` or a server-only `src/lib/firebase/admin.ts` that the admin can import.
- Mapping (firebase-admin):
  - `runTransaction(work)` → `db.runTransaction(tx => work(adapterTx))`. Firestore retries; the admin's reads-before-writes rule already matches.
  - `tx.get` → `tx.get(doc)`; `tx.query` → `tx.get(query)`; `tx.create` → `tx.create` (must fail on existing docs: this is what makes movement IDs, idempotency keys and SMS event keys unique); `tx.set`/`update`/`delete` → same.
  - `where`/`orderBy`/`limit` map 1:1. ISO strings at the boundary ↔ Firestore `Timestamp`. Field names are in `src/lib/admin/types.ts`.
  - `isDevelopmentData = false`.
- Admin SDK bypasses security rules, so **every admin op already checks `assertPermission(ctx, …)`** before reading or writing (see `src/lib/admin/ops/*`).

### R2 — `IdentityAdmin` + first-owner bootstrap (blocking for production sign-in)
- Implemented in `src/lib/firebase/admin-adapters.ts` and `scripts/bootstrap-owner.mjs`. The first Owner's profile, coarse staff claim, bootstrap anchor, and audit event were read back from Firebase. The temporary Owner address can sign in without email verification when the Firebase password and other staff checks pass.
- Interface: `src/lib/admin/auth/identity.ts`. Register with `registerIdentityAdmin()`.
  - `isRevokedOrDisabled(uid, authTime)`: `auth.getUser(uid)` → `disabled`, or `tokensValidAfterTime > authTime`.
  - `setStaffClaim(uid, staff)`: merge `{ bookish_staff: true|false }` into existing custom claims; call `revokeRefreshTokens(uid)` when removing.
  - `findUserByEmail(email)`: `auth.getUserByEmail`.
- Coarse claim name: **`bookish_staff`**. The granular role lives in `adminProfiles/{uid}` and is checked on every request.
- Bootstrap: provide a one-off server script (never a route) that sets `bookish_staff` on the owner's Firebase user and writes `adminProfiles/{uid}` with `role: "owner"`, `status: "active"`, `sessionsValidAfter: now`. After that, the owner provisions everyone else from `/admin/staff`.
- Production sign-in checks the Firebase password, signed ID token, staff claim, active profile, and account disable/revocation state. It does not require email verification.

### R3 — Shared commerce must write the order/payment/stock shapes the admin reads
- Orders, payments, stock movements and notifications must match `Order`, `PaymentRecord`, `StockMovement` and `NotificationRecord` in `src/lib/admin/types.ts`. The key rules:
  - `paymentStatus` and `fulfilmentStatus` are separate. Only Paystack verification sets `paid` + `paidAt` on website orders.
  - Checkout reserves stock with `ORDER_RESERVED` (`reservedDelta +q`). Verified payment converts the reservation with `ORDER_SOLD` (`onHandDelta −q`, `reservedDelta −q`) and sets `stockState: "sold"`. Expiry uses `ORDER_RELEASED`. Use the admin's `applyMovement()` from `src/lib/admin/ops/inventory.ts` or replicate its invariants (`onHand ≥ reserved ≥ 0`).
  - Snapshot `delivery: { rateId, rateVersion, serviceLevel, pricePesewas, estimate }` on the order.
  - On verified payment, enqueue `order_paid` with `enqueueOrderSms()` (`src/lib/admin/ops/notifications.ts`). The document ID is derived from `${orderId}:${event}`.
- Delivery quote: use `quoteDelivery()` from `src/lib/admin/ops/delivery.ts` (it is pure) so admin preview and checkout share one rule. Block payment when it returns nothing.
- Promotions: validate `promotions` docs server-side (dates, `usageLimit`, `perCustomerLimit`, `minOrderPesewas`, `eligibleCategoryIds`, discount on book subtotal only) and increment `usedCount` atomically with the order.
- Honour `siteSettings/site.checkoutEnabled` and `smsEnabled`.

### R4 — Storefront catalogue contract
- The admin publishes the shape `StorefrontBookContract` (`src/lib/admin/ops/catalogue.ts`; JSON is visible on `/admin/catalogue/{id}/preview`). It has multiple variants per book, `authors[]`, a real `cover {url, alt, width, height}`, `categorySlugs`, and per-SKU `available`/`inStock`.
- The current `PublicBook` in `src/lib/contracts/catalog.ts` (single variant, `author` string, optional `coverImageUrl`) cannot represent this. Proposal: extend the contracts with the shape above and replace the empty `stock-catalog.ts` reader with verified published stock. Only `status == "published"` books with active variants are public. **`costPesewas` must never be returned publicly.**
- Formats: the admin allows `Paperback | Hardcover | Board book | Box set | Spiral bound` (`BOOK_FORMATS` in `src/lib/admin/types.ts`). Please widen `BookFormat` or confirm a narrower list.
- Homepage: `siteContent/homepage` holds both `draft` and `published`. Serve only `.published`, via the server or a mirrored public doc (see §5), never the whole doc to clients.

### R5 — `RefundGateway` (Paystack refunds)
- Interface: `RefundGateway` in `src/lib/admin/ops/orders.ts`. Register with `registerRefundGateway()`.
- The admin records a `RefundRecord { status: "requested" }` and sets the order to `refund_pending`. It then calls `submitPaystackRefund()` once, after the commit. The shared Paystack webhook (`refund.processed` / `refund.failed`) must update the refund `status` and `providerReference`. On full or partial completion it sets `paymentStatus` to `refunded` or `partially_refunded` and enqueues `refund_processed`.
- Until R5 exists, a Paystack refund stays "Refund pending", and the UI says plainly that no money has moved.
- Stock rule: a refund never moves stock. Stock returns when an order that was not dispatched is cancelled (automatic), or on a `returned` transition where staff tick "resaleable".

### R6 — mNotify SMS worker
- The admin writes `notifications` records (`status: queued`, or `suppressed` when SMS is disabled) inside the same transaction as the order change. It never calls mNotify.
- The worker must claim `queued` → `sending` in a transaction, call mNotify `POST /api/sms/quick` server-side, store `mnotifyCampaignId`, increment `attempts`, and set `sent`/`failed` with `lastError`. It should poll delivery reports to reach `delivered`. Retries come only from staff re-queueing a `failed` record (max 5 attempts). Templates `order_paid | order_dispatched | order_delivered | order_cancelled | refund_processed` v1 need copy and an approved sender ID.

### R7 — `MediaStorage` (Firebase Storage) and `sharp`
- Implemented in `src/lib/firebase/admin-adapters.ts`; `sharp` is a direct dependency. A live image upload has not yet been exercised.
- Interface: `MediaStorage` in `src/lib/admin/media.ts`. Register with `registerMediaStorage()`.
- `put(path, bytes, "image/webp")` → bucket object, returning a public or long-lived URL suitable for the storefront. `delete(path)` → delete.
- Paths: `covers/{bookId}/{imageId}.webp`, `gallery/{bookId}/…`, `homepage/hero/…`.
- Add `sharp` as a direct dependency; it is currently only transitive through Next.

### R8 — Dependencies and scripts (shared `package.json`)
- `firebase` and `firebase-admin` are installed. The admin sign-in form uses the Auth REST API; registration of the production Admin SDK adapters remains in R1, R2, and R7.
- Add `"test:admin": "node --import ./src/lib/admin/__tests__/register.mjs --test src/lib/admin/__tests__/*.test.ts"`. The command works today without a script entry.

---

## 3. Environment variables (admin)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Enable email/password staff sign-in (Auth REST API) and ID-token audience checks |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` | Use the Auth emulator; unsigned emulator tokens are accepted only outside production |
| `BOOKISH_ADMIN_STORE` | `memory` (default outside production) or `firestore` |
| `BOOKISH_ADMIN_DEV_STORE=1` | Allow the memory store under `next start` for local review only |
| `BOOKISH_ADMIN_DEV_SEED=0` | Start the dev store empty |

Provider secrets (Paystack, mNotify) are never read or editable by the admin UI.

---

## 4. Implemented modules (all under `/admin`)

| Module | Route(s) | Server enforcement |
| --- | --- | --- |
| Staff access | `/admin/sign-in`, `/admin/api/session`, `/admin/staff` | Fresh Firebase ID token (≤10 min since sign-in) + `bookish_staff` claim + active profile → opaque httpOnly SameSite=Strict cookie, scoped to `/admin`, 8 h. Only the SHA-256 of the cookie secret is stored. Every request re-checks the session, profile status and `sessionsValidAfter`. Role or status changes end sessions immediately. No self role change, the last owner is protected, sign-out everywhere is available, sign-in/out is audited. |
| Dashboard | `/admin` | Counts of paid orders awaiting action, in transit, low/out of stock, exceptions (order + manual payment + refunds), failed SMS. 30-day paid sales are labelled with their window. |
| Catalogue | `/admin/catalogue`, `/new`, `/{id}`, `/{id}/preview`, `/import` | Book + independent variants. ISBN-10/13 check digits. SKU uniqueness via `create`. ISBN+format+edition duplicates blocked; a deliberate separate listing needs explicit confirmation. Publishing needs a cover with alt text, authors, description, a category and one active priced, weighted variant. Live books can't be edited into an unpublishable state. Search, filter and sort. CSV import does a dry run, then commits only the confirmed file hash in one transaction, as drafts only; existing SKUs are never overwritten. CSV export. |
| Media | `/admin/api/upload` | Auth first. JPEG/PNG/WebP checked by magic bytes, ≤8 MB, re-encoded to WebP ≤1600 px with metadata stripped. Alt text required. Replaced files are deleted after commit; new files are deleted if linking fails. |
| Inventory | `/admin/inventory`, `/admin/inventory/{sku}` | Append-only ledger. Variants are created at zero. `STOCK_RECEIVED` needs a reference. Adjustments (damage, correction, return, offsite sale) need a reason and reference. Changes that would go negative or below reserved stock are blocked. Low-stock thresholds, CSV exports, and cost/valuation only for `finance.view`. |
| Orders | `/admin/orders`, `/{id}`, `/{id}/slip`, `/new` | Payment and fulfilment are kept separate. State machine `new → picking → packed → dispatched → delivered`, plus cancel, return and exception, each recording actor and time. Picking or later needs verified payment. A stale-page guard (`expectedFrom`) and idempotency keys protect transitions. Dispatch requires a courier. Notes, courier/tracking and a printable slip. Manual sales use the same ledger, reprice server-side, require evidence, and become paid only after `payments.approve_manual`. Refunds go through R5. A paid order can't be cancelled before a refund starts. |
| Delivery | `/admin/delivery` | Versioned rates (an edit creates v+1 and retires the old one, so orders keep their `rateId`/`rateVersion`). City-specific rates beat region-wide ones. Quote preview for 10 sample Ghana destinations plus custom input. Coverage gaps by region. Same-day estimates are only allowed for named cities. |
| Promotions | `/admin/promotions` | Code, fixed/percent, minimum order, categories, usage limits, dates, active state. `usedCount` is read-only. |
| Homepage CMS | `/admin/content` | Draft vs published hero, announcement, featured shelves, Ghanaian picks, trust and delivery copy, hero image with alt text, categories (name, order, visibility). Publishing blocks unpublished books and off-site CTA links. |
| Settings | `/admin/settings` | Support contacts, fulfilment origin, returns link, default low-stock threshold, checkout and SMS switches (audited). No secret editing. |
| Customers | `/admin/customers` | Derived from orders. Contact details only with `customers.view_contact`, otherwise masked. |
| SMS log | `/admin/notifications` | Event, status, campaign ID, attempts, masked recipient. Retry only `failed`. |
| Reports | `/admin/reports`, CSV exports | Sales by day, variant, category, region and channel; payments/refunds; stock movements; low stock; median time from paid to dispatched/delivered. Revenue counts only verified-paid orders, in integer pesewas. Assumptions are shown on screen. |
| Audit | `/admin/audit` | Every privileged change and CSV export, with actor, role, action, entity, reason and request ID. Append-only in the store port. |

Roles → permissions: `src/lib/admin/permissions.ts`; the same list is shown at `/admin/staff`.

---

## 5. Firebase rules and indexes the shared owner needs

**Rules (default deny).** No client reads or writes on `adminProfiles`, `adminSessions`, `inventory`, `stockMovements`, `orders`, `payments`, `notifications`, `auditEvents`, `idempotencyKeys`, `deliveryRates`, `promotions` or `siteSettings`. All admin access goes through server code with the Admin SDK. Public reads only for `books` where `status == "published"`, and for `categories` where `published == true`. **`bookVariants` must not be client-readable as-is, because it contains `costPesewas`.** Serve variants through the server reader (R4), or mirror them to a public collection without cost. Do the same for `siteContent` (mirror `.published` to e.g. `publicContent/homepage`). Storage: no client writes; public read only for `covers/`, `gallery/` and `homepage/`.

**Composite indexes used by admin queries:**
- `stockMovements`: `sku ASC, createdAt DESC`; `orderId ASC, createdAt ASC`
- `notifications`: `orderId ASC, createdAt ASC`; `status ASC, createdAt DESC`
- `auditEvents`: `entityId ASC, at ASC`
- Single-field equality queries (`books.slug`, `books.status`, `bookVariants.bookId`, `bookVariants.isbn`, `orders.paymentStatus`, `promotions.code`, `categories.slug`, `deliveryRates.active`) use automatic indexes.

**Scale note.** The list screens currently read whole collections and filter in memory. That suits a launch catalogue of a few thousand SKUs and orders. Server-side pagination and Firestore-side filters should follow once volumes grow.

---

## 6. Verification evidence (2026-10-08)

All checks below used the **development in-memory store and fixture staff accounts**. No Firebase emulator, Paystack or mNotify call was made.

- `node --import ./src/lib/admin/__tests__/register.mjs --test src/lib/admin/__tests__/admin.test.ts`: **21/21 pass**. Covered: money parsing; ISBN validation; CSV quoting and formula neutralising; viewer/support/fulfilment denied direct op calls; no self-promotion; last owner protected; suspending ends sessions; book → variant at zero → `STOCK_RECEIVED` → cover → publish → storefront contract; duplicate SKU and ISBN+format rejected; **two concurrent removals cannot go negative and movement IDs stay unique**; duplicate key replays without re-applying; can't go below reserved; **paid order new→delivered with 4 audit events and exactly one SMS per event**; **unpaid order cannot be picked or dispatched**; cancel releases reservation; paid cancel needs a refund; Paystack refund stays `refund_pending`; manual sale reserves, then commits after approval; website orders can't be marked paid by staff; **rate edit creates v2 and leaves a paid order's total untouched**; **reports exclude unpaid orders and stay in integer pesewas**; only failed SMS retry, with masked recipients; CSV dry run, then commit of the confirmed hash only, as drafts.
- `next build` (Next 16.4.0, Turbopack, TypeScript): **passes**; all admin routes are dynamic.
- Browser, on the running dev server:
  - As catalogue editor: created a book and variant, received 15 units (a double-click recorded one movement), uploaded a cover (re-encoded to a 10 KB WebP), previewed and published.
  - As fulfilment: unpaid order blocked; paid order picked, packed, dispatched (double-click → one transition, one SMS) and delivered.
  - As viewer: direct `POST /admin/api/upload` → 403, `GET /admin/api/export/audit` → 403, staff page shows permission denied.
  - Unauthenticated: API → 401, pages → redirect to sign-in.
  - Earlier production check before the shared adapter existed: no dev sign-in; `/admin` → `sign-in?reason=unavailable` with the R1 message; dev media → 404.
- Current production build with Firestore selected: `/admin` redirects to `/admin/sign-in?reason=` without an adapter error; sign-in renders the email/password form. A real Owner password sign-in still needs an end-to-end check by the account holder.
- Layout: every admin page measured with no horizontal document overflow at **320 px and 768 px**, and key pages also at 390 px. Desktop reviewed at 1440 px. The phone drawer opens and closes with Escape. Visible focus ring; labels on all inputs; stacked table cards on phones.

**Not verified:** live Firestore admin transaction flows and indexes, real staff password sign-in, live Storage upload URLs, Paystack verify/refund, mNotify send and delivery reports, emulator-backed rules tests. The 21 existing admin tests use the development store.

---

## 7. Known limitations / follow-ups

1. The development store is in-memory and per process. It resets on restart, and dev uploads live in memory.
2. No list pagination yet (see the scale note).
3. Website-order exception kinds (`late_payment_no_stock`, `payment_mismatch`) are displayed but raised by shared commerce. The admin raises `other` exceptions only.
4. A website order containing the same SKU on two lines would write that SKU's inventory twice in one transaction on cancel or restock. Checkout should merge duplicate lines (the manual sale form already prevents this).
5. Partial refunds don't partially restock. Stock moves only through cancel or return.
6. Customer search over masked fields is name/order-ref only for roles without contact permission, by design.

---

## 8. Shelves, condition and bundles (2026-10-09)

Agreed with the owner: shelves describe *what* a book is; *condition* is per variant.

- **Shelves** (`src/lib/admin/recommended-categories.ts`): Baby & Toddler Books, Phonics & Early Readers, Story Collections, Chapter Books, Pre-Teens & Teens Novels, Activity Books, Educational Resources, Educational & Reference Books, Christian Literature, Bundle Deals. The storefront (homepage tiles, shop filters, nav, footer) reads visible categories from the store in admin order (`loadPublicCategories`). It falls back to this list only when no category exists. Old shelves (puzzles, games, ghanaian…) are flagged on Admin → Categories with a one-click "Hide the old shelves".
- **Condition** on `bookVariants`: `condition` = `new | preloved | mixed` (mixed is for bundles only), `conditionGrade` = `like_new | very_good | good` (required for preloved), plus optional `conditionNote`. Records without `condition` are treated as `new`. One title can be sold new and preloved from one page; duplicates are judged on ISBN + format + condition + grade + edition. Order lines store `format` as the full option label ("Paperback · Preloved · Very good") plus `condition`/`conditionGrade`.
- **Bundles**: a variant with format `Bundle`, an optional `compareAtPesewas` ("worth"; must be above the price) and `bundleItems[] { sku?, title, quantity }`. Linked SKUs can be made up from stock (`assembleBundles`) or unpacked (`unpackBundles`). Each runs in one transaction and writes `BUNDLE_ASSEMBLED` / `BUNDLE_UNPACKED` movements on the bundle and every linked SKU. Linked contents can't change while bundles are made up. Bundles can't be CSV-imported or nested.
- **Query used**: `bookVariants where format == "Bundle"` (single-field index, automatic).
- **Live data step**: the live Firestore has no categories yet. An owner should press "Add the recommended shelves" once on Admin → Categories.

## 9. Preview release status (2026-10-09)

The current source adds Admin → Categories, visible-shelf storefront navigation, condition-based variants, bundle assembly, and checkout exception handling. A book cannot save missing category IDs or publish without a visible category. Hidden categories no longer appear on public book filters. A successful Paystack charge with a mismatched amount, or a late charge without stock, now reports **needs review** instead of confirming fulfilment; amount mismatches release reserved stock. These paths are covered by in-memory tests.

This is a **browse-only preview**, not a commerce launch. Keep checkout and transactional SMS disabled. The Paystack Secret Manager entry has no version, so the App Hosting binding is omitted until a real key is provisioned. The mNotify sender and delivery-status worker are not connected, so the admin SMS switch refuses activation. The Paystack refund adapter is not registered, and unpaid-order reservation sweeping has no scheduled job. Those three worker/integration gaps must be closed and tested before accepting online orders.

The owner must add verified catalogue items with their own photos, prices, stock counts and delivery rates. The first owner must also complete a signed-in admin walkthrough (category setup, book upload, stock receipt, order review), because in-memory tests and route checks cannot verify those live Firebase operations. No sample books or rates should be inserted into production.
