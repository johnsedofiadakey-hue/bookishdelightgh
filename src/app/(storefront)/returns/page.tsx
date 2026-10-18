import type { Metadata } from "next";
import { Fact, LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Returns & Refunds | Bookish Delight GH",
  description: "How to return an item to Bookish Delight GH and how refunds are paid.",
};

export default function ReturnsPage() {
  return <LegalPage current="/returns" title="Returns & Refunds" intro={<p>We want every book to arrive just as we described it. If something is wrong, tell us and we’ll fix it.</p>}>
    <LegalSection id="faulty" title="1. Damaged, faulty or wrong items">
      <p>If an item arrives damaged, is missing pages or pieces, or is not what you ordered, message us on WhatsApp at {legalFacts.whatsappDisplay} within <Fact value={legalFacts.returnWindowDays} missing="number of days"/> days of delivery. Please include your order number and a photo of the problem.</p>
      <p>We’ll send you a new one or give you all your money back, including delivery for that item. We’ll arrange the return and pay for it.</p>
    </LegalSection>

    <LegalSection id="change-of-mind" title="2. Changed your mind">
      <p>You can return an unwanted item within <Fact value={legalFacts.returnWindowDays} missing="number of days"/> days of delivery if it is unused, has all its parts and is still in its packaging. You pay to send it back, unless we agree otherwise. We’ll refund the price of the item after we get it and check it. We don’t refund the delivery cost.</p>
    </LegalSection>

    <LegalSection id="exceptions" title="3. Items we cannot take back">
      <p>For health and safety reasons, we can’t take back these items unless they are faulty:</p>
      <ul>
        <li>activity books, workbooks, colouring books or sticker books that have been written in, drawn in or used;</li>
        <li>items damaged after delivery.</li>
      </ul>
    </LegalSection>

    <LegalSection id="how" title="4. How to start a return">
      <ol>
        <li>Message us on WhatsApp at {legalFacts.whatsappDisplay} with your order number, the item and the reason.</li>
        <li>We’ll tell you how to send it back. Please don’t send anything until we reply.</li>
        <li>Pack the item well. If you send it yourself and it gets lost or damaged on the way, we can’t take responsibility.</li>
      </ol>
    </LegalSection>

    <LegalSection id="refunds" title="5. How refunds are paid">
      <p>We send your money back the same way you paid, through Paystack: to the same Mobile Money wallet or card. We start the refund within <Fact value={legalFacts.refundProcessingDays} missing="number of working days"/> working days after we approve it. Your bank or network may take a few more days to show it.</p>
      <p>If you cancel before we send your order out, we refund everything, including delivery.</p>
    </LegalSection>
  </LegalPage>;
}
