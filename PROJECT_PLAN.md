# Bookish Delight Ghana — product and build plan

Status: agreed direction, implementation in progress. This document is the shared contract for Codex (public storefront and commerce integration) and Claude Code (admin portal). It does not certify a live store.

## 1. Confirmed business brief

- Sell children’s books and educational resources online — picture books, storybooks, workbooks, flashcards, puzzles, educational games and more — to parents, teachers and schools. (Owner correction, 2026-10-09: the focus is children, not readers of all ages.)
- Storefront categories: `picture-books`, `storybooks`, `learning`, `puzzles`, `games`, `ghanaian`. Admin category slugs must match. Puzzles and games may have no author or ISBN.
- Books shown as purchasable are owned stock. Do not take payment for an unavailable book or imply that an unstocked book is ready to ship.
- Accept online payment at checkout, initially Paystack in GHS with available Ghana mobile money and card channels.
- Offer delivery nationwide from launch. Every supported destination needs a known delivery price before payment.
- Use Firebase as the application platform and mNotify for transactional SMS.
- The older `mockup/` is a superseded visual reference. Its titles, covers, authors and prices are illustrative and must not be published as stock.
- The owner has supplied the official Bookish Delight GH logo, tagline, WhatsApp number, and Kumasi business address. Use `BRAND_GUIDE.md` and the exact original logo asset for all public branding.

## 2. Product experience

### Customer journeys

1. Discover books through the homepage, category and age shelves, Ghanaian reads, search, and editorial picks.
2. Find a book by title, author, ISBN, or genre; filter by category, age, format, price, and in-stock status.
3. Review a book page with its actual edition/format, ISBN if available, author, description, cover, GHS price, stock status, and delivery information.
4. Add only available variants to a persistent cart; review item and delivery totals before payment.
5. Guest checkout with name, phone, email, Ghana region/city, address, GhanaPost GPS or landmark, and delivery notes. Account creation is optional after purchase.
6. Confirm payment and receive an order reference. View status through a secure private link or a verified contact method.
7. Receive transactional SMS for paid order, dispatch, and delivery. Marketing messages require separate opt-in and are outside the initial release.

### Public routes

| Route | Purpose |
| --- | --- |
| `/` | Brand hero, discovery shelves, categories, Ghanaian reads, trust and delivery information |
| `/shop` | Search, filtering, sorting, pagination, in-stock state |
| `/books/[slug]` | Edition-aware detail page, availability, recommendations |
| `/cart` | Editable basket and pre-checkout summary |
| `/checkout` | Address, delivery quote, final total, Paystack handoff |
| `/order/[token]` | Private confirmation and order status |
| `/delivery`, `/returns`, `/privacy`, `/terms`, `/contact` | Clear support and policy pages |

### Design direction

White and warm off-white surfaces, dark ink typography, logo colours, genuine business photography when supplied, and real book-cover images for actual listings. Desktop and mobile must each feel designed. Keep search, price, stock, delivery, and checkout exceptionally clear. The original generated shop scene and fictional sample catalogue were removed. The current homepage uses a clearly illustrative open-book artwork; it does not imply any particular book is in stock. Add books only from verified stock. Motion is restrained, respects reduced-motion settings, and never slows browsing.

## 3. Technical architecture

