import type { Metadata } from "next";
import { Fact, LegalPage, LegalSection } from "@/components/storefront/legal-page";
import { legalFacts } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | Bookish Delight GH",
  description: "How Bookish Delight GH collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return <LegalPage current="/privacy" title="Privacy Policy" intro={<p>This page explains what personal information Bookish Delight GH collects, why we need it, and your rights under Ghana’s Data Protection Act, 2012 (Act 843). We only collect what we need to sell and deliver your order.</p>}>
    <LegalSection id="controller" title="1. Who looks after your information">
      <p><Fact value={legalFacts.registeredName} missing="registered business name"/>, trading as Bookish Delight GH, {legalFacts.streetAddress}, is responsible for your information. Data Protection Commission registration number: <Fact value={legalFacts.dataProtectionRegistration} missing="DPC registration number"/>.</p>
      <p>For questions or requests about your information, email <a href={`mailto:${legalFacts.contactEmail}`}>{legalFacts.contactEmail}</a> or message us on WhatsApp at {legalFacts.whatsappDisplay}.</p>
    </LegalSection>

    <LegalSection id="what" title="2. What we collect">
      <ul>
        <li><strong>Order details:</strong> your name, phone number, email (if you give it), delivery address, GhanaPost GPS code and delivery notes.</li>
        <li><strong>Past orders:</strong> what you bought, the prices, where your order is and the messages we send you.</li>
        <li><strong>Payment details:</strong> Paystack tells us if your payment went through, its reference number and the amount. We never get or keep your full card number or your Mobile Money PIN.</li>
        <li><strong>Messages:</strong> what you send us on WhatsApp or by phone.</li>
        <li><strong>Website data:</strong> basic information your browser sends, like the type of device and the pages you visit. We use it to keep the website working and safe.</li>
      </ul>
      <p>We don’t knowingly collect information from children. A parent, guardian, teacher or other adult should place the order.</p>
    </LegalSection>

    <LegalSection id="why" title="3. Why we use it">
      <ul>
        <li>To handle and deliver your order and help you with it, including order updates on this website.</li>
        <li>To handle returns, refunds and questions.</li>
        <li>To keep the money and tax records the law says we must keep.</li>
        <li>To stop fraud and keep the website safe.</li>
      </ul>
      <p>We only send you adverts or offers if you have said yes, and you can ask us to stop at any time.</p>
    </LegalSection>

    <LegalSection id="sharing" title="4. Who we share it with">
      <p>We only share what each service needs:</p>
      <ul>
        <li><strong>Paystack</strong>, to take payments.</li>
        <li><strong>Delivery companies</strong>, who get your name, phone number and address so they can deliver your parcel.</li>
        <li><strong>Google Firebase</strong>, which runs our website and stores order information. Some of it is kept on computers outside Ghana, in the European Union, with proper protection.</li>
      </ul>
      <p>We never sell your information. We may share it if the law says we must.</p>
    </LegalSection>

    <LegalSection id="retention" title="5. How long we keep it">
      <p>We keep order records for as long as Ghana’s tax and accounting laws require. After that, we delete them or remove anything that shows who you are. We delete chat messages that are not about an order once we no longer need them.</p>
    </LegalSection>

    <LegalSection id="rights" title="6. Your rights">
      <p>Under the Data Protection Act, 2012 you can ask us to:</p>
      <ul>
        <li>tell you what information we have about you and give you a copy;</li>
        <li>fix information that is wrong or missing;</li>
        <li>delete information we no longer have a legal reason to keep;</li>
        <li>stop sending you adverts or offers.</li>
      </ul>
      <p>Contact us using the details above. If you are not happy with our answer, you can complain to the Data Protection Commission of Ghana.</p>
    </LegalSection>

    <LegalSection id="security" title="7. Keeping your information safe">
      <p>Our website uses a secure connection (HTTPS). Order information is kept in a protected database. Only approved staff can open it, each with their own account, and we keep a record of who looked. Staff who don’t need your phone number can’t see it.</p>
    </LegalSection>

    <LegalSection id="cookies" title="8. Cookies and saved data">
      <p>Your browser saves your shopping bag so it’s still there when you come back. Staff sign-in uses a secure cookie. We don’t use cookies for adverts. If we ever start tracking how people use the site, we’ll update this page first.</p>
    </LegalSection>
  </LegalPage>;
}
