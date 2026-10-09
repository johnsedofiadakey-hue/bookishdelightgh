# Claude Code assignment — Bookish Delight admin portal

You are implementing the operational admin portal for Bookish Delight Ghana. Read `PROJECT_PLAN.md` and `BRAND_GUIDE.md` in full first, then inspect the repository and working-tree status before any edits. Treat Codex's public UI work as active user work. Do not overwrite it. The older `mockup/` is superseded. Your task is to deliver a working, secure admin surface integrated with the shared Firebase commerce model, not a static dashboard demonstration.

## Business facts to preserve

- Physical books for all ages; owned stock only.
- GHS online payment through Paystack; nationwide Ghana delivery quoted before payment.
- mNotify handles transactional SMS after committed order events.
- Staff need a clear order and stock audit trail.
- No customer can purchase a variant whose available quantity is zero. No admin action may invent a paid Paystack state.

## Your file boundary

You own `src/app/admin/**`, `src/app/api/admin/**`, `src/components/admin/**`, `src/lib/admin/**`, and admin-specific tests. You may add admin-only CSS and assets under those paths. Codex owns storefront routes/components and the shared commerce layer (`src/lib/contracts`, `src/lib/commerce`, `src/lib/firebase`, non-admin `src/app/api`, Firebase rules/config, package/config). Implement server-checked admin API routes under your ownership; do not rely on browser-only permission checks. Do not modify shared-owned files or the mockup without recording an interface request and receiving coordination. Never change storefront UI to make the admin compile. If a shared module is missing, add a typed admin-side adapter interface, document what the shared owner must supply, and keep any temporary fixture visibly development-only.

Inspect a selected existing commerce admin as read-only reference for useful workflows, not as source to copy wholesale. Candidate references on this machine are `/Users/truth/Developer/oh-my-kitty-commerce`, `/Users/truth/Developer/SkinMatrix`, and `/Users/truth/Developer/Aves Touch Beauty`. The Bookish Delight data model and visual identity take precedence.

## Admin routes and modules

Build a responsive, practical `/admin` with desktop sidebar and usable phone/tablet navigation. Include clear loading, empty, error, and permission-denied states. Use confirmation only for destructive actions. Keep primary workflows fast and keyboard accessible.

### 1. Staff access

- Firebase Auth sign-in; only explicitly provisioned staff may enter.
- Server verifies the Firebase ID token/session and checks a coarse custom claim plus an active `adminProfiles/{uid}` record for each protected request.
- Roles: owner, manager, catalogue editor, fulfilment, support, viewer. Permissions are enforced in server operations, not just hidden buttons.
- Owner can manage staff and roles. No self-promotion, public signup to admin, or hard-coded email allowlist.
- Session expiry, sign-out, revoked user handling, and an audit trail for privileged changes.

### 2. Dashboard

- Cards for paid orders awaiting action, orders in transit, low/out-of-stock variants, payment/stock exceptions, and failed SMS.
- Recent orders table with status, value, date, destination, and quick link.
- Metrics explicitly name their date window and exclude unpaid/cancelled orders from sales totals.
- No invented live revenue or stock figures. Empty states explain how to add the first book.

### 3. Catalogue

- Create/edit/archive books and their independent format/edition variants.
- Fields: title, slug, author(s), ISBN (optional but validated when provided), publisher, description, language, format, age band, genre/category, tags, cover/gallery images, SEO title/description, SKU, weight, price in GHS, publish state, and related books.
- Prevent duplicate SKU and unintended duplicate ISBN/format combinations; permit different editions of one title.
- Draft preview before publishing; never publish a book without required sellable variant fields and a cover.
- Search/filter/sort catalogue by title, ISBN, author, category, status, stock, and recent updates.
- Upload/compress cover images to Firebase Storage with file type/size checks, alt text, replacement and orphan cleanup policy. Do not embed base64 images in Firestore.
- Bulk CSV import/export with dry-run validation, row errors, and explicit confirmation before writes. Never seed sample products into production.

### 4. Inventory

- Show on-hand, reserved, available, low-stock threshold, and stock movement history per SKU.
- Receive new stock through an append-only `STOCK_RECEIVED` movement; create a variant at zero before receiving its opening quantity.
- Allow adjustments for damage, correction, return-to-stock, and offsite/manual sale, each with a required reason, actor, reference, and timestamp.
- Use server transactions; no direct client write to `inventory` or movement deletion. Block changes that would make stock negative or conflict with reservations.
- Low-stock/out-of-stock list and CSV export. Do not expose cost/valuation to roles without financial permission.

### 5. Orders and fulfilment

- Separate payment state from fulfilment state throughout the UI.
- Order list filters: payment, fulfilment, date, customer, order ref, destination, exceptions, and courier.
- Detail view: immutable line-item/price/delivery snapshot, customer/address, payment reference/status, stock reservation/fulfilment history, SMS log, staff notes, and audit events.
- Allowed fulfilment sequence: new → picking → packed → dispatched → delivered, with explicit cancellation/return/exception paths. Record actor and time for every transition. Block shipment before verified payment.
- Packing view/printable slip; courier and tracking reference; dispatch date; delivery confirmation and optional proof note.
- Manual/offsite sale workflow for Instagram/WhatsApp orders must use the same stock operations. Clearly distinguish it from Paystack-paid website orders, and require an approved payment record/reason before marking it paid.
- Refund actions initiate a supported server-side process, store Paystack refund references/status, and define whether/when stock returns. Never simulate a refund by editing `paymentStatus` alone.

