import type { Metadata } from "next";
import { Fact, LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Returns & Refunds | Bookish Delight GH",
  description: "How to return an item to Bookish Delight GH and how refunds are paid.",
};

export default function ReturnsPage() {
  return <LegalPage current="/returns" title="Returns & Refunds" intro={<p>We want every book, puzzle and game to arrive in perfect condition. If something is wrong, tell us and we will put it right.</p>}>
    <LegalSection id="faulty" title="1. Damaged, faulty or wrong items">
      <p>If an item arrives damaged, has missing pieces or pages, or is not what you ordered, message us on WhatsApp at {legalFacts.whatsappDisplay} within <Fact value={legalFacts.returnWindowDays} missing="number of days"/> days of delivery. Please include your order number and a photo of the problem.</p>
      <p>We will offer a replacement or a full refund, including the delivery charge for that item. We arrange and pay for the return.</p>
    </LegalSection>

    <LegalSection id="change-of-mind" title="2. Changed your mind">
      <p>You can return an unwanted item within <Fact value={legalFacts.returnWindowDays} missing="number of days"/> days of delivery if it is unused, complete and in its original condition and packaging. You pay the cost of sending it back unless we agree otherwise. We refund the item price once we receive and check it. The original delivery charge is not refunded.</p>
    </LegalSection>

    <LegalSection id="exceptions" title="3. Items we cannot take back">
      <p>For hygiene and safety reasons, and unless they are faulty, we cannot accept returns of:</p>
      <ul>
        <li>puzzles and games that have been opened or whose seal has been broken;</li>
        <li>activity books, workbooks or colouring books that have been written or drawn in;</li>
        <li>items damaged after delivery.</li>
      </ul>
    </LegalSection>

    <LegalSection id="how" title="4. How to start a return">
      <ol>
        <li>Message us on WhatsApp at {legalFacts.whatsappDisplay} with your order number, the item and the reason.</li>
        <li>We will reply with return instructions. Please do not send items back before we confirm.</li>
        <li>Pack the item securely. We are not responsible for items lost or damaged on the way back to us unless we arranged the return.</li>
      </ol>
    </LegalSection>

    <LegalSection id="refunds" title="5. How refunds are paid">
      <p>Refunds go back to the original payment method through Paystack: to the same Mobile Money wallet or card. We start the refund within <Fact value={legalFacts.refundProcessingDays} missing="number of working days"/> working days of approving it. Your bank or network may take a few more days to show it.</p>
      <p>If you cancel before dispatch, we refund the full amount including delivery.</p>
    </LegalSection>
  </LegalPage>;
}
