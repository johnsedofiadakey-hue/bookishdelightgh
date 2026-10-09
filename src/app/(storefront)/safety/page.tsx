import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Product Safety | Bookish Delight GH",
  description: "Age guidance and safety information for children’s books, puzzles and games from Bookish Delight GH.",
};

export default function SafetyPage() {
  return <LegalPage current="/safety" title="Product Safety" intro={<p>Our books, puzzles and games are made for children, so safety matters to us. Please read this guidance and the maker’s labels before giving an item to a child.</p>}>
    <LegalSection id="small-parts" title="1. Small parts: choking hazard">
      <p className="legal-warning"><strong>Warning:</strong> Puzzles, games and learning toys may contain small parts that can be swallowed or inhaled. They are not suitable for children under 3 years unless the listing and packaging clearly say so.</p>
      <p>Keep small pieces, balloons, packaging and plastic bags away from babies and toddlers.</p>
    </LegalSection>

    <LegalSection id="age" title="2. Age guidance">
      <p>Each listing shows an age band, for example 0–3 or 4–7. For safety, always follow the maker’s age warning on the packaging. Where it differs from our listing, the packaging takes priority. Our reading-age suggestions are a guide to interest and difficulty, not a safety rating.</p>
    </LegalSection>

    <LegalSection id="supervision" title="3. Supervision">
      <p>Young children should be supervised during play. Check items regularly for wear, loose pieces or sharp edges, and stop using anything that is damaged.</p>
    </LegalSection>

    <LegalSection id="board-books" title="4. Books for babies and toddlers">
      <p>Board books are made to be handled by small children, but they are not teething toys. Remove any that start to come apart.</p>
    </LegalSection>

    <LegalSection id="report" title="5. Report a safety concern">
      <p>If you find a safety problem with something you bought from us, stop using it and message us on WhatsApp at {legalFacts.whatsappDisplay} with your order number and a photo. We will look into it and offer a refund or replacement for faulty items.</p>
    </LegalSection>
  </LegalPage>;
}
