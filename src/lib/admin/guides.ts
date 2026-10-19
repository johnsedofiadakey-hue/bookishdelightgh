/**
 * "How this page works" guides shown at the top of every admin page, and
 * collected on the Help page.
 *
 * Matched against the URL path; the first match wins, so specific paths come
 * before their parents. Write for a busy shop owner: short sentences, everyday
 * words, and button names exactly as they appear on the page.
 */

export interface GuideButton {
  /** The button or link text exactly as it appears on the page. */
  label: string;
  /** What happens when you press it. */
  does: string;
}

export interface AdminGuide {
  id: string;
  match: RegExp;
  title: string;
  /** Where to find the page, shown on the Help page. */
  href: string;
  purpose: string;
  steps: string[];
  buttons?: GuideButton[];
  tips?: string[];
}

export const ADMIN_GUIDES: AdminGuide[] = [
  {
    id: "help",
    match: /^\/admin\/help$/,
    title: "Help",
    href: "/admin/help",
    purpose: "Every page’s guide in one place, plus the steps to get the shop ready.",
    steps: [
      "New here? Follow “Getting started” from top to bottom.",
      "Need help with one page? Find it in the list below, or open the page and read the blue box at the top.",
    ],
  },
  {
    id: "dashboard",
    match: /^\/admin$/,
    title: "Dashboard",
    href: "/admin",
    purpose: "Your daily summary: orders to pack, recent sales and items running low.",
    steps: [
      "Start each day here.",
      "Each box shows a number. Click a box to see the orders or items behind it.",
      "Use the menu on the left (or “Menu” on a phone) to go to other pages.",
    ],
    buttons: [
      { label: "Add a book", does: "Starts a new product." },
      { label: "Add a sale", does: "Records a sale made on WhatsApp, Instagram, by phone or in person." },
      { label: "Any number box", does: "Opens the list behind that number, e.g. orders waiting to be packed." },
    ],
    tips: ["Sales only count paid orders."],
  },
  {
    id: "order-slip",
    match: /^\/admin\/orders\/[^/]+\/slip$/,
    title: "Packing slip",
    href: "/admin/orders",
    purpose: "A slip to print and put inside the parcel.",
    steps: ["Check the items and the address.", "Press “Print slip”."],
    buttons: [
      { label: "Print slip", does: "Opens your printer. Choose “Save as PDF” if you want to send it by WhatsApp or email instead." },
      { label: "Back to order", does: "Returns to the order." },
    ],
  },
  {
    id: "manual-sale",
    match: /^\/admin\/orders\/new$/,
    title: "Add a sale",
    href: "/admin/orders/new",
    purpose: "Record a sale that didn’t happen on the website, so your stock stays correct.",
    steps: [
      "Choose where the sale happened (WhatsApp, Instagram, phone, walk-in).",
      "Enter the customer’s name and phone number.",
      "Choose each item and how many. Only items in stock can be chosen.",
      "Choose delivery or pick-up. The delivery price is added for you.",
      "Enter how they paid and the proof, e.g. the Mobile Money transaction ID.",
      "Enter the amount you received. It must match the total.",
    ],
    buttons: [
      { label: "+ Add another item", does: "Adds a line for another book." },
      { label: "Remove", does: "Takes that line off the sale." },
      { label: "Save paid sale", does: "Saves the order as paid and takes the items out of stock." },
      { label: "Save and send for approval", does: "Shown if you can’t approve payments. Saves the order and holds the items until the owner or a manager approves the payment." },
    ],
  },
  {
    id: "order-detail",
    match: /^\/admin\/orders\/[^/]+$/,
    title: "One order",
    href: "/admin/orders",
    purpose: "Everything about one order, and the buttons to move it along until it’s delivered.",
    steps: [
      "Check the payment label first. Only pack orders marked “Paid”.",
      "Move the order along as you work: New → Getting items → Packed → Sent out → Delivered.",
      "Before “Sent out”, type the delivery company and tracking number.",
      "Print the packing slip and put it in the parcel.",
    ],
    buttons: [
      { label: "Start getting items", does: "Marks that you are collecting the books from the shelf." },
      { label: "Mark as packed", does: "Marks the parcel as packed and ready to go." },
      { label: "Mark as sent out", does: "Marks it as handed to the delivery person. Type the delivery company first." },
      { label: "Mark as delivered", does: "Marks it as received by the customer. You can add a short note as proof." },
      { label: "Back to …", does: "Moves the order one step back if you pressed the wrong button." },
      { label: "Other actions", does: "Opens “Report a problem”, “Cancel order” and “Mark as returned”." },
      { label: "Report a problem", does: "Flags the order (wrong address, damaged book…) so the team can see it needs attention." },
      { label: "Cancel order", does: "Cancels an unpaid order and puts the books back into stock. Paid orders need a refund first." },
      { label: "Mark as returned", does: "Records that the customer sent it back. Tick the box if the books can be sold again." },
      { label: "Packing slip", does: "Opens a page you can print and put in the parcel." },
      { label: "Delivery company & tracking", does: "Opens a box to type or change the delivery company and tracking number." },
      { label: "Approve payment", does: "Only for sales not made on the website. Confirms you received the money. The order becomes Paid." },
      { label: "Start a refund", does: "Opens the refund form." },
      { label: "Refund through Paystack", does: "Saves the refund here. It does NOT send money. Send the refund yourself in your Paystack dashboard." },
      { label: "Save refund", does: "For sales paid by Mobile Money, cash or bank. Records the money you gave back." },
      { label: "Add note", does: "Saves a note for the team. Customers never see it." },
    ],
    tips: [
      "Website orders only become Paid when Paystack confirms the payment. Nobody can do it by hand.",
      "Every step saves your name and the time.",
    ],
  },
  {
    id: "orders",
    match: /^\/admin\/orders$/,
    title: "Orders",
    href: "/admin/orders",
    purpose: "All orders, from the website and from WhatsApp, Instagram, phone or walk-in sales.",
    steps: [
      "Use the tabs at the top to see one group of orders.",
      "Search by order number (it starts with BD-), customer name or phone.",
      "Click an order number to open it.",
    ],
    buttons: [
      { label: "To pack", does: "Paid orders you still need to pack and send." },
      { label: "On the way", does: "Orders you have sent out." },
      { label: "Not paid yet", does: "Orders waiting for payment. Don’t pack these." },
      { label: "Problems", does: "Orders someone flagged with a problem." },
      { label: "Not on website", does: "Sales added by staff (WhatsApp, Instagram, phone, walk-in)." },
      { label: "More filters", does: "Shows extra filters: region, delivery company and dates." },
      { label: "Apply", does: "Shows the orders that match your search and filters." },
      { label: "Add a sale", does: "Records a sale made outside the website." },
      { label: "Download spreadsheet", does: "Saves the list as a file you can open in Excel or Google Sheets." },
    ],
    tips: ["Unpaid website orders hold their books for 30 minutes. If the customer doesn’t pay, the order cancels and the books go back into stock by themselves."],
  },
  {
    id: "catalogue-new",
    match: /^\/admin\/catalogue\/new$/,
    title: "Add a book",
    href: "/admin/catalogue/new",
    purpose: "Step 1 of adding a product. Customers can’t see it until you publish it.",
    steps: [
      "Type the title and author.",
      "Choose the age range and tick at least one book type (e.g. Early Readers).",
      "Write a short description (at least 20 characters).",
      "Press “Create draft”. The next page asks for the price, stock and photo.",
    ],
    buttons: [{ label: "Create draft", does: "Saves the book as a draft and opens its page so you can finish it." }],
  },
  {
    id: "catalogue-import",
    match: /^\/admin\/catalogue\/import$/,
    title: "Import from a spreadsheet",
    href: "/admin/catalogue/import",
    purpose: "Add many books at once from a spreadsheet instead of one by one.",
    steps: [
      "Press “Download template” and fill it in, one row per item.",
      "Save it as CSV (in Excel or Google Sheets: File → Download → CSV).",
      "Choose the file and press “Check file”. Nothing is saved yet.",
      "Fix any rows marked as problems, then check again.",
      "Tick the confirmation box and press the Import button.",
    ],
    buttons: [
      { label: "Download template", does: "Saves an example spreadsheet with the right columns." },
      { label: "Check file", does: "Checks every row and lists any problems. Nothing is saved." },
      { label: "Import …", does: "Adds the books as drafts. They still need photos before you publish them." },
    ],
    tips: ["Importing never changes books you already have and never publishes anything by itself.", "Bundles can’t be imported. Add them one by one."],
  },
  {
    id: "catalogue-preview",
    match: /^\/admin\/catalogue\/[^/]+\/preview$/,
    title: "Preview",
    href: "/admin/catalogue",
    purpose: "See how the book will look to customers before you publish it.",
    steps: ["Check the photo, title, price and description.", "If anything is listed as “Not ready to publish yet”, go back and fix it."],
    buttons: [{ label: "Back to editing", does: "Returns to the book’s page." }],
  },
  {
    id: "catalogue-edit",
    match: /^\/admin\/catalogue\/[^/]+$/,
    title: "One book",
    href: "/admin/catalogue",
    purpose: "Finish a book: add how you sell it, its price and stock, a photo, then publish it.",
    steps: [
      "Add a stock option: choose Brand New, Preloved or Bundle Deals, then the type (Paperback…), item code, price and weight.",
      "Have new and preloved copies of the same book? Add two stock options here.",
      "Add stock: click the item code in the options list, or the Stock page link under it.",
      "Upload a clear photo of the cover and describe it in a few words.",
      "When the yellow checklist is gone, press “Publish”.",
    ],
    buttons: [
      { label: "+ Add a stock option", does: "Opens the form for a new way of selling this book." },
      { label: "Add stock option (starts with 0 stock)", does: "Saves the option. Then add stock on the Stock page." },
      { label: "Edit …", does: "Opens an existing option so you can change its price, weight or grade." },
      { label: "Save stock option", does: "Saves your changes to that option." },
      { label: "+ Add an item", does: "Bundles only: adds another book to the “What’s inside” list." },
      { label: "Upload photo", does: "Adds or replaces the cover photo. It is resized for you." },
      { label: "Save photo description", does: "Saves the short description of the photo (helps blind shoppers and Google)." },
      { label: "Add a photo", does: "Adds an extra photo (up to 8)." },
      { label: "Remove", does: "Deletes that extra photo." },
      { label: "Save details", does: "Saves the title, author, description, age and book types." },
      { label: "Preview", does: "Shows how the book will look to customers." },
      { label: "Publish", does: "Puts the book on the website straight away." },
      { label: "Unpublish", does: "Takes it off the website. Nothing is deleted." },
      { label: "Archive", does: "Hides it from the website and your everyday lists. Old orders are kept." },
      { label: "Bring back as draft", does: "Restores an archived book so you can edit it again." },
    ],
    tips: ["Weight decides the delivery price, so keep it accurate.", "Preloved copies need a grade: Like new, Very good or Good."],
  },
  {
    id: "catalogue",
    match: /^\/admin\/catalogue$/,
    title: "Products",
    href: "/admin/catalogue",
    purpose: "All your books, bundles and learning materials, with their status, price and stock.",
    steps: [
      "Search or use the filters to find a book.",
      "Click a book to edit it, add stock options and photos, or publish it.",
      "“Draft” means customers can’t see it yet. “Published” means it’s on the website.",
    ],
    buttons: [
      { label: "Add a book", does: "Starts a new product." },
      { label: "Import spreadsheet", does: "Adds many books at once from a spreadsheet." },
      { label: "Download spreadsheet", does: "Saves all products to a file for Excel or Google Sheets." },
      { label: "Apply", does: "Shows the products that match your search and filters." },
      { label: "Clear", does: "Removes the filters." },
    ],
  },
  {
    id: "categories",
    match: /^\/admin\/categories$/,
    title: "Categories",
    href: "/admin/categories",
    purpose: "The shelves customers browse on the website, like Early Readers or Christian Literature.",
    steps: [
      "First time? Press “Add the recommended shelves” once.",
      "If you see “Hide the old shelves”, press it to remove shelves you don’t sell.",
      "To change a shelf, open it under “Edit categories”.",
    ],
    buttons: [
      { label: "Add the recommended shelves", does: "Adds the 8 agreed shelves: 7 book types plus Bundle Deals." },
      { label: "Hide the old shelves", does: "Hides shelves from the old website (Puzzles, Games…). Nothing is deleted." },
      { label: "Add category", does: "Adds a new shelf." },
      { label: "Save category", does: "Saves a change to a shelf’s name, position or visibility." },
    ],
    tips: [
      "Brand New and Preloved are not shelves. You choose them on each stock option.",
      "Changing a shelf’s web address breaks old links to it.",
    ],
  },
  {
    id: "inventory-sku",
    match: /^\/admin\/inventory\/[^/]+$/,
    title: "Stock for one item",
    href: "/admin/inventory",
    purpose: "Add new copies, fix the count, and see every stock change for this item.",
    steps: [
      "Got new copies? In “Add new stock”, type how many and a reference (e.g. the supplier’s invoice), then press “Add stock”.",
      "Damaged, lost or sold elsewhere? Use “Fix stock count”, say why, then press “Save change”.",
      "The list below shows every change, who made it and when.",
    ],
    buttons: [
      { label: "Add stock", does: "Adds copies to stock." },
      { label: "Save change", does: "Saves a stock correction (damage, count mistake, return, sale made elsewhere)." },
      { label: "Save", does: "Saves the number at which this item shows as running low." },
      { label: "Put bundles together", does: "Bundles only: takes the books inside out of single stock and adds them to the bundle’s stock." },
      { label: "Take bundles apart", does: "Bundles only: puts the books back into single stock." },
    ],
    tips: ["Copies held for orders that aren’t finished can’t be removed. Finish or cancel those orders first."],
  },
  {
    id: "inventory",
    match: /^\/admin\/inventory$/,
    title: "Stock",
    href: "/admin/inventory",
    purpose: "How many copies you have of every item.",
    steps: [
      "“On shelf” is how many copies you have. “Held for orders” are waiting in orders that aren’t finished. “Available” is what customers can still buy.",
      "Click an item code to add stock or fix the count.",
    ],
    buttons: [
      { label: "Apply", does: "Shows the items that match your search and filters." },
      { label: "Low stock spreadsheet", does: "Saves a file of items that are running low or sold out, handy for re-ordering." },
      { label: "Full stock spreadsheet", does: "Saves a file of all your stock." },
    ],
  },
  {
    id: "content",
    match: /^\/admin\/content$/,
    title: "Homepage",
    href: "/admin/content",
    purpose: "Change the words and pictures on the website’s front page.",
    steps: [
      "Edit the big heading, the short text and the announcement strip.",
      "Choose which published books appear on the homepage shelves.",
      "Press “Save draft” to keep your changes without showing them.",
      "Press “Publish homepage” when you want customers to see them.",
    ],
    buttons: [
      { label: "Save draft", does: "Saves your changes. Customers don’t see them yet." },
      { label: "Publish homepage", does: "Puts your saved changes on the live website." },
      { label: "Upload photo", does: "Adds or replaces the big homepage picture." },
    ],
  },
  {
    id: "promotions",
    match: /^\/admin\/promotions$/,
    title: "Discount codes",
    href: "/admin/promotions",
    purpose: "Make codes customers type at checkout to get money off.",
    steps: [
      "Type a code (e.g. READMORE10), choose percent or GH₵ off, and the amount.",
      "Optional: smallest order, start and end dates, how many times it can be used.",
      "Press “Create code”.",
    ],
    buttons: [
      { label: "Create code", does: "Makes a new discount code." },
      { label: "Save code", does: "Saves changes to an existing code. Untick “Active” to pause it." },
    ],
    tips: ["Discounts only apply to the books, never to delivery."],
  },
  {
    id: "delivery",
    match: /^\/admin\/delivery$/,
    title: "Delivery prices",
    href: "/admin/delivery",
    purpose: "Set how much delivery costs to each region. Checkout won’t take payment for places without a price.",
    steps: [
      "Add a price for each region you deliver to.",
      "Leave “Cities / towns” empty to cover the whole region, or list towns for a special price.",
      "Use “Check prices” to see what a customer in a town would pay.",
    ],
    buttons: [
      { label: "Add price", does: "Adds a new delivery price." },
      { label: "Save as new version", does: "Changes a price. Old orders keep the price they were given." },
      { label: "Stop using this price", does: "Removes it from checkout." },
      { label: "Check prices", does: "Shows the delivery price for the town and weight you typed." },
      { label: "Reset", does: "Clears the check." },
    ],
    tips: ["The orange box lists regions with no price yet. Customers there can’t pay online."],
  },
  {
    id: "customers",
    match: /^\/admin\/customers$/,
    title: "Customers",
    href: "/admin/customers",
    purpose: "Everyone who has ordered, so you can help them with an order.",
    steps: ["Search by name, phone, email or order number.", "Click the order number to open their latest order."],
    buttons: [{ label: "Search", does: "Finds matching customers." }],
    tips: ["Only use these details to help with orders. Don’t send adverts unless the customer agreed."],
  },
  {
    id: "notifications",
    match: /^\/admin\/notifications$/,
    title: "Text messages",
    href: "/admin/notifications",
    purpose: "The order text messages for customers (paid, sent out, delivered).",
    steps: ["Text messages are not switched on yet. This page will fill up once they are."],
    buttons: [{ label: "Try again", does: "Re-sends a message that failed. Each message is only ever sent once." }],
  },
  {
    id: "reports",
    match: /^\/admin\/reports$/,
    title: "Reports",
    href: "/admin/reports",
    purpose: "How much you’ve sold and what’s selling, for the dates you choose.",
    steps: ["Choose the From and To dates and press “Update”.", "Only paid orders are counted."],
    buttons: [
      { label: "Update", does: "Shows the numbers for the dates you chose." },
      { label: "Last 30 days", does: "Goes back to the last 30 days." },
      { label: "Sales spreadsheet", does: "Saves the sales numbers to a file." },
      { label: "Stock changes spreadsheet", does: "Saves every stock change in those dates to a file." },
    ],
  },
  {
    id: "audit",
    match: /^\/admin\/audit$/,
    title: "Activity log",
    href: "/admin/audit",
    purpose: "A record of every important change: who did it, what changed and when. Nobody can edit it.",
    steps: ["Search for a person, an order number or an item code.", "Use it to answer “who changed this?”."],
    buttons: [
      { label: "Filter", does: "Shows only the matching entries." },
      { label: "Download spreadsheet", does: "Saves the log to a file." },
    ],
  },
  {
    id: "staff",
    match: /^\/admin\/staff$/,
    title: "Staff",
    href: "/admin/staff",
    purpose: "Who can use the admin, and what each person is allowed to do. Only the owner can change this.",
    steps: [
      "First create the person’s login in Firebase (Authentication → Add user).",
      "Then type their email, name and role here and press “Add staff member”.",
      "Open “What each role can do” if you’re unsure which role to give.",
    ],
    buttons: [
      { label: "Add staff member", does: "Gives that person access with the role you chose." },
      { label: "Change role", does: "Changes what they can do. They are signed out so it works straight away." },
      { label: "Save access", does: "Pauses (suspended) or removes (revoked) someone’s access, or gives it back." },
      { label: "Sign them out everywhere", does: "Signs them out on every phone and computer, e.g. if a phone is lost." },
    ],
    tips: ["Nobody can change their own role.", "There must always be at least one active owner."],
  },
  {
    id: "settings",
    match: /^\/admin\/settings$/,
    title: "Settings",
    href: "/admin/settings",
    purpose: "Shop contact details and the on/off switch for online payment.",
    steps: [
      "Keep the phone, WhatsApp and email up to date. Customers see them.",
      "“Online payment on”: tick it to let customers pay on the website. Untick it to pause online orders.",
      "Press “Save settings”.",
    ],
    buttons: [
      { label: "Save settings", does: "Saves everything on this page." },
      { label: "Sign out on all devices", does: "Signs you out everywhere, including this computer." },
    ],
    tips: ["Payment keys are never typed here. They are stored safely on the server."],
  },
];

