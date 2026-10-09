import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  // The public preview is reachable by link while the verified catalogue and checkout are prepared.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005"),
  robots: { index: false, follow: false, nocache: true },
  title: "Bookish Delight GH | Books for all ages in Kumasi",
  description: "Bookish Delight GH is a Kumasi bookshop for children and adults. Ask us about a title while we add our stock online.",
  applicationName: "Bookish Delight GH",
  openGraph: {
    title: "Bookish Delight GH | Books for all ages in Kumasi",
    description: "A Kumasi bookshop for children and adults. Ask us about a title while we add our stock online.",
    siteName: "Bookish Delight GH",
    locale: "en_GH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bookish Delight GH",
    description: "Books for children and adults in Kumasi, Ghana.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
