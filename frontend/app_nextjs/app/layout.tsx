import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wip Diversos",
  description: "Wip Diversos — Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
