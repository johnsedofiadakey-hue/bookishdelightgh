import type { Metadata } from "next";
import Link from "next/link";
import { Fact, LegalPage, LegalSection, ToConfirm } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Delivery Policy | Bookish Delight GH",
  description: "Where Bookish Delight GH delivers, delivery prices and times, and how to track an order.",
};

export default function DeliveryPage() {
  const pickup = legalFacts.pickupAvailable;
  return <LegalPage current="/delivery" title="Delivery Policy" intro={<p>We send orders from Kumasi to customers across Ghana. Here is how delivery works.</p>}>
    <LegalSection id="where" title="1. Where we deliver">
      <p>We deliver to all 16 regions of Ghana. At checkout you will see the exact delivery price and estimated time for your address before you pay. If we cannot deliver to your address, checkout will tell you and you will not be charged.</p>
    </LegalSection>

    <LegalSection id="cost" title="2. Prices and times">
      <p>Delivery prices depend on your region, town and the weight of your order. Estimated delivery times are shown at checkout and start from when your order is dispatched, not when it is placed. Estimates are not guaranteed, especially during holidays or bad weather.</p>
    </LegalSection>

    <LegalSection id="dispatch" title="3. Processing your order">
      <p>We pack orders on working days once payment is confirmed. Keep your order number and use the tracking page to check progress. We may contact you by phone or WhatsApp if we need help with delivery.</p>
    </LegalSection>

    <LegalSection id="tracking" title="4. Tracking your order">
      <p>Use our <Link href="/track">order tracking page</Link> with your order number (it starts with “BD-”) and the phone number you ordered with. You can also message us on WhatsApp at {legalFacts.whatsappDisplay}.</p>
    </LegalSection>

    <LegalSection id="receiving" title="5. Receiving your parcel">
      <p>Please keep your phone on so the courier can reach you. Check your parcel when it arrives. If it is visibly damaged, take a photo and tell us within 48 hours.</p>
      <p>If the courier cannot reach you after reasonable attempts, the parcel may be returned to us. We will contact you to arrange redelivery, which may carry a further delivery charge.</p>
    </LegalSection>

    <LegalSection id="pickup" title="6. Collecting in Kumasi">
      {pickup === null
        ? <p><ToConfirm>whether customers can collect orders from the Kumasi shop, and the opening hours</ToConfirm></p>
        : pickup
          ? <p>You can choose to collect your order from {legalFacts.streetAddress} (GhanaPost GPS {legalFacts.gpsAddress}). We will message you when it is ready. Collection hours: <Fact value={legalFacts.pickupHours} missing="collection hours"/>.</p>
          : <p>We do not currently offer collection. All orders are delivered.</p>}
    </LegalSection>
  </LegalPage>;
}
