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
  return <LegalPage current="/delivery" title="Delivery Policy" intro={<p>We send orders from Kumasi to people all over Ghana. Here is how delivery works.</p>}>
    <LegalSection id="where" title="1. Where we deliver">
      <p>We deliver to all 16 regions of Ghana. Before you pay, checkout shows the delivery price and how long it should take. If we can’t deliver to your address, checkout will tell you and you won’t pay anything.</p>
    </LegalSection>

    <LegalSection id="cost" title="2. Prices and times">
      <p>The delivery price depends on your region, your town and how heavy your order is. Checkout shows how long delivery should take. This time starts when we send your order out, not when you place it. Delivery can take longer during holidays or bad weather.</p>
    </LegalSection>

    <LegalSection id="dispatch" title="3. Getting your order ready">
      <p>We pack orders on working days after your payment goes through. Keep your order number and use the tracking page to check how it’s going. We may call or WhatsApp you if we need help with delivery.</p>
    </LegalSection>

    <LegalSection id="tracking" title="4. Tracking your order">
      <p>Go to our <Link href="/track">order tracking page</Link>. Enter your order number (it starts with “BD-”) and the phone number you used to order. You can also message us on WhatsApp at {legalFacts.whatsappDisplay}.</p>
    </LegalSection>

    <LegalSection id="receiving" title="5. Receiving your parcel">
      <p>Please keep your phone on so the delivery person can call you. Check your parcel when it arrives. If it looks damaged, take a photo and tell us within 48 hours.</p>
      <p>If the delivery person can’t reach you after a few tries, the parcel may come back to us. We’ll contact you to send it again. You may have to pay for delivery again.</p>
    </LegalSection>

    <LegalSection id="pickup" title="6. Picking up in Kumasi">
      {pickup === null
        ? <p><ToConfirm>whether customers can collect orders from the Kumasi shop, and the opening hours</ToConfirm></p>
        : pickup
          ? <p>You can pick up your order from {legalFacts.streetAddress} (GhanaPost GPS {legalFacts.gpsAddress}). We’ll message you when it’s ready. Pick-up hours: <Fact value={legalFacts.pickupHours} missing="collection hours"/>.</p>
          : <p>You can’t pick up orders at the moment. We deliver every order.</p>}
    </LegalSection>
  </LegalPage>;
}