- One Next.js App Router and TypeScript application at the repository root. Public routes use `src/app/(storefront)`. Admin routes use `src/app/admin`. Route handlers use `src/app/api`.
- Firebase App Hosting is the proposed deployment target for the Next.js server-rendered application; confirm its current supported framework version and project setup before rollout.
- The local app currently uses Next.js 16.4 because its installed dependency tree passes the high-severity audit. App Hosting's published active Next.js support should be rechecked against this version before staging; if needed, choose a supported target or another Firebase-compatible server host without weakening the dependency baseline.
- Firebase Auth secures staff access. Custom claims provide coarse roles; a server-side permission check guards each admin action. Staff profile details live in Firestore, not claims.
- Cloud Firestore owns catalogue, stock, orders, content, delivery rules, promotions, audit history, and notification records. Cloud Storage owns uploaded covers and site media.
- Server-only code initializes Paystack, verifies payments, calculates prices and delivery, manages stock reservations, and calls mNotify. Never put provider secret keys in client bundles or public Firestore documents.
- Firestore and Storage rules default deny. Public reads are limited to published catalogue and approved site content. Customer order data is never publicly readable by ID.
- The current rules are fully closed while the storefront catalogue is empty. Open narrowly reviewed read paths only when real Firestore queries and authorisation tests exist.
- Development/emulator, staging, and production configurations remain separate. No real payment, SMS, production write, or deployment is implied by a local build.

### Repository ownership during parallel work

| Area | Owner |
| --- | --- |
| `src/app/(storefront)`, `src/components/storefront`, storefront styles/assets | Codex |
| `src/app/admin`, `src/app/api/admin`, `src/components/admin`, `src/lib/admin` | Claude Code |
| `src/lib/contracts`, `src/lib/commerce`, `src/lib/firebase`, non-admin `src/app/api`, Firebase rules/config, root package/config | Codex; coordinate proposed changes before editing |
| `mockup/` | Visual reference; Codex |

The admin must consume shared types and commerce functions, not create a second incompatible order or inventory model. If a needed shared contract is missing, Claude records the requested interface in a handoff note and may implement a typed adapter locally, but must not invent a production write path that bypasses server validation.

## 4. Data and state contract

All monetary amounts are integer pesewas. Store GHS as the currency code. Store timestamps as Firestore timestamps. Use stable IDs and schema version fields where migrations may be needed.

| Collection | Essential fields / role |
| --- | --- |
| `books/{bookId}` | Title, slug, authors, ISBN, publisher, description, category IDs, age band, tags, image refs, status `draft/published/archived`, SEO fields |
| `bookVariants/{sku}` | `bookId`, format/edition, ISBN if applicable, `pricePesewas`, `weightGrams`, active state; SKU is unique |
| `inventory/{sku}` | `onHand`, `reserved`, computed availability, low-stock threshold; server-owned |
| `stockMovements/{id}` | SKU, type, quantity delta, reason, actor, reference, timestamp; append only |
| `categories/{id}` | Name, slug, image/art, order, published state |
| `siteContent/{id}` | Hero, featured shelves, banners, trust copy, delivery explanation, approved images |
| `deliveryRates/{id}` | Service area, region/city matching rule, weight or order bands, price, estimated range, active state, version |
| `orders/{id}` | Customer/contact/address snapshot, line-item/price/delivery snapshots, totals, payment and fulfilment state, public tracking token hash, timestamps |
| `payments/{id}` | Order ID, Paystack reference, amount, currency, provider status, verification history, refund references; server-owned |
| `notifications/{id}` | Event key, order ID, recipient, template/version, status, mNotify campaign ID, attempts, error metadata |
| `adminProfiles/{uid}` | Name, role, granular permissions, status, last activity |
| `auditEvents/{id}` | Actor, action, entity, before/after summary, request ID, timestamp; append only |

Do not put mutable stock quantity solely inside a book document. A book may have different ISBNs/editions and independent stock. Do not overwrite payment or order snapshots when the current catalogue price changes.

### Payment and inventory lifecycle

1. The server recalculates cart lines from active variants, validates quantities and destination, and quotes delivery. Client-supplied prices and delivery amounts are ignored.
2. A Firestore transaction creates a pending order and reserves available stock for a bounded payment window. Use a unique idempotency key so retries do not create duplicate orders.
3. The server initializes Paystack for the exact GHS amount and stores its reference. The customer pays through Paystack.
4. Callback and webhook both enter one idempotent verification path. Validate webhook HMAC, then verify reference, status, amount, currency, and matching order before marking paid. A browser redirect alone is never proof of payment.
5. In a transaction, convert reservation to sold stock once. An expiry worker releases unpaid reservations; late successful payment becomes an explicit stock exception for staff resolution, never a silent oversell.
6. After the committed paid state, enqueue SMS. SMS failure cannot reverse a paid order. Retry from the notification record without duplicating already-sent events.
7. Keep `paymentStatus` separate from `fulfilmentStatus`. Admin actions may move fulfilment forward, but never manually forge a successful Paystack payment.

