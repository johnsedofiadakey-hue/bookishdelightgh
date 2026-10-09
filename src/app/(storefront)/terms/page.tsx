import type { Metadata } from "next";
import Link from "next/link";
import { Fact, LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions | Bookish Delight GH",
  description: "The terms that apply when you shop with Bookish Delight GH.",
};

export default function TermsPage() {
  return <LegalPage current="/terms" title="Terms & Conditions" intro={<p>These terms apply when you browse our website or buy from Bookish Delight GH. By placing an order you agree to them. Please read them together with our <Link href="/privacy">Privacy Policy</Link>, <Link href="/returns">Returns &amp; Refunds</Link> and <Link href="/delivery">Delivery Policy</Link>.</p>}>
    <LegalSection id="who-we-are" title="1. Who we are">
      <p>This website is operated by <Fact value={legalFacts.registeredName} missing="registered business name"/> trading as Bookish Delight GH, registration number <Fact value={legalFacts.registrationNumber} missing="business registration number"/>, of {legalFacts.streetAddress} (GhanaPost GPS {legalFacts.gpsAddress}). You can reach us on WhatsApp at {legalFacts.whatsappDisplay}.</p>
    </LegalSection>

    <LegalSection id="products" title="2. Our products">
      <p>We sell brand new and preloved children’s books, educational resources such as workbooks and flashcards, reference books, Christian literature and bundle deals. Preloved items are graded Like new, Very good or Good, and any notable wear is described on the listing. We show real photos and describe each item as accurately as we can, but colours may look slightly different on your screen and packaging may change from the publisher or maker.</p>
      <p>Age guidance on a listing is a suggestion. Please read our <Link href="/safety">Product Safety</Link> page, especially for young children and items with small parts.</p>
    </LegalSection>

    <LegalSection id="prices" title="3. Prices and availability">
      <p>All prices are in Ghana cedis (GH₵) and include any applicable taxes unless stated otherwise. Delivery is charged separately and shown before you pay.</p>
      <p>We only list items we hold in stock. Stock is reserved for you when you start payment and confirmed once payment succeeds. If an item becomes unavailable after you pay, we will contact you and refund that item in full.</p>
      <p>If we list an item at an obviously wrong price, we may cancel the order and refund you in full, even after you have paid.</p>
    </LegalSection>

    <LegalSection id="orders" title="4. Placing an order">
      <p>Your order is an offer to buy. We confirm accepted orders on screen after payment is verified. We may decline or cancel an order, for example if an item is out of stock, delivery is not possible to your address, or we suspect fraud. If we cancel, we refund any amount you paid.</p>
      <p>Please check your phone number and delivery address. We use them to deliver your order and send updates.</p>
    </LegalSection>

    <LegalSection id="payment" title="5. Payment">
      <p>Online payments are processed securely by Paystack using Mobile Money or card. We never see or store your full card details or Mobile Money PIN. Your order is only confirmed once Paystack confirms the payment to us.</p>
    </LegalSection>

    <LegalSection id="cancelling" title="6. Cancelling an order">
      <p>You can ask to cancel an order on WhatsApp before it is dispatched, and we will refund you in full. Once an order has been dispatched, our <Link href="/returns">Returns &amp; Refunds</Link> policy applies.</p>
    </LegalSection>

    <LegalSection id="delivery" title="7. Delivery and tracking">
      <p>We deliver across Ghana. Prices, estimated times and what happens if a delivery fails are set out in our <Link href="/delivery">Delivery Policy</Link>. You can follow your order on our <Link href="/track">order tracking page</Link> using your order number and phone number.</p>
      <p>Risk in the goods passes to you when they are delivered to you or to the person you nominate.</p>
    </LegalSection>

    <LegalSection id="liability" title="8. Our responsibility to you">
      <p>We are responsible for loss or damage you suffer that is a foreseeable result of us breaking these terms or failing to use reasonable care. We are not responsible for losses that were not foreseeable, or for business losses. Nothing in these terms limits any rights you have under Ghanaian law, or our liability where it cannot lawfully be limited.</p>
    </LegalSection>

    <LegalSection id="website" title="9. Using our website">
      <p>The text, photos and logo on this website belong to Bookish Delight GH or are used with permission. Book covers and product names belong to their publishers and makers. Please do not copy them for commercial use or try to interfere with the website’s operation.</p>
    </LegalSection>

    <LegalSection id="changes" title="10. Changes and governing law">
      <p>We may update these terms from time to time. The version on this page when you place your order applies to that order. These terms are governed by the laws of the Republic of Ghana, and the courts of Ghana have jurisdiction over any dispute.</p>
    </LegalSection>
  </LegalPage>;
}
