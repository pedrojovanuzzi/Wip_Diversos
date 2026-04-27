"use client";

import React, { useEffect, useState } from "react";

export default function LocalhostBanner() {
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    const checkLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    
    setIsLocalhost(checkLocalhost);

    if (checkLocalhost) {
      // Muda o favicon para um SVG laranja
      const link: HTMLLinkElement =
        document.querySelector("link[rel='icon']") || document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.href =
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23f59e0b"/><text x="50" y="68" text-anchor="middle" font-size="50" font-weight="bold" fill="white">D</text></svg>'
        );
      document.head.appendChild(link);
      
      // Ajusta o título
      if (!document.title.startsWith("[DEV]")) {
        document.title = `[DEV] ${document.title}`;
      }

      // Adiciona padding ao body para não cobrir o conteúdo
      document.body.style.paddingTop = "22px";
    }
  }, []);

  if (!isLocalhost) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#f59e0b",
        color: "#000",
        textAlign: "center",
        padding: "2px 0",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "1px",
      }}
    >
      LOCALHOST — AMBIENTE DE DESENVOLVIMENTO
    </div>
  );
}