### 6. Delivery, promotions, and content

- Admin-managed nationwide rate table with region/city matching, weight/order bands, price, service level, estimate, active dates, and version. Show coverage gaps and a quote preview for sample Ghana destinations. Any rate edit creates a new version so existing order snapshots stay intact.
- Promotions: code, fixed/percent discount, eligibility, usage limits, start/end, active state; final validation remains server-side in shared commerce.
- Homepage CMS: hero copy and owner-supplied photography, featured shelves, category order, Ghanaian-reads picks, announcement strip, and trust/delivery copy. Keep publishing controls and image alt text. Do not add generated book, shelf, or shop imagery; a missing photo stays visibly pending until the owner provides one.
- Site settings: support contacts, fulfilment origin, return-policy links, low-stock defaults, and operational toggles. Do not allow arbitrary provider secret editing in the browser.

### 7. Customers, messages, reporting, and audit

- Customer list is an order-derived support view with minimal personal data and role-gated access; search by name, email, phone, or order ref. Do not expose full data in public queries.
- Notification center displays order SMS event, mNotify status, campaign ID, attempts, and masked recipient. Allow safe retry of failed events only; use event keys to prevent duplicate messages.
- Reports: sales by date, title/variant/category, payments/refunds, stock movement, low stock, fulfilment time, delivery destination; CSV export. State assumptions and exclude unpaid orders from revenue.
- Audit screen with actor, action, entity, time, and reason. Audit records are append only and cannot be edited by ordinary staff.
- Staff cannot send marketing SMS through transactional flows. Consent/campaign management is a later, separate feature.

## Shared contract you must follow

- Money is integer pesewas; format to GH₵ only in UI.
- A `book` is editorial identity. A `bookVariant` is the purchasable SKU/edition/format. Inventory is per SKU.
- `available = onHand - reserved`; only server commerce operations mutate these values.
- Orders store snapshots of items, prices, delivery charge, destination, payment reference, and status history. Current catalogue edits cannot rewrite old orders.
- `paymentStatus` and `fulfilmentStatus` are separate enums. Paystack webhook/callback verification is the only automatic path to `paid` for online orders.
- Use idempotency keys for any retried mutation; avoid duplicate stock movements or SMS sends.
- Firestore reads/writes from privileged server code require explicit auth/permission checks because the Admin SDK bypasses security rules.
- mNotify API v2 currently documents `POST /api/sms/quick`, sender registration/status, and campaign delivery reports. Provider calls, keys, and sender ID are server-only. Do not call mNotify directly from admin UI. See https://developer.bms.africa/.

## Implementation sequence

1. Map existing shared types/functions, including `src/lib/contracts/commerce.ts` and `src/lib/firebase/{client,admin}.ts`, and write `ADMIN_INTEGRATION_NOTES.md` listing any missing interfaces. The current Firestore and Storage rules deny all client access; request precise rule changes and tests from Codex before wiring client queries. Keep this note current.
2. Implement staff auth/session gate and admin shell. Prove unauthorised access is denied by server checks.
3. Implement catalogue, variants, media, and inventory movements first; these supply the public shop.
4. Implement orders and fulfilment against the shared commerce state machine.
5. Implement delivery rates and homepage CMS so Codex can bind the storefront to real content.
6. Implement notifications, reporting, support view, staff settings, and audit screen.
7. Run typecheck/build and meaningful emulator-backed tests; inspect desktop and phone-width admin journeys.

## Acceptance evidence

- A staff user with a permitted role can add a book/variant, receive opening stock via ledger, upload a cover, publish it, and see the resulting data contract ready for the storefront.
- A different role is denied an unauthorised server mutation even if it calls the endpoint directly.
- Two concurrent stock changes cannot produce negative availability or duplicate movement IDs.
- A paid order can be picked, packed, dispatched, and delivered with audit entries; an unpaid order cannot be dispatched.
- A delivery rate edit does not change a previously paid order total.
- Duplicate clicks/retries do not duplicate movements, fulfilment transitions, or SMS notifications.
- Report totals exclude unpaid orders and use integer pesewas before formatting.
- Browser review at approximately 1440px, 768px, 390px, and 320px confirms usable tables/forms, no horizontal document overflow, accessible focus, and legible states.
- State clearly which checks used emulator/test credentials and which external Paystack/mNotify behaviors remain unverified. Do not deploy or write production data as part of this assignment.

## Handoff back to Codex and the owner

Report changed files, implemented modules, shared contract requests, tests and browser evidence, current limitations, and any Firebase indexes/rules/configuration needed. Do not call the admin complete if it is only a visual shell. Do not claim payment/SMS/release readiness from a build alone.
