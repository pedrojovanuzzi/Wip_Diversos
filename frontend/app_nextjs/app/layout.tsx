import type { Metadata } from "next";
import "./globals.css";
import LocalhostBanner from "@/components/LocalhostBanner";

export const metadata: Metadata = {
  title: "Wip Diversos",
  description: "Wip Diversos — Next.js",
};

import { getUser } from "@/lib/auth";
import { NotificationProvider } from "@/lib/NotificationContext";
import { AuthProvider } from "@/lib/AuthContext";
// Estilos do MUI (emotion) no SSR do App Router. Sem isso as telas com MUI
// piscam sem estilo até o JavaScript carregar.
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <AppRouterCacheProvider>
          <AuthProvider user={user}>
            <NotificationProvider user={user}>
              <LocalhostBanner />
              {children}
            </NotificationProvider>
          </AuthProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
