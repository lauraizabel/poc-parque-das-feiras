import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme Dashboard",
  description: "Painel operacional base para lojistas e operacao da plataforma."
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
