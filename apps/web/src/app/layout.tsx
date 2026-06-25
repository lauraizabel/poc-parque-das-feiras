import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme SaaS",
  description: "Monorepo base com Next.js, NestJS, Prisma, Redis e Stripe Connect."
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
