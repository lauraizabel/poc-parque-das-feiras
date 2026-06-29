import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Acme Dashboard",
  description: "Painel operacional base para lojistas e operacao da plataforma."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={bodyFont.variable} lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
