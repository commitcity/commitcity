import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import "./ui.css";

/** The interface font (ART_DIRECTION.md §16); SIL Open Font License. */
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: "CommitCity",
  description: "Your code. Your city.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  );
}