### Nationwide delivery contract

The initial operational model is one fulfilment origin and a maintained destination rate table. Checkout must show an exact delivery price before opening Paystack. Record region, city/town, address, GhanaPost GPS when available, landmark, phone, service level, and the quoted rate ID/version on the order. If a destination cannot be priced, block payment and offer a contact route. Staff may later add a courier name, parcel reference, dispatch date, and delivery proof. A courier API is optional only after a partner and rate contract are chosen. Do not advertise universal same-day delivery.

## 5. Admin operating surface

The admin is a practical, fast tool for daily staff work. The initial release includes dashboard, catalogue/variants, image upload, categories, inventory receiving and adjustments, low-stock alerts, online orders, manual/offsite sales that deduct stock, delivery rates, homepage curation, promotions, customer support view, SMS status/retry, reports/export, staff roles, settings, and audit log. Full POS hardware, publisher marketplace, subscriptions, ebooks, and AI recommendations are later phases unless explicitly approved.

See `CLAUDE_ADMIN_PORTAL.md` for the complete admin instruction and acceptance criteria.

## 6. Work sequence and review gates

1. **Contract and design:** agree data schema, delivery-rate model, route ownership, visual system, and real launch catalogue shape. Show desktop/mobile screens for review.
2. **Foundation:** initialize Next.js/Firebase project, emulators, rules, typed adapters, an empty public catalogue, and staff role bootstrap. Never copy credentials from another project.
3. **Storefront and admin:** Codex builds public screens and accessible journeys. Claude builds admin screens and secured operations against the shared contract.
4. **Commerce:** implement server cart repricing, reservation, Paystack verification, order state machine, delivery quote, and mNotify outbox.
5. **Validation:** typecheck/build; rules and stock/payment tests; desktop and phone-width browser review; test payment success/failure/duplicate callbacks; test SMS to an approved number; reconcile one sample order through packing and dispatch.
6. **Launch gate:** approved real catalogue and media, real delivery rate card, privacy/returns/support copy, business-owned accounts and sender ID, backups, monitoring, staging review, then a separate production release decision.

## 7. Current open inputs

- Firebase project `bookishdelightghh` has its default Firestore Standard database and default Storage bucket in `europe-west4` (Netherlands), created on 2026-10-09. The owner selected this region for the planned App Hosting setup. Firestore deletion protection is enabled; Firebase rules remain closed until reviewed data flows and tests exist.
- Actual book inventory export or at least 10–20 representative books with covers, formats, prices, and quantities.
- Approval of the refreshed public UI on desktop and phone widths. The original logo is supplied and used. Owner book, shelf and shop photos are still needed.
- Fulfilment origin, courier partner(s), destination/rate card, delivery estimates, and returns process.
- Whether Paystack and mNotify business accounts and an approved mNotify sender ID already exist. Never place credentials in chat or source files.
- Which earlier ecommerce admin is the closest operational reference; the codebase should be inspected read-only before reusing ideas.

## 8. Primary implementation references

- Firebase App Hosting for Next.js: https://firebase.google.com/docs/app-hosting
- Firebase custom claims: https://firebase.google.com/docs/auth/admin/custom-claims
- Firestore transactions: https://firebase.google.com/docs/firestore/manage-data/transactions
- Paystack accepting payments: https://paystack.com/docs/payments/accept-payments/
- Paystack webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack verification: https://paystack.com/docs/payments/verify-payments/
- mNotify/BMS API v2: https://developer.bms.africa/
