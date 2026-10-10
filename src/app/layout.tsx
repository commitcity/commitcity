import type { Metadata } from "next";
import { Jacquard_12, Pixelify_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Sounds } from "@/ui/sound/Sounds";
import "./globals.css";
import "./ui.css";

/** The interface font (ART_DIRECTION.md §16); SIL Open Font License. */
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel", display: "swap" });
/** Pixel blackletter for book titles; SIL Open Font License. */
const blackletter = Jacquard_12({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-blackletter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CommitCity",
  description: "Your code. Your city.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${blackletter.variable}`}>
      <body>
        {children}
        <Sounds />
      </body>
    </html>
  );
}
