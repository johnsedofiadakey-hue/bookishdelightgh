# Bookish Delight GH — brand and contact reference

The owner supplied the official logo and business details on 2026-10-08. Treat the image as the source of truth for the mark and lettering. Do not redraw or replace it with a generated imitation.

## Assets

- Original logo: `public/brand/bookish-delight-logo-original.jpeg`. Keep this file unchanged.
- The storefront hero uses `public/brand/bookish-hero-editorial.webp`, a clearly illustrative open-book image approved for the visual refresh. It does not depict the shop or a stocked title. Replace it with the owner's actual book or shop photography when suitable images arrive; never present generated or unrelated photos as this business or its inventory.
- The storefront header crops the exact original mark for a compact lockup. `src/app/icon.tsx` and `src/app/apple-icon.tsx` render the same mark for browser and home-screen icons.
- `src/app/opengraph-image.tsx` renders the official full logo in share previews. Set `NEXT_PUBLIC_SITE_URL` to the approved public domain when building for deployment; social sharing cannot be tested by WhatsApp or other crawlers against a local address.

## Visual system

Use golden yellow as a brand accent. Cobalt blue carries primary actions and anchors legibility. Keep the main reading surfaces white or warm off-white with dark ink text. Prioritise the owner's real book, shelf and shop photography when provided. Use only restrained interaction motion; honour reduced-motion preferences and keep checkout and stock information calm and clear.

Approximate web palette from the supplied image:

| Role | Hex |
| --- | --- |
| Gold | `#E8AF2F` |
| Cobalt | `#2879C7` |
| Coral | `#EC6638` |
| Plum | `#77449B` |
| Berry | `#C64668` |
| Ink | `#172547` |
| Warm paper | `#FFFCF5` |

## Business details

- Name: Bookish Delight GH
- Tagline: “Nurturing young minds one book at a time”
- WhatsApp: `024 447 0293` / `https://wa.me/233244470293`
- Address: Atonsu–Feyiase, Off Lake Road, Kumasi, Ashanti Region
- GhanaPost GPS: `AT-1317-5556`
- Postal address: P.O. Box 63, KNUST

`src/lib/brand.ts` holds the public storefront constants. These business details do not by themselves confirm customer pickup hours or the fulfilment origin for nationwide delivery. Do not advertise walk-in pickup until the owner confirms it.

## Admin handoff

Claude Code owns the admin interface. Apply the official mark and palette to the admin sign-in and shell while preserving the fast, practical operations UI. The public storefront uses the logo now; admin branding remains in Claude's ownership area.
