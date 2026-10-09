import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./admin.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Admin | Bookish Delight", template: "%s · Admin | Bookish Delight" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#20253b" };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className={`adm ${inter.variable}`}>{children}</div>;
}
