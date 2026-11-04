import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  FaBell,
  FaQrcode,
  FaDesktop,
  FaExclamationTriangle,
  FaTv,
  FaCopy,
  FaWhatsapp,
  FaCheck,
  FaTimes,
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

/**
 * Pendência: nível atenção (laranja). Watch TV no cadastro esperando o
 * cliente receber o link e criar a conta.
 */
interface Pendencia {
  id: string;
  nivel: "atencao";
  tipo: "watch_conta";
  titulo: string;
  cliente: string;
  login: string;
  celular: string;
  link: string;
  criadoEm: string;
  expiraEm: string;
}

/** De quanto em quanto tempo o sino pergunta se entrou pagamento. */
const INTERVALO_MS = 45_000;

/** Guarda o que já foi visto, para o contador não zerar a cada página. */
const CHAVE_VISTOS = "pix_notificacoes_vistos";
const CHAVE_LISTA = "pix_notificacoes_lista";
/** Pendências que este atendente marcou como enviadas. */
const CHAVE_ENVIADOS = "watch_links_enviados";
/** Pendências que já apareceram no canto da tela, para não repetir. */
const CHAVE_AVISADOS = "watch_links_avisados";

function lerIds(chave: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chave) || "[]"));
  } catch {
    return new Set();
  }
}

function gravarIds(chave: string, ids: Set<string>) {
  try {
    localStorage.setItem(chave, JSON.stringify([...ids].slice(-200)));
  } catch {
    // Sem armazenamento: a pendência só volta a aparecer.
  }
}