/** Shown at the top of the Help page, in order. */
export const GETTING_STARTED: { title: string; detail: string; href: string }[] = [
  { title: "Add the shelves", detail: "Categories → “Add the recommended shelves”.", href: "/admin/categories" },
  { title: "Add delivery prices", detail: "Delivery prices → add a price for each region you deliver to.", href: "/admin/delivery" },
  { title: "Add your first book", detail: "Products → “Add a book” → fill in the details → “Create draft”.", href: "/admin/catalogue/new" },
  { title: "Add a stock option", detail: "On the book’s page: choose Brand New or Preloved, type, item code, price and weight.", href: "/admin/catalogue" },
  { title: "Add stock", detail: "Stock → click the item code → “Add stock”.", href: "/admin/inventory" },
  { title: "Upload a cover photo and publish", detail: "Back on the book’s page: “Upload photo”, then “Publish”.", href: "/admin/catalogue" },
  { title: "Check your contact details", detail: "Settings → phone, WhatsApp, email → “Save settings”.", href: "/admin/settings" },
  { title: "Turn on online payment", detail: "Settings → tick “Online payment on” → “Save settings”. Then make one small test purchase yourself.", href: "/admin/settings" },
];

export function guideFor(pathname: string): AdminGuide | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return ADMIN_GUIDES.find((guide) => guide.match.test(path)) ?? null;
}
