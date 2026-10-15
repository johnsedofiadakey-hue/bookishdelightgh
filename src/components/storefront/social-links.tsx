import { InstagramIcon, TikTokIcon } from "@/components/storefront/icons";
import { bookishSocials } from "@/lib/brand";

export function SocialLinks({ className = "" }: { className?: string }) {
  return <div className={`social-icon-links ${className}`.trim()}>
    {bookishSocials.map((social) => <a
      key={social.name}
      className="social-icon-link"
      href={social.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Bookish Delight GH on ${social.name} (${social.handle})`}
      title={social.name}
    >{social.name === "Instagram" ? <InstagramIcon/> : <TikTokIcon/>}</a>)}
  </div>;
}
