import type { Metadata } from "next";
import Link from "next/link";
import { Fact, LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions | Bookish Delight GH",
  description: "The terms that apply when you shop with Bookish Delight GH.",
};

export default function TermsPage() {
  return <LegalPage current="/terms" title="Terms & Conditions" intro={<p>These are the rules for using our website and buying from Bookish Delight GH. When you place an order, you agree to them. Please also read our <Link href="/privacy">Privacy Policy</Link>, <Link href="/returns">Returns &amp; Refunds</Link> and <Link href="/delivery">Delivery Policy</Link>.</p>}>
    <LegalSection id="who-we-are" title="1. Who we are">
      <p>This website is run by <Fact value={legalFacts.registeredName} missing="registered business name"/>, which does business as Bookish Delight GH. Registration number: <Fact value={legalFacts.registrationNumber} missing="business registration number"/>. Address: {legalFacts.streetAddress} (GhanaPost GPS {legalFacts.gpsAddress}). You can reach us on WhatsApp at {legalFacts.whatsappDisplay}.</p>
    </LegalSection>

    <LegalSection id="products" title="2. Our products">
      <p>We sell new and preloved children’s books, learning materials (like workbooks and flashcards), reference books, Christian books and book bundles. We mark each preloved item Like new, Very good or Good, and we tell you about any wear on the book page. We use real photos and describe each item as well as we can. Colours may look a little different on your screen, and the publisher may change the packaging.</p>
      <p>The age on a book page is only a suggestion. Please read our <Link href="/safety">Product Safety</Link> page, especially for young children and items with small parts.</p>
    </LegalSection>

    <LegalSection id="prices" title="3. Prices and availability">
      <p>All prices are in Ghana cedis (GH₵) and include tax, unless we say otherwise. Delivery costs extra, and you see the price before you pay.</p>
      <p>We only show items we have in stock. When you start to pay, we hold the items for you. They are yours once the payment goes through. If an item runs out after you pay, we’ll contact you and give you all your money back for that item.</p>
      <p>If an item shows a price that is clearly a mistake, we may cancel the order and give you all your money back, even after you have paid.</p>
    </LegalSection>

    <LegalSection id="orders" title="4. Placing an order">
      <p>When you order, you are offering to buy. The sale is final when we confirm your payment by text message or on screen. We may refuse or cancel an order, for example if an item is out of stock, we can’t deliver to your address, or the order looks like fraud. If we cancel, we give back any money you paid.</p>
      <p>Please check your phone number and delivery address. We use them to deliver your order and send you updates.</p>
    </LegalSection>

    <LegalSection id="payment" title="5. Payment">
      <p>Paystack handles online payments safely, by Mobile Money or card. We never see or keep your full card number or your Mobile Money PIN. Your order is only confirmed after Paystack tells us the payment went through.</p>
    </LegalSection>

    <LegalSection id="cancelling" title="6. Cancelling an order">
      <p>You can ask us on WhatsApp to cancel your order before we send it out, and we’ll give you all your money back. After we send it out, our <Link href="/returns">Returns &amp; Refunds</Link> policy applies instead.</p>
    </LegalSection>

    <LegalSection id="delivery" title="7. Delivery and tracking">
      <p>We deliver all over Ghana. Our <Link href="/delivery">Delivery Policy</Link> explains prices, how long delivery takes and what happens if delivery fails. You can follow your order on our <Link href="/track">order tracking page</Link> using your order number and phone number.</p>
      <p>Once the items are delivered to you, or to someone you chose, you are responsible for them.</p>
    </LegalSection>

    <LegalSection id="liability" title="8. Our responsibility to you">
      <p>If we break these rules or are careless, we are responsible for any loss or damage that we could have expected to happen. We are not responsible for losses no one could have expected, or for losses to a business. Nothing here takes away any rights you have under Ghana’s laws, or any responsibility the law says we must carry.</p>
    </LegalSection>

    <LegalSection id="website" title="9. Using our website">
      <p>The words, photos and logo on this website belong to Bookish Delight GH, or we have permission to use them. Book covers and product names belong to their publishers and makers. Please don’t copy them to make money, and don’t try to break or disturb the website.</p>
    </LegalSection>

    <LegalSection id="changes" title="10. Changes and the law">
      <p>We may change these rules from time to time. The rules on this page on the day you order are the ones that apply to that order. The laws of Ghana apply to these rules, and any dispute will be handled by the courts of Ghana.</p>
    </LegalSection>
  </LegalPage>;
}
