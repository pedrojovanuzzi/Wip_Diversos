import type { Metadata } from "next";
import "./globals.css";
import LocalhostBanner from "@/components/LocalhostBanner";

export const metadata: Metadata = {
  title: "Wip Diversos",
  description: "Wip Diversos — Next.js",
};

import { getUser } from "@/lib/auth";
import { NotificationProvider } from "@/lib/NotificationContext";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <NotificationProvider user={user}>
          <LocalhostBanner />
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
