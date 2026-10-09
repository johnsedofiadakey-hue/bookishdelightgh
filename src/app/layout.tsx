import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  // The public preview is reachable by link while the verified catalogue and checkout are prepared.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005"),
  robots: { index: false, follow: false, nocache: true },
  title: "Bookish Delight GH | Children’s books in Ghana",
  description: "Children’s books and learning resources from Bookish Delight GH in Kumasi. Discover stories for babies, early readers and teens.",
  applicationName: "Bookish Delight GH",
  openGraph: {
    title: "Children’s books for growing minds | Bookish Delight GH",
    description: "Stories and learning resources for children, from first books to teen reads. Based in Kumasi, Ghana.",
    siteName: "Bookish Delight GH",
    locale: "en_GH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bookish Delight GH",
    description: "Children’s books and learning resources for babies, early readers and teens in Ghana.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
