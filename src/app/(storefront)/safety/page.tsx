import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Product Safety | Bookish Delight GH",
  description: "Age guidance and safety information for children’s books and educational resources from Bookish Delight GH.",
};

export default function SafetyPage() {
  return <LegalPage current="/safety" title="Product Safety" intro={<p>Our books and learning materials are made for children, so safety matters to us. Please read this page and the labels on the item before you give it to a child.</p>}>
    <LegalSection id="small-parts" title="1. Small parts: choking hazard">
      <p className="legal-warning"><strong>Warning:</strong> Sticker books, activity sets and toy books may have small parts that a child could swallow or choke on. They are not safe for children under 3, unless the book page and the packaging clearly say they are.</p>
      <p>Keep small pieces, balloons, packaging and plastic bags away from babies and toddlers.</p>
    </LegalSection>

    <LegalSection id="age" title="2. Age guidance">
      <p>Each book page shows an age range, for example 0–3 or 4–7. For safety, always follow the age warning on the packaging. If it is different from our website, follow the packaging. Our reading ages only tell you how hard or interesting a book is. They are not a safety rating.</p>
    </LegalSection>

    <LegalSection id="supervision" title="3. Watch young children">
      <p>Stay with young children while they play. Check items often for wear, loose pieces or sharp edges, and stop using anything that is damaged.</p>
    </LegalSection>

    <LegalSection id="board-books" title="4. Books for babies and toddlers">
      <p>Board books are made for small hands, but they are not for chewing. Take away any that start to fall apart.</p>
    </LegalSection>

    <LegalSection id="report" title="5. Report a safety concern">
      <p>If something you bought from us is not safe, stop using it. Message us on WhatsApp at {legalFacts.whatsappDisplay} with your order number and a photo. We’ll look into it, and for faulty items we’ll give you your money back or a new one.</p>
    </LegalSection>
  </LegalPage>;
}
