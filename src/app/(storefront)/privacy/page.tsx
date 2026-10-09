import type { Metadata } from "next";
import { Fact, LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Bookish Delight GH",
  description: "How Bookish Delight GH collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return <LegalPage current="/privacy" title="Privacy Policy" intro={<p>This policy explains what personal data Bookish Delight GH collects, why we collect it, and your rights under Ghana’s Data Protection Act, 2012 (Act 843). We collect only what we need to sell and deliver your order.</p>}>
    <LegalSection id="controller" title="1. Who is responsible for your data">
      <p><Fact value={legalFacts.registeredName} missing="registered business name"/>, trading as Bookish Delight GH, {legalFacts.streetAddress}, is the data controller. Data Protection Commission registration number: <Fact value={legalFacts.dataProtectionRegistration} missing="DPC registration number"/>.</p>
      <p>For privacy questions or requests, contact us at <Fact value={legalFacts.contactEmail} missing="privacy contact email"/> or on WhatsApp at {legalFacts.whatsappDisplay}.</p>
    </LegalSection>

    <LegalSection id="what" title="2. What we collect">
      <ul>
        <li><strong>Order details:</strong> your name, phone number, optional email, delivery address, GhanaPost GPS code and delivery notes.</li>
        <li><strong>Order history:</strong> the items you bought, prices, order status and messages we send you.</li>
        <li><strong>Payment confirmation:</strong> Paystack tells us whether a payment succeeded, its reference and amount. We do not receive or store your full card number or Mobile Money PIN.</li>
        <li><strong>Messages:</strong> what you send us on WhatsApp or by phone.</li>
        <li><strong>Technical data:</strong> basic information your browser sends, such as device type and pages visited, used to keep the site working and secure.</li>
      </ul>
      <p>We do not knowingly collect personal data directly from children. Orders should be placed by a parent, guardian, teacher or other adult.</p>
    </LegalSection>

    <LegalSection id="why" title="3. Why we use it">
      <ul>
        <li>To process, deliver and support your order, including order status updates on this website.</li>
        <li>To handle returns, refunds and questions.</li>
        <li>To keep accounting and tax records we are required by law to keep.</li>
        <li>To prevent fraud and keep the website secure.</li>
      </ul>
      <p>We will only send you marketing messages if you have agreed to receive them, and you can opt out at any time.</p>
    </LegalSection>

    <LegalSection id="sharing" title="4. Who we share it with">
      <p>We share only what each service needs:</p>
      <ul>
        <li><strong>Paystack</strong>, to process payments.</li>
        <li><strong>Delivery partners</strong>, who receive your name, phone number and address to deliver your parcel.</li>
        <li><strong>Google Firebase</strong>, which hosts our website and stores order data. Some of this data is stored on servers outside Ghana, in the European Union, with appropriate safeguards.</li>
      </ul>
      <p>We do not sell your personal data. We may disclose it where the law requires us to.</p>
    </LegalSection>

    <LegalSection id="retention" title="5. How long we keep it">
      <p>We keep order records for as long as needed for accounting and tax purposes under Ghanaian law, and then delete or anonymise them. Chat messages that are not linked to an order are deleted when no longer needed.</p>
    </LegalSection>

    <LegalSection id="rights" title="6. Your rights">
      <p>Under the Data Protection Act, 2012 you can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you and give you a copy;</li>
        <li>correct data that is wrong or incomplete;</li>
        <li>delete data we no longer have a lawful reason to keep;</li>
        <li>stop using your data for marketing.</li>
      </ul>
      <p>Contact us using the details above. If you are not satisfied with our response, you can complain to the Data Protection Commission of Ghana.</p>
    </LegalSection>

    <LegalSection id="security" title="7. Keeping your data safe">
      <p>Our website uses encrypted connections (HTTPS). Order data is stored in a secured database that only authorised staff can access through individual accounts, and staff access is logged. Contact numbers are masked from staff who do not need them.</p>
    </LegalSection>

    <LegalSection id="cookies" title="8. Cookies and local storage">
      <p>We use your browser’s storage to remember your shopping bag, and a secure cookie for staff sign-in. We do not use advertising cookies. If we add analytics later, we will update this policy first.</p>
    </LegalSection>
  </LegalPage>;
}
