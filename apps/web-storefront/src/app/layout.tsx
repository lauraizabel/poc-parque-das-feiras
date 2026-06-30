import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  DM_Sans,
  Inter,
  Lato,
  Manrope,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: ["400", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Acme Storefront",
  description:
    "Loja online com catálogo, carrinho e checkout em uma experiência mais clara para o cliente final.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const fontVariables = [
    cormorant.variable,
    manrope.variable,
    spaceGrotesk.variable,
    inter.variable,
    playfair.variable,
    lato.variable,
    dmSans.variable,
  ].join(" ");

  return (
    <html className={fontVariables} lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
