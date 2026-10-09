/**
 * "How this page works" guides shown at the top of every admin page.
 * Matched against the URL path; the first match wins, so specific paths come
 * before their parents. Keep each guide short: what the page is for, the
 * usual steps, and anything that is easy to get wrong.
 */

export interface AdminGuide {
  id: string;
  match: RegExp;
  title: string;
  purpose: string;
  steps: string[];
  tips?: string[];
}

export const ADMIN_GUIDES: AdminGuide[] = [
  {
    id: "dashboard",
    match: /^\/admin$/,
    title: "Dashboard",
    purpose: "A daily overview: orders waiting to be packed, recent sales, low stock and failed messages.",
    steps: [
      "Start each day here. Anything that needs action has a count or a link.",
      "Click an order to open it, or a stock warning to restock that item.",
      "Use the menu on the left (or “Menu” on a phone) to move between sections.",
    ],
    tips: ["Numbers only count paid orders. Orders still waiting for payment are not included in sales."],
  },
  {
    id: "order-slip",
    match: /^\/admin\/orders\/[^/]+\/slip$/,
    title: "Packing slip",
    purpose: "A printable slip to put in the parcel or hand to the courier.",
    steps: ["Check the items and address.", "Press Print. Choose your printer, or “Save as PDF” to send it digitally."],
  },
  {
    id: "manual-sale",
    match: /^\/admin\/orders\/new$/,
    title: "Record a manual sale",
    purpose: "Record a sale made outside the website: WhatsApp, Instagram, phone or walk-in. It uses the same stock and order records as website orders.",
    steps: [
      "Choose where the sale came from and enter the customer’s name and phone number.",
      "Add each item and quantity. Only items with available stock can be chosen.",
      "Choose delivery (or pickup) so the total includes the right delivery price.",
      "Enter the payment method and evidence, such as the Mobile Money transaction ID, and the exact amount received.",
      "Save. The order gets a BD- number the customer can use on the tracking page.",
    ],
    tips: [
      "The amount received must equal the order total, or the sale is refused.",
      "If your role cannot approve payments, the order waits for an owner or manager to approve it. Stock is held meanwhile.",
    ],
  },
  {
    id: "order-detail",
    match: /^\/admin\/orders\/[^/]+$/,
    title: "Order details",
    purpose: "Everything about one order: items, customer and address, payment, and where it is in fulfilment.",
    steps: [
      "Check the payment badge. Only pick and pack orders marked Paid.",
      "Move the order forward as you work: New → Picking → Packed → Dispatched → Delivered. Each step is saved with your name and the time.",
      "Before Dispatched, enter the courier and their tracking reference. The customer sees both on the tracking page.",
      "Print the packing slip from this page.",
      "Use Staff notes for anything the team should know, such as “customer asked for delivery after 4pm”.",
    ],
    tips: [
      "Cancelling an unpaid order puts its stock back on the shelf automatically.",
      "A paid order cannot be cancelled until a refund has been started.",
      "If something goes wrong (wrong address, damaged item), mark the order as Exception and describe the problem.",
    ],
  },
  {
    id: "orders",
    match: /^\/admin\/orders$/,
    title: "Orders",
    purpose: "All website orders and manual sales in one list.",
    steps: [
      "Use the tabs: “To fulfil” for paid orders to pack, “In transit” for dispatched orders, “Awaiting payment” for unpaid ones.",
      "Search by order number (BD-…), customer name or phone.",
      "Click an order to update its status or add courier details.",
      "“Manual sale” records an order taken on WhatsApp, Instagram, phone or in person.",
      "“Export CSV” downloads the current list for your records or a spreadsheet.",
    ],
    tips: [
      "Payment and fulfilment are separate. Website orders become Paid only when Paystack confirms the payment, never by hand.",
      "Unpaid website orders hold their stock for 30 minutes, then cancel themselves and release it.",
    ],
  },
  {
    id: "catalogue-new",
    match: /^\/admin\/catalogue\/new$/,
    title: "Add a product",
    purpose: "Create a new book, educational resource or bundle. It starts as a draft that customers cannot see.",
    steps: [
      "Enter the title, a description (at least 20 characters) and the age band.",
      "Add the author. Leave it empty for items without one, such as some flashcards or bundles.",
      "Tick one or more shelves (categories) so customers can find it, e.g. Chapter Books.",
      "Save. On the next page, add a variant for each way you sell it (e.g. Paperback · Brand new, Paperback · Preloved), upload a photo and receive stock, then publish.",
    ],
  },
  {
    id: "catalogue-import",
    match: /^\/admin\/catalogue\/import$/,
    title: "Import from a spreadsheet",
    purpose: "Add many products at once from a CSV file, such as an export from Excel or Google Sheets.",
    steps: [
      "Download or copy the column list below and fill one row per format (SKU).",
      "Upload the file and run the check (dry run). Nothing is saved yet.",
      "Fix any rows marked with errors and upload again.",
      "Confirm the import. Products are created as drafts. Add photos and publish them from the Catalogue.",
    ],
    tips: [
      "Imports never overwrite existing SKUs and never publish anything automatically.",
      "condition is new or preloved (blank means new). Preloved rows need a grade: like_new, very_good or good.",
      "categories use the shelf web addresses, e.g. chapter-books; christian.",
    ],
  },
  {
    id: "catalogue-preview",
    match: /^\/admin\/catalogue\/[^/]+\/preview$/,
    title: "Shop preview",
    purpose: "See how this product will look to customers, and what still blocks publishing.",
    steps: ["Check the photo, title, price and description.", "If anything is listed under “Not publishable yet”, go back and fix it."],
  },
  {
    id: "catalogue-edit",
    match: /^\/admin\/catalogue\/[^/]+$/,
    title: "Edit a product",
    purpose: "Manage one product: its details, formats (with prices), photos, and whether customers can see it.",
    steps: [
      "Variants: add one for each way you sell this title, with its own price, stock and SKU. Choose the format (Paperback, Board book…) and the condition: Brand new, or Preloved with a grade (Like new, Very good, Good).",
      "Selling the same title new and preloved? Add both variants to this one product. Customers pick the option on the book page.",
      "Bundle deal? Create a product for the bundle, put it on the Bundle Deals shelf, and add a variant with format “Bundle”. List what’s inside (link books you also stock singly), and optionally what it’s worth bought separately, so customers see the saving.",
      "Cover: upload a clear photo and describe it in the alt text (this helps blind shoppers and search engines).",
      "Stock: open the SKU in Inventory and record the stock you have received.",
      "When the checklist at the top is clear, press Publish. The product appears in the shop straight away.",
    ],
    tips: [
      "Unpublish hides a product without deleting it. Archive takes it out of day-to-day lists.",
      "Shipping weight decides which delivery rate applies, so keep it accurate.",
    ],
  },
  {
    id: "catalogue",
    match: /^\/admin\/catalogue$/,
    title: "Catalogue",
    purpose: "All your products, with their status (Draft, Published, Archived), price and stock.",
    steps: [
      "Press “Add a book” to create a product (books, resources and bundles all start here), or “Import CSV” to add many from a spreadsheet.",
      "Filter by status, category or stock to find what needs work.",
      "Click a product to edit it, add formats and photos, or publish it.",
    ],
    tips: ["Only Published products with a price appear on the website. Drafts are only visible here."],
  },
  {
    id: "categories",
    match: /^\/admin\/categories$/,
    title: "Categories",
    purpose: "The shelves customers browse by, such as Chapter Books or Christian Literature. Visible shelves appear as homepage tiles and shop filters, in the order set here.",
    steps: [
      "If you see “Add the recommended shelves”, press it once. It creates the ten agreed shelves, from Baby & Toddler Books to Bundle Deals.",
      "If you see “Hide the old shelves”, press it to remove Puzzles, Games and other shelves you don’t sell from the website.",
      "To add your own, fill in “Add a category”. The web address is made from the name if you leave it empty.",
      "Assign products to categories when you add or edit them in the Catalogue.",
      "Open a category under “Edit categories” to rename it, change its order or hide it.",
    ],
    tips: [
      "Changing a category’s web address breaks links that already point to it, including the homepage tiles.",
      "Hiding a category does not hide its products. They stay in the shop under “All”.",
      "Brand new and Preloved are not shelves. Set them on each variant; the shop has its own Brand new / Preloved filter.",
    ],
  },
  {
    id: "inventory-sku",
    match: /^\/admin\/inventory\/[^/]+$/,
    title: "Stock for one SKU",
    purpose: "Receive deliveries, correct counts and see every stock change for this item.",
    steps: [
      "Receive stock: enter the quantity and a reference such as the supplier invoice number.",
      "Adjust stock: record damage, a count correction, a return or an offline sale, with a reason.",
      "Low-stock alert: set the number at which this item shows as running low.",
      "Bundles: use “Make up bundles” to move the linked books out of single stock into the bundle. “Unpack” puts them back.",
      "The ledger below lists every change, who made it and why.",
    ],
    tips: ["Stock reserved for unpaid or unshipped orders cannot be adjusted away. Cancel or complete those orders first."],
  },
  {
    id: "inventory",
    match: /^\/admin\/inventory$/,
    title: "Inventory",
    purpose: "Stock for every SKU: on hand, reserved for orders, and available to sell.",
    steps: [
      "Check the Low and Out badges to see what to reorder.",
      "Click a SKU to receive new stock or correct the count.",
    ],
    tips: ["Available = on hand − reserved. Customers can only buy what is available."],
  },
  {
    id: "content",
    match: /^\/admin\/content$/,
    title: "Homepage",
    purpose: "Edit what the website homepage shows: the main banner, announcement strip, featured shelves and Ghanaian stories picks.",
    steps: [
      "Edit the sections, then press “Save draft”. Customers do not see drafts.",
      "Upload a hero image if you have a good shop or product photo.",
      "Pick published products for the featured shelves.",
      "When you are happy, press “Publish homepage”.",
    ],
    tips: ["Category tiles come from the Categories page."],
  },
  {
    id: "promotions",
    match: /^\/admin\/promotions$/,
    title: "Promotions",
    purpose: "Create discount codes, for example for a school partnership or a holiday sale.",
    steps: [
      "Choose a code (e.g. READMORE10), a percent or fixed GH₵ discount, and optional limits and dates.",
      "Leave categories unticked to apply to everything, or tick some to limit the code.",
      "Untick Active to pause a code without deleting it.",
    ],
    tips: ["Discount codes are not yet applied at website checkout. They will work once that step is built."],
  },
  {
    id: "delivery",
    match: /^\/admin\/delivery$/,
    title: "Delivery rates",
    purpose: "The prices customers pay for delivery. Checkout only offers delivery where a rate matches the customer’s region, town and parcel weight.",
    steps: [
      "Add a rate per region (and optionally per town) with a price, weight range and estimated delivery time.",
      "Use the quote preview to test what a customer in a given town would be charged.",
      "Check “coverage gaps”: customers in regions without a rate cannot pay online and are asked to WhatsApp you.",
    ],
    tips: [
      "Editing a rate saves a new version. Orders already placed keep the price they were quoted.",
      "A town-specific rate wins over a region-wide one, so you can make Kumasi cheaper than the rest of Ashanti.",
    ],
  },
  {
    id: "customers",
    match: /^\/admin\/customers$/,
    title: "Customers",
    purpose: "A support view of everyone who has ordered, grouped by phone number. Customers do not have accounts to manage.",
    steps: ["Search by name or order number to find a customer’s orders.", "Click an order to see its details."],
    tips: ["Phone numbers and emails are hidden from roles that do not need them."],
  },
  {
    id: "notifications",
    match: /^\/admin\/notifications$/,
    title: "SMS log",
    purpose: "Order text messages to customers: payment received, dispatched, delivered and cancelled.",
    steps: ["Check for Failed messages.", "Press Retry on a failed message after fixing the cause, such as a wrong number."],
    tips: [
      "Messages are recorded here but not sent until the mNotify SMS connection is set up.",
      "SMS can be switched on or off in Settings.",
    ],
  },
  {
    id: "reports",
    match: /^\/admin\/reports$/,
    title: "Reports",
    purpose: "Sales and stock figures for any date range.",
    steps: [
      "Choose a date range at the top.",
      "Review sales by product, category, region and channel (website or manual).",
      "Download sales, stock movements or low-stock lists as CSV for your accountant or a spreadsheet.",
    ],
    tips: ["Only paid orders count as sales. Refunds are shown separately."],
  },
  {
    id: "audit",
    match: /^\/admin\/audit$/,
    title: "Audit trail",
    purpose: "A permanent record of every important change: who did it, what changed, when and why.",
    steps: ["Search by person, action, order number or reason to answer “who changed this?”.", "Use Export CSV to keep a copy outside the admin."],
    tips: ["Entries cannot be edited or deleted."],
  },
  {
    id: "staff",
    match: /^\/admin\/staff$/,
    title: "Staff & roles",
    purpose: "Decide who can sign in to the admin and what they can do.",
    steps: [
      "To add someone, first create their email sign-in in Firebase Console → Authentication, then grant access here with that email and a role.",
      "Pick the smallest role that lets them do their job. “What each role can do” explains each one.",
      "Suspend someone who leaves, and use “Sign them out everywhere” if a device is lost.",
    ],
    tips: ["Nobody can change their own role, and there must always be at least one Owner."],
  },
  {
    id: "settings",
    match: /^\/admin\/settings$/,
    title: "Settings",
    purpose: "Store-wide settings: support contacts, where parcels are sent from, low-stock level and on/off switches.",
    steps: [
      "Keep support phone, WhatsApp and email up to date. Customers see them.",
      "Set the fulfilment origin to where parcels leave from (Kumasi).",
      "Operational switches: turn Checkout on to take online payments, and SMS on once messaging is set up.",
      "Press “Save settings”.",
    ],
    tips: [
      "Turning Checkout off sends customers to WhatsApp instead. Use it if you need to pause online orders.",
      "Payment and SMS keys are never entered here. They are stored securely on the server.",
    ],
  },
];

export function guideFor(pathname: string): AdminGuide | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return ADMIN_GUIDES.find((guide) => guide.match.test(path)) ?? null;
}
