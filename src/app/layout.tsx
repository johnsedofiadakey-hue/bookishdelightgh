import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  // The public preview is reachable by link while the verified catalogue and checkout are prepared.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005"),
  robots: { index: false, follow: false, nocache: true },
  title: "Bookish Delight GH | Children’s books & learning resources in Kumasi",
  description: "Bookish Delight GH sells brand new and preloved children’s books, educational resources and bundle deals from Kumasi, Ghana.",
  applicationName: "Bookish Delight GH",
  openGraph: {
    title: "Bookish Delight GH | Children’s books & learning resources in Kumasi",
    description: "Brand new and preloved children’s books, educational resources and bundle deals, from Kumasi.",
    siteName: "Bookish Delight GH",
    locale: "en_GH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bookish Delight GH",
    description: "Children’s books and educational resources in Kumasi, Ghana.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