function linkWhatsapp(p: Pendencia) {
  const numero = String(p.celular || "").replace(/\D/g, "");
  const texto =
    `Olá${p.cliente ? `, ${p.cliente.split(" ")[0]}` : ""}! ` +
    `A sua Watch TV já está liberada. Para começar a assistir, crie a sua ` +
    `conta por este link: ${p.link}`;
  const destino = numero
    ? numero.startsWith("55")
      ? numero
      : `55${numero}`
    : "";
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

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
 * Três níveis:
 * - baixo: pagamentos recebidos, em cinza. Acumulam e somem com "Limpar".
 * - atenção: Watch TV esperando o link ser enviado ao cliente, em laranja.
 *   Some quando o cliente cria a conta, quando o link vence ou quando o
 *   atendente marca "Já enviei". A primeira vez também aparece no canto da tela.
 * - importante: licença com mensalidade vencida, em vermelho piscando. Vêm do
 *   estado atual a cada consulta, então só somem quando a mensalidade é paga
 *   (ou cancelada); "Limpar" não as apaga.
 */
export const SinoPagamentos = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(lerLista);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [enviados, setEnviados] = useState<Set<string>>(() =>
    lerIds(CHAVE_ENVIADOS),
  );
  const [avisos, setAvisos] = useState<Pendencia[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);
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

      const abertas: Pendencia[] = dados.pendencias ?? [];
      setPendencias(abertas);
      // Pendência nova vai para o canto da tela uma vez só.
      const avisados = lerIds(CHAVE_AVISADOS);
      const enviadosAgora = lerIds(CHAVE_ENVIADOS);
      const novasPendencias = abertas.filter(
        (p) => !avisados.has(p.id) && !enviadosAgora.has(p.id),
      );
      if (novasPendencias.length > 0) {
        novasPendencias.forEach((p) => avisados.add(p.id));
        gravarIds(CHAVE_AVISADOS, avisados);
        setAvisos((atuais) => [
          ...atuais,
          ...novasPendencias.filter((p) => !atuais.some((a) => a.id === p.id)),
        ]);
      }

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

  const copiar = async (p: Pendencia) => {
    try {
      await navigator.clipboard.writeText(p.link);
      setCopiado(p.id);
      setTimeout(
        () => setCopiado((atual) => (atual === p.id ? null : atual)),
        2000,
      );
    } catch {
      window.prompt("Copie o link:", p.link);
    }
  };

  const marcarEnviado = (id: string) => {
    setEnviados((atuais) => {
      const novos = new Set(atuais).add(id);
      gravarIds(CHAVE_ENVIADOS, novos);
      return novos;
    });
    fecharAviso(id);
  };

  const fecharAviso = (id: string) =>
    setAvisos((atuais) => atuais.filter((a) => a.id !== id));

  if (!token) return null;

  const temAlerta = alertas.length > 0;
  const pendentes = pendencias.filter((p) => !enviados.has(p.id));
  const temPendencia = pendentes.length > 0;
  // O aviso do canto só fica enquanto a pendência existir.
  const avisosAbertos = avisos.filter((a) =>
    pendentes.some((p) => p.id === a.id),
  );

  /** Botões de copiar, WhatsApp e "Já enviei", iguais no sino e no canto. */
  const acoes = (p: Pendencia) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button
        onClick={() => copiar(p)}
        className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-orange-800 ring-1 ring-orange-300 hover:bg-orange-100"
      >
        <FaCopy className="size-3" />
        {copiado === p.id ? "Copiado!" : "Copiar link"}
      </button>
      <a
        href={linkWhatsapp(p)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
      >
        <FaWhatsapp className="size-3" />
        WhatsApp
      </a>
      <button
        onClick={() => marcarEnviado(p.id)}
        title="Tira o aviso desta tela. Ele some para todos quando o cliente criar a conta."
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
      >
        <FaCheck className="size-3" />
        Já enviei
      </button>
    </div>
  );

  return (
    <>
      {avisosAbertos.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 sm:w-96">
          {avisosAbertos.slice(-3).map((p) => (
            <div
              key={p.id}
              role="alert"
              className="rounded-xl border border-orange-300 border-l-4 border-l-orange-500 bg-orange-50 p-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                  <FaTv className="size-3" />
                  {p.titulo}
                </span>
                <button
                  onClick={() => fecharAviso(p.id)}
                  title="Fechar. Continua no sino até o link ser enviado."
                  className="text-orange-500 hover:text-orange-700"
                >
                  <FaTimes className="size-3.5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-orange-900">
                <b>{p.cliente || p.login}</b> já tem a Watch TV no cadastro.
                Envie o link para criar a conta.
              </p>
              {acoes(p)}
            </div>
          ))}
        </div>
      )}
      <div ref={painel} className="fixed right-4 top-4 z-50">
        <button
          onClick={abrir}
          title={
            temAlerta
              ? `${alertas.length} licença(s) sem pagamento`
              : temPendencia
                ? `${pendentes.length} link(s) da Watch TV para enviar`
                : "Notificações"
          }
          className={`relative flex size-11 items-center justify-center rounded-full text-white shadow-lg transition ${
            temAlerta
              ? "animate-pulse bg-red-600 ring-4 ring-red-300 hover:bg-red-700"
              : temPendencia
                ? "bg-orange-500 ring-4 ring-orange-200 hover:bg-orange-600"
                : "bg-stone-800 hover:bg-stone-700"
          }`}
        >
          <FaBell className="size-5" />
          {(temAlerta || temPendencia || naoVistos > 0) && (
            <span
              className={`absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                temAlerta
                  ? "bg-white text-red-600"
                  : temPendencia
                    ? "bg-white text-orange-600"
                    : "bg-gray-500 text-white"
              }`}
            >
              {(() => {
                const n = temAlerta
                  ? alertas.length
                  : temPendencia
                    ? pendentes.length
                    : naoVistos;
                return n > 99 ? "99+" : n;
              })()}
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

              {pendentes.map((p) => (
                <div
                  key={p.id}
                  className="border-b border-orange-200 border-l-4 border-l-orange-500 bg-orange-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                      <FaTv className="size-3" />
                      {p.titulo}
                    </span>
                    <span className="shrink-0 text-xs text-orange-700">
                      {quando(p.criadoEm)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-orange-900">
                    {p.cliente || "-"}
                  </p>
                  <p className="truncate text-xs text-orange-700">
                    {p.login} · link vale até {dataBR(p.expiraEm)}
                  </p>
                  {acoes(p)}
                </div>
              ))}

              {pagamentos.length === 0 && !temAlerta && !temPendencia ? (
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
    </>
  );
};
