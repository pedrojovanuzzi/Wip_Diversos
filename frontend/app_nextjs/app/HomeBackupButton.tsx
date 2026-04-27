"use client";

import { useState } from "react";
import axios from "axios";

/**
 * Botão "Gerar Backup". Mantemos como Client Component porque é uma ação manual
 * disparada pelo usuário e exibe estado local (loading). O JWT vai pelo cookie
 * (que o backend já consome via Authorization).
 */
export default function HomeBackupButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleBackup() {
    setLoading(true);
    setMsg(null);
    try {
      // Lê o token do cookie do navegador (mesmo formato do app React antigo)
      const cookieMatch = document.cookie.match(/(?:^|;\s*)user=([^;]+)/);
      const tokenRaw = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
      let token: string | null = null;
      if (tokenRaw) {
        try {
          token = JSON.parse(tokenRaw);
        } catch {
          token = tokenRaw;
        }
      }

      const res = await axios.get(
        `${process.env.REACT_APP_URL}/Backup/Backup`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      console.log(res.data);
      setMsg("Backup gerado.");
    } catch (err) {
      console.error(err);
      setMsg("Erro ao gerar backup.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleBackup}
        disabled={loading}
        className="bg-orange-500 text-black border-black transition-colors hover:bg-orange-300 w-full rounded-md p-2 disabled:opacity-60"
      >
        {loading ? "Gerando..." : "Gerar Backup"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </>
  );
}
