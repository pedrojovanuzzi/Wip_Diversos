import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheck,
  FiCopy,
  FiDownload,
  FiRefreshCw,
  FiSearch,
  FiTool,
} from "react-icons/fi";
import { NavBar } from "../../components/navbar/NavBar";
import { ErrorMessage } from "./components/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { parseUptime } from "./ClientAnalytics";

type ClienteSemQueue = {
  servidor: string;
  pppoe: string;
  ip: string;
  upTime: string;
  callerId: string;
  plano?: string;
  erro?: string;
};

const Spinner: React.FC<{ text?: string }> = ({ text }) => (
  <span className="inline-flex items-center gap-2 text-slate-400">
    <svg className="animate-spin size-4" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
    {text && <span className="text-xs">{text}</span>}
  </span>
);

export const ClientesSemQueue = () => {
  const [lista, setLista] = useState<ClienteSemQueue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null,
  );
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [reparando, setReparando] = useState<Set<string>>(new Set());
  const [reparandoTodos, setReparandoTodos] = useState(false);

  // Popup de login do mkauth
  const [mostrarLoginMk, setMostrarLoginMk] = useState(false);
  const [mkUsuario, setMkUsuario] = useState("");
  const [mkSenha, setMkSenha] = useState("");
  const [mkGa, setMkGa] = useState("");
  const [logandoMk, setLogandoMk] = useState(false);
  const [mkLoginErro, setMkLoginErro] = useState<string | null>(null);
  const [pendenteReparar, setPendenteReparar] = useState<string[] | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.token;
  const podeDesligar = (user?.permission ?? 0) >= 5;

  const fetchLista = async () => {
    setLoading(true);
    setError(null);
    setLista([]);
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/ClientAnalytics/ClientsWithoutQueue",
        { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 },
      );
      setLista(response.data);
    } catch (e) {
      setError("Falha ao consultar clientes sem queue: " + e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const erros = lista.filter((c) => c.erro);
  const clientes = lista.filter((c) => !c.erro);

  const filtrados = clientes
    .filter((c) => {
      const q = filtro.trim().toLowerCase();
      if (!q) return true;
      return (
        c.pppoe?.toLowerCase().includes(q) ||
        c.ip?.toLowerCase().includes(q) ||
        c.servidor?.toLowerCase().includes(q) ||
        c.callerId?.toLowerCase().includes(q) ||
        c.plano?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => parseUptime(a.upTime ?? "") - parseUptime(b.upTime ?? ""));

  const idDe = (f: ClienteSemQueue) => `${f.servidor}::${f.pppoe}`;
  const todosSelecionados =
    filtrados.length > 0 && filtrados.every((f) => selecionados.has(idDe(f)));
  const qtdSelecionados = filtrados.filter((f) =>
    selecionados.has(idDe(f)),
  ).length;

  const toggleSelecionado = (f: ClienteSemQueue) => {
    const id = idDe(f);
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleTodos = () => {
    setSelecionados((prev) => {
      const todos =
        filtrados.length > 0 && filtrados.every((f) => prev.has(idDe(f)));
      return todos ? new Set() : new Set(filtrados.map(idDe));
    });
  };

  const copiarNome = async (pppoe: string) => {
    try {
      await navigator.clipboard.writeText(pppoe);
      setCopiado(pppoe);
      setTimeout(() => setCopiado((atual) => (atual === pppoe ? null : atual)), 1500);
    } catch {
      // fallback para navegadores/contexto sem clipboard API
      const ta = document.createElement("textarea");
      ta.value = pppoe;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiado(pppoe);
      setTimeout(() => setCopiado((atual) => (atual === pppoe ? null : atual)), 1500);
    }
  };

  const exportarExcel = () => {
    const linhas = filtrados.map((c) => ({
      Servidor: c.servidor,
      PPPOE: c.pppoe,
      Plano: c.plano ?? "",
      "Caller ID": c.callerId,
      IP: c.ip,
      Uptime: c.upTime,
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sem Queue");
    XLSX.writeFile(
      wb,
      `Clientes_Sem_Queue_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  // Executa o reparo; se faltar sessão no mkauth, abre o popup de login
  // e guarda os logins pendentes pra tentar de novo depois de logar.
  const executarReparar = async (
    logins: string[],
    okTexto: string,
  ): Promise<boolean> => {
    setAviso(null);
    try {
      await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/RepararMkauth",
        { logins },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 35000 },
      );
      setAviso({ tipo: "ok", texto: okTexto });
      return true;
    } catch (e: any) {
      if (e?.response?.status === 401 && e?.response?.data?.precisaLogin) {
        setPendenteReparar(logins);
        setMkLoginErro(null);
        setMostrarLoginMk(true);
        return false;
      }
      setAviso({
        tipo: "erro",
        texto: e?.response?.data?.error || "Falha ao reparar no mkauth.",
      });
      return false;
    }
  };

  const repararUm = async (pppoe: string) => {
    setReparando((s) => new Set(s).add(pppoe));
    await executarReparar([pppoe], `"${pppoe}" enviado para reparo no mkauth.`);
    setReparando((s) => {
      const n = new Set(s);
      n.delete(pppoe);
      return n;
    });
  };

  const repararSelecionados = async () => {
    const alvos = filtrados
      .filter((f) => selecionados.has(idDe(f)))
      .map((f) => f.pppoe);
    if (alvos.length === 0) return;
    if (!window.confirm(`Reparar ${alvos.length} cliente(s) no mkauth?`)) return;
    setReparandoTodos(true);
    const ok = await executarReparar(
      alvos,
      `${alvos.length} cliente(s) enviados para reparo no mkauth.`,
    );
    if (ok) setSelecionados(new Set());
    setReparandoTodos(false);
  };

  const fazerLoginMk = async () => {
    if (!mkUsuario || !mkSenha) {
      setMkLoginErro("Informe usuário e senha.");
      return;
    }
    setMkLoginErro(null);
    setLogandoMk(true);
    try {
      await axios.post(
        process.env.REACT_APP_URL + "/ClientAnalytics/MkauthLogin",
        { usuario: mkUsuario, senha: mkSenha, ga: mkGa },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 35000 },
      );
      setMostrarLoginMk(false);
      setMkSenha("");
      setMkGa("");
      // Tenta de novo o reparo que estava pendente.
      if (pendenteReparar && pendenteReparar.length > 0) {
        const alvos = pendenteReparar;
        setPendenteReparar(null);
        const ok = await executarReparar(
          alvos,
          `${alvos.length} cliente(s) enviados para reparo no mkauth.`,
        );
        if (ok) setSelecionados(new Set());
      }
    } catch (e: any) {
      setMkLoginErro(
        e?.response?.data?.error || "Falha ao logar no mkauth.",
      );
    } finally {
      setLogandoMk(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <NavBar />

      {/* Popup de login do mkauth */}
      {mostrarLoginMk && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <FiTool className="text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Login do mkauth
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Informe o usuário e senha admin do painel para reparar os clientes.
            </p>

            <label className="block text-xs font-medium text-slate-600 mb-1">
              Usuário
            </label>
            <input
              type="text"
              autoFocus
              value={mkUsuario}
              onChange={(e) => setMkUsuario(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />

            <label className="block text-xs font-medium text-slate-600 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={mkSenha}
              onChange={(e) => setMkSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !logandoMk) fazerLoginMk();
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />

            <label className="block text-xs font-medium text-slate-600 mt-3 mb-1">
              Google Authenticator{" "}
              <span className="text-slate-400">(se a conta exigir)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mkGa}
              onChange={(e) => setMkGa(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !logandoMk) fazerLoginMk();
              }}
              placeholder="000000"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />

            {mkLoginErro && (
              <p className="mt-3 text-xs text-rose-600">{mkLoginErro}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setMostrarLoginMk(false);
                  setPendenteReparar(null);
                  setMkSenha("");
                  setMkGa("");
                  setMkLoginErro(null);
                }}
                disabled={logandoMk}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={fazerLoginMk}
                disabled={logandoMk}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
              >
                {logandoMk && (
                  <svg className="animate-spin size-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                )}
                {logandoMk ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex rounded-xl p-2.5 bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
            <FiAlertTriangle className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Clientes sem Queue
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Clientes conectados (PPPoE ativo) que não possuem uma simple queue
              correspondente no Mikrotik.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por PPPoE, IP, servidor ou MAC"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
            <button
              onClick={exportarExcel}
              disabled={loading || filtrados.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar a lista atual para Excel (.xlsx)"
            >
              <FiDownload />
              Exportar Excel
            </button>
            <button
              onClick={fetchLista}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              {loading ? "Buscando…" : "Atualizar"}
            </button>
          </div>
        </div>

        {/* Avisos de erro por servidor */}
        {erros.length > 0 && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
            <p className="font-semibold mb-1">
              Não foi possível consultar alguns servidores:
            </p>
            <ul className="list-disc list-inside text-xs">
              {erros.map((e, i) => (
                <li key={i}>
                  {e.servidor}: {e.erro}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Aviso de ação (derrubar) */}
        {aviso && (
          <div
            className={`mt-4 rounded-xl border px-4 py-2 text-sm ${
              aviso.tipo === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {aviso.texto}
          </div>
        )}

        {/* Lista */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Resultado
              </h2>
              <p className="text-xs text-slate-500">
                Encontrados: {clientes.length}
                {filtro && ` · Exibindo: ${filtrados.length}`}
                {podeDesligar &&
                  qtdSelecionados > 0 &&
                  ` · Selecionados: ${qtdSelecionados}`}
              </p>
            </div>
            {podeDesligar && (
              <div className="flex items-center gap-2">
              <button
                onClick={repararSelecionados}
                disabled={qtdSelecionados === 0 || reparandoTodos}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reparar (mkauth) todos os selecionados"
              >
                {reparandoTodos ? (
                  <svg className="animate-spin size-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                ) : (
                  <FiTool />
                )}
                {reparandoTodos
                  ? "Reparando…"
                  : `Reparar (mkauth)${
                      qtdSelecionados > 0 ? ` (${qtdSelecionados})` : ""
                    }`}
              </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6">
                <Spinner text="Cruzando PPPoE ativos × queues…" />
              </div>
            ) : error ? (
              <div className="p-6">
                <ErrorMessage message={error} />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">
                Nenhum cliente conectado sem queue encontrado.
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase tracking-wide">
                    <tr>
                      {podeDesligar && (
                        <th className="px-3 py-2 text-center font-semibold w-10">
                          <input
                            type="checkbox"
                            checked={todosSelecionados}
                            onChange={toggleTodos}
                            title="Selecionar todos"
                            className="size-4 accent-rose-600 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="px-3 py-2 text-left font-semibold">
                        Servidor
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        PPPOE
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Plano
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Caller ID
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">IP</th>
                      <th className="px-3 py-2 text-left font-semibold">
                        Uptime
                      </th>
                      <th className="px-3 py-2 text-center font-semibold">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filtrados.map((f, i) => (
                      <tr
                        key={`${f.pppoe}-${i}`}
                        className="hover:bg-slate-50 cursor-pointer"
                        title="Abrir no Client Analytics"
                        onClick={() =>
                          navigate("/ClientAnalytics", {
                            state: { pppoe: f.pppoe },
                          })
                        }
                      >
                        {podeDesligar && (
                          <td
                            className="px-3 py-2 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selecionados.has(idDe(f))}
                              onChange={() => toggleSelecionado(f)}
                              className="size-4 accent-rose-600 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2">{f.servidor}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {f.pppoe}
                        </td>
                        <td className="px-3 py-2">
                          {f.plano ? (
                            f.plano
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{f.callerId}</td>
                        <td className="px-3 py-2 font-mono">{f.ip}</td>
                        <td className="px-3 py-2">{f.upTime}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copiarNome(f.pppoe);
                              }}
                              title="Copiar PPPoE"
                              className={`inline-flex items-center justify-center size-7 rounded-lg border transition ${
                                copiado === f.pppoe
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              {copiado === f.pppoe ? (
                                <FiCheck className="size-3.5" />
                              ) : (
                                <FiCopy className="size-3.5" />
                              )}
                            </button>
                            {podeDesligar && (
                              <button
                                disabled={reparando.has(f.pppoe)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  repararUm(f.pppoe);
                                }}
                                title="Reparar no mkauth"
                                className="inline-flex items-center justify-center size-7 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {reparando.has(f.pppoe) ? (
                                  <svg
                                    className="animate-spin size-3.5"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                      fill="none"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8v8z"
                                    />
                                  </svg>
                                ) : (
                                  <FiTool className="size-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
