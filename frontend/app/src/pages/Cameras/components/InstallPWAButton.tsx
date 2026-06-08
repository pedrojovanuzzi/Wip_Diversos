import React, { useCallback, useEffect, useState } from "react";
import { MdInstallMobile } from "react-icons/md";

/** Evento beforeinstallprompt (não tipado no lib.dom padrão). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CAMERAS_MANIFEST = "/cameras-manifest.json";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
}

/**
 * Botão "Instalar app" para o Portal/Login de Câmeras.
 * - Aponta o <link rel="manifest"> para o manifest das câmeras enquanto montado
 *   (o app instalado abre direto em /Cameras/Login).
 * - Registra um service worker (escopo /Cameras/) — requisito de instalação.
 * - Usa o evento beforeinstallprompt (Android/desktop). No iOS, mostra instruções.
 */
export default function InstallPWAButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Troca o manifest (e o ícone do iOS) para o das câmeras e registra o SW.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = link?.getAttribute("href") || null;
    if (link) link.setAttribute("href", CAMERAS_MANIFEST);

    const apple = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );
    const prevApple = apple?.getAttribute("href") || null;
    if (apple) apple.setAttribute("href", "/cameras-icon-192.png");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/cameras-sw.js", { scope: "/Cameras/" })
        .catch(() => {
          /* sem SW o app ainda funciona; só não fica instalável */
        });
    }

    return () => {
      if (link && prevHref) link.setAttribute("href", prevHref);
      if (apple && prevApple) apple.setAttribute("href", prevApple);
    };
  }, []);

  // Captura o prompt de instalação e o estado de "instalado".
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIOS()) {
      setShowIosHelp(true);
    }
  }, [deferred]);

  // Já instalado, ou navegador sem suporte (nem prompt nem iOS): não mostra nada.
  if (installed) return null;
  if (!deferred && !isIOS()) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          className ||
          "inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        }
        title="Instalar o Portal de Câmeras no seu dispositivo"
      >
        <MdInstallMobile /> Instalar app
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="bg-white rounded-lg p-5 max-w-sm w-full text-sm text-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <MdInstallMobile className="text-indigo-600" /> Instalar no iPhone/iPad
            </h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima)
                na barra do Safari.
              </li>
              <li>
                Escolha <b>Adicionar à Tela de Início</b>.
              </li>
              <li>
                Confirme em <b>Adicionar</b>.
              </li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-4 w-full rounded-md bg-indigo-600 py-2 font-medium text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
