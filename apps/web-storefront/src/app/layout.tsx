import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme Storefront",
  description: "Vitrine publica base para o marketplace multi-tenant."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
