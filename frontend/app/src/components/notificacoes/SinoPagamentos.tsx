import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  FaBell,
  FaQrcode,
  FaDesktop,
  FaExclamationTriangle,
} from "react-icons/fa";
import { MdAutorenew } from "react-icons/md";
import { useAuth } from "../../context/AuthContext";

/** Pagamento recebido: nível baixo, só informa. */
interface Pagamento {
  id: string;
  nivel?: "baixo";
  tipo: "normal" | "automatico" | "licenca";
  titulo: string;
  cliente: string;
  referencia: string;
  valor: number;
  pagoEm: string;
}

/** Alerta: nível importante, fica até o problema ser resolvido. */
interface Alerta {
  id: string;
  nivel: "importante";
  tipo: "licenca_vencida";
  titulo: string;
  cliente: string;
  referencia: string;
  valor: number;
  vencimento: string;
}

/** De quanto em quanto tempo o sino pergunta se entrou pagamento. */
const INTERVALO_MS = 45_000;

/** Guarda o que já foi visto, para o contador não zerar a cada página. */
const CHAVE_VISTOS = "pix_notificacoes_vistos";
const CHAVE_LISTA = "pix_notificacoes_lista";

/**
 * Pagamento é nível baixo: tudo em cinza, só o ícone diz a origem
 * (Pix comum, Pix Automático ou licença).
 */
const ICONES = {
  automatico: <MdAutorenew className="size-4" />,
  normal: <FaQrcode className="size-3.5" />,
  licenca: <FaDesktop className="size-3.5" />,
};

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function quando(data: string) {
  const d = new Date(data);
  if (isNaN(d.getTime())) return "";
  const minutos = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  if (minutos < 60 * 24) return `há ${Math.floor(minutos / 60)} h`;
  return d.toLocaleDateString("pt-BR");
}

function dataBR(data: string) {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-");
  return dia ? `${dia}/${mes}/${ano}` : String(data);
}

function lerLista(): Pagamento[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LISTA) || "[]");
  } catch {
    return [];
  }
}

/**
 * Sino de notificações, presente em todas as telas (vive na NavBar).
 *
 * Dois níveis:
 * - baixo: pagamentos recebidos, em cinza. Acumulam e somem com "Limpar".
 * - importante: licença com mensalidade vencida, em vermelho piscando. Vêm do
 *   estado atual a cada consulta, então só somem quando a mensalidade é paga
 *   (ou cancelada); "Limpar" não as apaga.
 */
export const SinoPagamentos = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(lerLista);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [aberto, setAberto] = useState(false);
  const [naoVistos, setNaoVistos] = useState(0);
  const painel = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const token = user?.token;

  const buscar = useCallback(async () => {
    if (!token) return;
    try {
      // Desde a última consulta; na primeira vez, as últimas 24 horas.
      const desde =
        localStorage.getItem(CHAVE_VISTOS) ||
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const resposta = await axios.get(
        `${process.env.REACT_APP_URL}/Pix/notificacoesPagamentos`,
        {
          params: { desde },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const dados = resposta.data ?? {};
      setAlertas(dados.alertas ?? []);

      const novos: Pagamento[] = dados.pagamentos ?? [];
      if (novos.length === 0) return;

      setPagamentos((anteriores) => {
        const conhecidos = new Set(anteriores.map((p) => p.id));
        const inéditos = novos.filter((p) => !conhecidos.has(p.id));
        if (inéditos.length === 0) return anteriores;

        setNaoVistos((n) => n + inéditos.length);
        const lista = [...inéditos, ...anteriores].slice(0, 50);
        localStorage.setItem(CHAVE_LISTA, JSON.stringify(lista));
        return lista;
      });
    } catch {
      // Sem conexão ou sessão expirada: tenta de novo no próximo ciclo.
    }
  }, [token]);

  useEffect(() => {
    buscar();
    const timer = setInterval(buscar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [buscar]);

  // Fecha ao clicar fora, senão o painel fica por cima do conteúdo.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (painel.current && !painel.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  const abrir = () => {
    setAberto((atual) => {
      if (!atual) {
        // Abrir conta como ler: zera o contador e marca o horário.
        setNaoVistos(0);
        localStorage.setItem(CHAVE_VISTOS, new Date().toISOString());
      }
      return !atual;
    });
  };

  const limpar = () => {
    setPagamentos([]);
    localStorage.removeItem(CHAVE_LISTA);
    localStorage.setItem(CHAVE_VISTOS, new Date().toISOString());
    setNaoVistos(0);
  };

  if (!token) return null;

  const temAlerta = alertas.length > 0;

  return (
    <div ref={painel} className="fixed right-4 top-4 z-50">
      <button
        onClick={abrir}
        title={
          temAlerta
            ? `${alertas.length} licença(s) sem pagamento`
            : "Notificações"
        }
        className={`relative flex size-11 items-center justify-center rounded-full text-white shadow-lg transition ${
          temAlerta
            ? "animate-pulse bg-red-600 ring-4 ring-red-300 hover:bg-red-700"
            : "bg-stone-800 hover:bg-stone-700"
        }`}
      >
        <FaBell className="size-5" />
        {(temAlerta || naoVistos > 0) && (
          <span
            className={`absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
              temAlerta ? "bg-white text-red-600" : "bg-gray-500 text-white"
            }`}
          >
            {temAlerta
              ? alertas.length > 99
                ? "99+"
                : alertas.length
              : naoVistos > 99
                ? "99+"
                : naoVistos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 max-h-[70vh] w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notificações
            </h3>
            {pagamentos.length > 0 && (
              <button
                onClick={limpar}
                title="Limpa os pagamentos. Alertas só somem quando forem resolvidos."
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Limpar pagamentos
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {alertas.map((a) => (
              <Link
                key={a.id}
                to="/licencas?aba=mensalidades"
                onClick={() => setAberto(false)}
                className="block animate-pulse border-b border-red-200 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 hover:bg-red-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    <FaExclamationTriangle className="size-3" />
                    {a.titulo}
                  </span>
                  <span className="text-sm font-bold text-red-700">
                    {moeda(a.valor)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-red-900">
                  {a.cliente || "-"}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-red-700">
                    {a.referencia}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-red-700">
                    venceu {dataBR(a.vencimento)}
                  </span>
                </div>
              </Link>
            ))}

            {pagamentos.length === 0 && !temAlerta ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhuma notificação por enquanto.
              </p>
            ) : (
              pagamentos.map((p) => (
                <div
                  key={p.id}
                  className="border-b border-gray-100 border-l-4 border-l-gray-300 bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {ICONES[p.tipo] ?? ICONES.normal}
                      {p.titulo}
                    </span>
                    <span className="text-sm font-semibold text-gray-600">
                      {moeda(p.valor)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-600">
                    {p.cliente || "-"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-400">
                      {p.referencia}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {quando(p.pagoEm)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
