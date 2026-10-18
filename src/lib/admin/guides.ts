/**
 * "How this page works" guides shown at the top of every admin page.
 * Matched against the URL path; the first match wins, so specific paths come
 * before their parents. Keep each guide short: what the page is for, the
 * usual steps, and anything that is easy to get wrong. Use plain, everyday
 * words that match the labels on the page.
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
    purpose: "Your daily summary: orders to pack, recent sales, low stock and text messages that didn’t send.",
    steps: [
      "Start each day here. Anything that needs you has a number or a link.",
      "Click an order to open it, or a stock warning to add more of that item.",
      "Use the menu on the left (or “Menu” on a phone) to move between pages.",
    ],
    tips: ["Only paid orders are counted. Orders that are not paid yet are not part of sales."],
  },
  {
    id: "order-slip",
    match: /^\/admin\/orders\/[^/]+\/slip$/,
    title: "Packing slip",
    purpose: "A slip to print and put in the parcel, or give to the delivery person.",
    steps: ["Check the items and the address.", "Press Print. Choose your printer, or “Save as PDF” to send it by phone or email."],
  },
  {
    id: "manual-sale",
    match: /^\/admin\/orders\/new$/,
    title: "Add a sale",
    purpose: "Add a sale that didn’t happen on the website: WhatsApp, Instagram, a phone call or someone who walked in. It uses the same stock and order list as website orders.",
    steps: [
      "Choose where the sale happened, then enter the customer’s name and phone number.",
      "Add each item and how many. You can only choose items that are in stock.",
      "Choose delivery (or pick-up) so the total has the right delivery price.",
      "Enter how they paid and the proof, like the Mobile Money transaction ID, and the exact amount you received.",
      "Save. The order gets a BD- number the customer can use to track it.",
    ],
    tips: [
      "The amount received must be the same as the order total, or the sale won’t save.",
      "If your role can’t approve payments, the order waits for the owner or a manager to approve it. The items are held until then.",
    ],
  },
  {
    id: "order-detail",
    match: /^\/admin\/orders\/[^/]+$/,
    title: "Order details",
    purpose: "Everything about one order: the items, the customer and address, the payment, and where the order is now.",
    steps: [
      "Check the payment label. Only pack orders marked Paid.",
      "Move the order along as you work: New → Getting items → Packed → Sent out → Delivered. Each step saves your name and the time.",
      "Before “Sent out”, enter the delivery company and the tracking number. The customer sees both when they track their order.",
      "Print the packing slip from this page.",
      "Use Staff notes for anything the team should know, like “customer wants delivery after 4pm”.",
    ],
    tips: [
      "If you cancel an unpaid order, its items go back into stock by themselves.",
      "You can’t cancel a paid order until you start a refund.",
      "If something goes wrong (wrong address, damaged item), use “Report a problem” and say what happened.",
    ],
  },
  {
    id: "orders",
    match: /^\/admin\/orders$/,
    title: "Orders",
    purpose: "All website orders and other sales in one list.",
    steps: [
      "Use the tabs: “To pack” for paid orders to get ready, “On the way” for orders sent out, “Not paid yet” for unpaid ones.",
      "Search by order number (BD-…), customer name or phone.",
      "Click an order to change its status or add delivery details.",
      "“Add a sale” is for orders taken on WhatsApp, Instagram, phone or in person.",
      "“Download spreadsheet” saves the list for your records.",
    ],
    tips: [
      "Payment and delivery are tracked separately. A website order only becomes Paid when Paystack confirms it. Staff can’t do it by hand.",
      "Unpaid website orders hold their items for 30 minutes. Then they cancel and the items go back into stock.",
    ],
  },
  {
    id: "catalogue-new",
    match: /^\/admin\/catalogue\/new$/,
    title: "Add a product",
    purpose: "Add a new book, learning material or bundle. It starts as a draft that customers can’t see.",
    steps: [
      "Enter the title, a description (at least 20 characters) and the age range.",
      "Add the author. Leave it empty if there isn’t one, like some flashcards or bundles.",
      "Tick one or more shelves (categories) so customers can find it, e.g. Chapter Books.",
      "Save. On the next page, add an option for each way you sell it (e.g. Paperback · New, Paperback · Preloved). Then upload a photo, add stock and publish.",
    ],
  },
  {
    id: "catalogue-import",
    match: /^\/admin\/catalogue\/import$/,
    title: "Import from a spreadsheet",
    purpose: "Add many products at once from a spreadsheet saved as CSV (from Excel or Google Sheets).",
    steps: [
      "Use the column list below. Fill in one row for each option (item code).",
      "Upload the file and press “Check file”. Nothing is saved yet.",
      "Fix any rows with problems and upload again.",
      "Confirm the import. Products are saved as drafts. Add photos and publish them from Products.",
    ],
    tips: [
      "Importing never changes items you already have and never publishes anything by itself.",
      "condition is new or preloved (empty means new). Preloved rows need a grade: like_new, very_good or good.",
      "categories use the shelf web addresses, e.g. chapter-books; christian.",
    ],
  },
  {
    id: "catalogue-preview",
    match: /^\/admin\/catalogue\/[^/]+\/preview$/,
    title: "Preview",
    purpose: "See how this product will look to customers, and what you still need to do before you can publish it.",
    steps: ["Check the photo, title, price and description.", "If anything is listed under “Not ready to publish yet”, go back and fix it."],
  },
  {
    id: "catalogue-edit",
    match: /^\/admin\/catalogue\/[^/]+$/,
    title: "Edit a product",
    purpose: "Manage one product: its details, its options and prices, its photos, and whether customers can see it.",
    steps: [
      "Stock options: add one for each way you sell this title, each with its own price, stock and item code. First pick the shop section (Brand New, Preloved or Bundle Deals), then the type (Paperback, Board book…). Preloved copies also need a grade (Like new, Very good, Good).",
      "Selling the same title new and preloved? Add two stock options to this one product. Customers choose on the book page.",
      "Bundle? Make a product for the bundle and add a stock option with the shop section “Bundle Deals”. It shows under Bundle Deals by itself. List what’s inside (link books you also sell on their own). You can also add the price if bought one by one, so customers see how much they save.",
      "Cover photo: upload a clear photo and write a short description of it. This helps blind shoppers and Google.",
      "Stock: open the item on the Stock page and add the stock you have.",
      "When the list at the top is clear, press Publish. The product shows in the shop right away.",
    ],
    tips: [
      "Unpublish hides a product without deleting it. Archive takes it out of your everyday lists.",
      "The weight decides the delivery price, so keep it correct.",
    ],
  },
  {
    id: "catalogue",
    match: /^\/admin\/catalogue$/,
    title: "Products",
    purpose: "All your products, with their status (Draft, Published, Archived), price and stock.",
    steps: [
      "Press “Add a book” to add a product (books, learning materials and bundles all start here), or “Import spreadsheet” to add many at once.",
      "Filter by status, category or stock to find what needs work.",
      "Click a product to edit it, add options and photos, or publish it.",
    ],
    tips: ["Only Published products with a price show on the website. Drafts only show here."],
  },
  {
    id: "categories",
    match: /^\/admin\/categories$/,
    title: "Categories",
    purpose: "The shelves customers browse, like Chapter Books or Christian Literature. Visible shelves show on the homepage and as shop filters, in the order you set here.",
    steps: [
      "If you see “Add the recommended shelves”, press it once. It adds the eight shelves we agreed on: seven book types (from Baby & Toddler Books to Christian Literature) plus Bundle Deals.",
      "If you see “Hide the old shelves”, press it to take Puzzles, Games and other shelves you don’t sell off the website.",
      "To add your own, fill in “Add a category”. If you leave the web address empty, we make it from the name.",
      "Put products on shelves when you add or edit them in Products.",
      "Open a category under “Edit categories” to rename it, move it or hide it.",
    ],
    tips: [
      "If you change a category’s web address, old links to it stop working, including the homepage boxes.",
      "Hiding a category doesn’t hide its products. They still show in the shop under “All”.",
      "New and Preloved are not shelves. You set them on each option. The shop has its own New / Preloved filter.",
    ],
  },
  {
    id: "inventory-sku",
    match: /^\/admin\/inventory\/[^/]+$/,
    title: "Stock for one item",
    purpose: "Add new stock, fix the count and see every stock change for this item.",
    steps: [
      "Add new stock: enter how many and a reference, like the supplier’s invoice number.",
      "Fix stock count: record damage, a count mistake, a return or a sale made elsewhere, with a reason.",
      "Low stock warning: choose the number at which this item shows as running low.",
      "Bundles: use “Put bundles together” to move the books from single stock into the bundle. “Take bundles apart” puts them back.",
      "The history below shows every change, who made it and why.",
    ],
    tips: ["You can’t take away stock that’s held for orders that aren’t paid or sent yet. Cancel or finish those orders first."],
  },
  {
    id: "inventory",
    match: /^\/admin\/inventory$/,
    title: "Stock",
    purpose: "Stock for every item: how many are on the shelf, how many are held for orders, and how many you can sell.",
    steps: [
      "Look for the Low and Out labels to see what to buy more of.",
      "Click an item to add new stock or fix the count.",
    ],
    tips: ["Available = on the shelf − held for orders. Customers can only buy what is available."],
  },
  {
    id: "content",
    match: /^\/admin\/content$/,
    title: "Homepage",
    purpose: "Change what the website homepage shows: the main banner, the message strip, featured shelves and Ghanaian stories picks.",
    steps: [
      "Make your changes, then press “Save draft”. Customers don’t see drafts.",
      "Upload a banner photo if you have a good photo of the shop or a product.",
      "Choose published products for the featured shelves.",
      "When you’re happy, press “Publish homepage”.",
    ],
    tips: ["The category boxes come from the Categories page."],
  },
  {
    id: "promotions",
    match: /^\/admin\/promotions$/,
    title: "Discount codes",
    purpose: "Make discount codes, for example for a school or a holiday sale.",
    steps: [
      "Choose a code (e.g. READMORE10), a percent or GH₵ amount off, and any limits and dates.",
      "Leave all categories unticked for the code to work on everything, or tick some to limit it.",
      "Untick “Turned on” to pause a code without deleting it.",
    ],
    tips: ["Discount codes don’t work at website checkout yet. They will once that part is built."],
  },
  {
    id: "delivery",
    match: /^\/admin\/delivery$/,
    title: "Delivery prices",
    purpose: "What customers pay for delivery. Customers can only pay online if there is a price for their region, town and parcel weight.",
    steps: [
      "Add a price for each region (and, if you like, for certain towns) with a weight range and how long delivery takes.",
      "Use “Check a price” to see what a customer in a town would pay.",
      "Look for missing places: customers in regions with no price can’t pay online and are asked to WhatsApp you.",
    ],
    tips: [
      "Editing a price saves a new version. Orders already placed keep the price they were given.",
      "A price for a town is used before a price for the whole region, so you can make Kumasi cheaper than the rest of Ashanti.",
    ],
  },
  {
    id: "customers",
    match: /^\/admin\/customers$/,
    title: "Customers",
    purpose: "Everyone who has ordered, grouped by phone number, so you can help them. Customers don’t have accounts.",
    steps: ["Search by name or order number to find a customer’s orders.", "Click an order to see it."],
    tips: ["Phone numbers and emails are hidden from roles that don’t need them."],
  },
  {
    id: "notifications",
    match: /^\/admin\/notifications$/,
    title: "Text messages",
    purpose: "Order text messages sent to customers: payment received, sent out, delivered and cancelled.",
    steps: ["Look for messages marked Failed.", "Fix the problem (like a wrong number), then press “Try again”."],
    tips: [
      "Messages are saved here but not sent until mNotify is connected.",
      "You can turn text messages on or off in Settings.",
    ],
  },
  {
    id: "reports",
    match: /^\/admin\/reports$/,
    title: "Reports",
    purpose: "Sales and stock numbers for any dates you choose.",
    steps: [
      "Choose the dates at the top.",
      "See sales by product, category, region and where it was sold (website or not).",
      "Download sales, stock changes or low-stock lists as a spreadsheet for your accountant.",
    ],
    tips: ["Only paid orders count as sales. Refunds are shown separately."],
  },
  {
    id: "audit",
    match: /^\/admin\/audit$/,
    title: "Activity log",
    purpose: "A record of every important change: who did it, what changed, when and why. It can’t be changed.",
    steps: ["Search by person, action, order number or reason to find out “who changed this?”.", "Use “Download spreadsheet” to keep a copy."],
    tips: ["Entries can’t be edited or deleted."],
  },
  {
    id: "staff",
    match: /^\/admin\/staff$/,
    title: "Staff",
    purpose: "Choose who can sign in to the admin and what they can do.",
    steps: [
      "To add someone, first create their email sign-in in the Firebase console (Authentication). Then add them here with that email and a role.",
      "Give each person the smallest role that lets them do their job. “What each role can do” explains each one.",
      "Pause someone who leaves, and use “Sign them out everywhere” if they lose a phone or laptop.",
    ],
    tips: ["Nobody can change their own role, and there must always be at least one Owner."],
  },
  {
    id: "settings",
    match: /^\/admin\/settings$/,
    title: "Settings",
    purpose: "Settings for the whole shop: contact details, where orders are sent from, the low stock level and on/off switches.",
    steps: [
      "Keep the phone, WhatsApp and email up to date. Customers see them.",
      "Set “Where orders are sent from” to where parcels leave (Kumasi).",
      "On/off switches: turn on online payment to take payments, and text messages once mNotify is set up.",
      "Press “Save settings”.",
    ],
    tips: [
      "If you turn online payment off, customers are sent to WhatsApp instead. Use it to pause online orders.",
      "Payment and text message keys are never entered here. They are stored safely on the server.",
    ],
  },
];

export function guideFor(pathname: string): AdminGuide | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return ADMIN_GUIDES.find((guide) => guide.match.test(path)) ?? null;
}
