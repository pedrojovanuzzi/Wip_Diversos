import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { FaCog, FaEnvelope, FaFileExcel, FaSearch } from "react-icons/fa";
import { paginaMk } from "./mkauthEstilo";
import { Botao, cabecalhoGrade, caixinha, campo as campoUi, Celula } from "./ConfigUi";
import { EnviarLote } from "./EnviarLote";
import { ConfiguracoesMensalidades } from "./ConfiguracoesMensalidades";
import { SeloWipDiversos } from "./SeloWipDiversos";
import { useNotification } from "../../context/NotificationContext";

interface ClienteMk {
  id: number;
  uuid: string | null;
  login: string;
  nome: string;
  plano: string | null;
  ip: string | null;
  ramal: string | null;
  bloqueado: string;
  cli_ativado: string;
  /** full | down (redução de velocidade) | bloq, como no MK-Auth. */
  status_corte: string | null;
  /** "sim": em observação (liberado até rem_obs, ex.: depois de pagar). */
  observacao: string | null;
  /** Até quando fica em observação, "dd/mm/aaaa hh:mm". */
  rem_obs: string | null;
  abertos: number;
  /** Boleto automático do Wip Diversos ligado para o cliente. */
  automatico: boolean;
}

// Mesmas opções do "Filtro" da busca de clientes do MK-Auth (as que fazem
// sentido aqui).
const CAMPOS = [
  { valor: "nome", rotulo: "nome completo" },
  { valor: "nome_res", rotulo: "nome resumido" },
  { valor: "login", rotulo: "login" },
  { valor: "cpf_cnpj", rotulo: "cpf / cnpj" },
  { valor: "email", rotulo: "email" },
  { valor: "plano", rotulo: "plano" },
  { valor: "ip", rotulo: "ip" },
  { valor: "endereco", rotulo: "endereco" },
  { valor: "bairro", rotulo: "bairro" },
  { valor: "cidade", rotulo: "cidade" },
  { valor: "celular", rotulo: "celular" },
];

const TIPOS = [
  { valor: "todos", rotulo: "TODOS" },
  { valor: "liberados", rotulo: "LIBERADOS" },
  { valor: "bloqueados", rotulo: "BLOQUEADOS" },
  { valor: "desativados", rotulo: "DESATIVADOS" },
];

export function Mensalidades() {
  const { user } = useAuth();
  const token = user?.token;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Estado na URL: voltar do detalhe cai na mesma página e na mesma busca.
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  const porPagina = params.get("porPagina") === "100" ? 100 : 50;
  const tipo = params.get("tipo") || "todos";
  const campo = params.get("campo") || "nome";
  const busca = params.get("busca") || "";

  const [textoBusca, setTextoBusca] = useState(busca);
  const [campoBusca, setCampoBusca] = useState(campo);
  const [clientes, setClientes] = useState<ClienteMk[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  // Marcados para o envio em lote. Valem entre páginas e buscas.
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [ocupado, setOcupado] = useState<"" | "todos" | "ligar" | "desligar">("");
  const [confirmarAuto, setConfirmarAuto] = useState<boolean | null>(null);
  const { showError, showSuccess } = useNotification();
  const headers = { Authorization: `Bearer ${token}` };
  const podeEnviarLote = (user?.permission || 0) >= 5;

  const mudar = useCallback(
    (novos: Record<string, string | number>) => {
      const p = new URLSearchParams(params);
      Object.entries(novos).forEach(([k, v]) => {
        if (v === "" || v === undefined) p.delete(k);
        else p.set(k, String(v));
      });
      setParams(p);
    },
    [params, setParams],
  );

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro("");
    axios
      .get(`${process.env.REACT_APP_URL}/mensalidades/clientes`, {
        params: { pagina, porPagina, tipo, campo, busca },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (cancelado) return;
        setClientes(data.clientes);
        setTotal(data.total);
      })
      .catch((e) => {
        if (cancelado) return;
        setClientes([]);
        setTotal(0);
        setErro(e?.response?.data?.message || "Erro ao carregar clientes.");
      })
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [token, pagina, porPagina, tipo, campo, busca, recarga]);

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const rotuloTipo = TIPOS.find((t) => t.valor === tipo)?.rotulo || "TODOS";

  const pesquisar = (e: React.FormEvent) => {
    e.preventDefault();
    mudar({ busca: textoBusca.trim(), campo: campoBusca, pagina: 1 });
  };

  const abrir = (c: ClienteMk) =>
    navigate(`/mensalidades/${encodeURIComponent(c.login)}`);

  const todosDaPagina =
    clientes.length > 0 && clientes.every((c) => marcados.has(c.login));
  const marcarPagina = () =>
    setMarcados((m) => {
      const n = new Set(m);
      clientes.forEach((c) => (todosDaPagina ? n.delete(c.login) : n.add(c.login)));
      return n;
    });
  // Todos os clientes do filtro atual, de todas as páginas.
  const selecionarTodos = async () => {
    setOcupado("todos");
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_URL}/mensalidades/clientes/logins`,
        { params: { tipo, campo, busca }, headers },
      );
      setMarcados(new Set(data.logins as string[]));
    } catch (e: any) {
      showError(e?.response?.data?.message || "Erro ao selecionar os clientes.");
    } finally {
      setOcupado("");
    }
  };

  const definirAutomatico = async (automatico: boolean) => {
    setConfirmarAuto(null);
    setOcupado(automatico ? "ligar" : "desligar");
    try {
      const { data } = await axios.put(
        `${process.env.REACT_APP_URL}/mensalidades/clientes/automatico`,
        { logins: Array.from(marcados), automatico },
        { headers },
      );
      showSuccess(
        `Boleto automático ${automatico ? "ligado" : "desligado"} para ${data.alterados} cliente(s).`,
      );
      setRecarga((n) => n + 1);
    } catch (e: any) {
      showError(e?.response?.data?.message || "Erro ao mudar o boleto automático.");
    } finally {
      setOcupado("");
    }
  };

  const marcar = (login: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      n.has(login) ? n.delete(login) : n.add(login);
      return n;
    });

  const GRADE =
    "md:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,.9fr)_minmax(0,.5fr)_minmax(0,2fr)_190px]";

  return (
    <div style={paginaMk}>
      <NavBar />
      <div className={`max-w-[1500px] mx-auto px-3 sm:px-6 pt-5 ${marcados.size ? "pb-44" : "pb-10"}`}>
        {/* Título da página */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#363636] leading-tight">
                <Link to="/mensalidades" className="hover:text-[#3273dc]">
                  Mensalidades
                </Link>
              </h1>
              <SeloWipDiversos />
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-0.5">
              {carregando ? "Carregando..." : `${total} cliente(s) · ${rotuloTipo.toLowerCase()}`}
            </p>
          </div>
          {/* Relatório e engrenagem: longe do sino do canto. */}
          {podeEnviarLote && (
            <div className="flex flex-wrap gap-2">
            <Link
              to="/mensalidades/relatorio"
              title="Relatório Wip 1 / Wip 2 para Excel"
              className="h-[38px] px-4 inline-flex items-center gap-2 rounded-md bg-white border border-[#dbdbdb] text-[#363636] text-[14px] font-semibold hover:border-[#3273dc] hover:text-[#3273dc] shadow-[0_1px_2px_rgba(0,0,0,.04)]"
            >
              <FaFileExcel className="text-[#257942]" /> <span>Relatório</span>
            </Link>
            <button
              type="button"
              onClick={() => setConfigurando(true)}
              title="Configurações"
              aria-label="Configurações"
              className="h-[38px] px-4 inline-flex items-center gap-2 rounded-md bg-white border border-[#dbdbdb] text-[#363636] text-[14px] font-semibold hover:border-[#3273dc] hover:text-[#3273dc] shadow-[0_1px_2px_rgba(0,0,0,.04)]"
            >
              <FaCog /> <span className="hidden sm:inline">Configurações</span>
            </button>
            </div>
          )}
        </div>

        {/* Filtros e busca */}
        <div className="bg-white rounded-lg border border-[#e3e6ea] shadow-[0_1px_2px_rgba(0,0,0,.04)] p-3 sm:p-4 mb-4">
          <div
            role="tablist"
            aria-label="Tipo de cliente"
            className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-[#f1f2f4] mb-3 max-w-full"
          >
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="tab"
                aria-selected={tipo === t.valor}
                onClick={() => mudar({ tipo: t.valor, pagina: 1 })}
                className={`h-[30px] px-3 rounded-md text-[13px] font-semibold capitalize transition-colors ${
                  tipo === t.valor
                    ? "bg-white text-[#3273dc] shadow-[0_1px_2px_rgba(0,0,0,.08)]"
                    : "text-[#7a7a7a] hover:text-[#363636]"
                }`}
              >
                {t.rotulo.toLowerCase()}
              </button>
            ))}
          </div>

          <form onSubmit={pesquisar} className="flex flex-col sm:flex-row gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Procurar por:</span>
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b5b5b5] text-[13px]" />
              <input
                value={textoBusca}
                onChange={(e) => setTextoBusca(e.target.value)}
                placeholder="digite aqui o que deseja encontrar"
                maxLength={255}
                className={`${campoUi} pl-9 ${busca ? "pr-9" : ""}`}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setTextoBusca("");
                    mudar({ busca: "", pagina: 1 });
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-[#7a7a7a] hover:bg-[#f1f2f4]"
                  title="Limpar busca"
                  aria-label="Limpar busca"
                >
                  ✕
                </button>
              )}
            </label>
            <label className="sm:w-[190px]">
              <span className="sr-only">Filtro:</span>
              <select
                value={campoBusca}
                onChange={(e) => setCampoBusca(e.target.value)}
                className={campoUi}
                title="Procurar em"
              >
                {CAMPOS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <Botao type="submit" variante="primario">
              Buscar
            </Botao>
          </form>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-lg border border-[#e3e6ea] shadow-[0_1px_2px_rgba(0,0,0,.04)] overflow-hidden">
          {/* Barra da seleção */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2.5 border-b border-[#e3e6ea] text-[13px]">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                className={caixinha}
                checked={todosDaPagina}
                onChange={marcarPagina}
                aria-label="Marcar todos os clientes da página"
              />
              Marcar a página
            </label>
            {podeEnviarLote && (
              <button
                type="button"
                disabled={!!ocupado || !total}
                onClick={selecionarTodos}
                className="text-[#3273dc] font-semibold hover:underline disabled:opacity-40"
                title="Marca todos os clientes deste filtro, de todas as páginas"
              >
                {ocupado === "todos" ? "Selecionando..." : `Selecionar todos (${total})`}
              </button>
            )}
            <span className="sm:ml-auto text-[#7a7a7a]">
              {marcados.size ? (
                <b className="text-[#363636]">{marcados.size} cliente(s) marcado(s)</b>
              ) : (
                "Nenhum cliente marcado"
              )}
            </span>
            {marcados.size > 0 && (
              <button
                type="button"
                onClick={() => setMarcados(new Set())}
                className="text-[#3273dc] hover:underline"
              >
                limpar seleção
              </button>
            )}
          </div>

          <div className={`${cabecalhoGrade} ${GRADE}`}>
            <span />
            <span>Login</span>
            <span>Plano</span>
            <span>IP</span>
            <span>Ramal</span>
            <span>Nome</span>
            <span>Boleto automático</span>
          </div>

          {clientes.map((c) => {
            const bloqueado = c.bloqueado === "sim";
            const observacao = c.observacao === "sim";
            const desativado = c.cli_ativado === "n";
            // Mesmas cores do MK-Auth: bloqueado vermelho, em observação
            // verde, desativado cinza (a linha inteira).
            const cor = bloqueado
              ? "text-[#cc0f35] font-bold"
              : observacao
                ? "text-[#257942] font-bold"
                : desativado
                  ? "text-[#b5b5b5]"
                  : "";
            const faixa = bloqueado
              ? "border-l-[#f14668]"
              : observacao
                ? "border-l-[#48c774]"
                : desativado
                  ? "border-l-[#dbdbdb]"
                  : "border-l-transparent";
            const marcado = marcados.has(c.login);
            return (
              <div
                key={c.id}
                role="link"
                tabIndex={0}
                onClick={() => abrir(c)}
                onKeyDown={(e) => e.key === "Enter" && abrir(c)}
                title={
                  observacao && !bloqueado
                    ? `Em observação${c.rem_obs ? ` até ${c.rem_obs}` : ""}`
                    : undefined
                }
                className={`grid grid-cols-[28px_minmax(0,1fr)] ${GRADE} items-start md:items-center gap-x-3 px-3 sm:px-4 py-2.5 border-b border-[#eef0f2] last:border-b-0 border-l-4 ${faixa} ${cor} ${
                  marcado ? "bg-[#f3f7fe]" : "bg-white"
                } cursor-pointer hover:bg-[#f7f9fd] focus:outline-none focus-visible:bg-[#f7f9fd] text-[14px]`}
              >
                <div className="pt-0.5 md:pt-0">
                  <input
                    type="checkbox"
                    className={caixinha}
                    checked={marcado}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => marcar(c.login)}
                    aria-label={`Marcar ${c.login}`}
                  />
                </div>
                <div className="min-w-0 flex flex-col gap-0.5 md:contents">
                  <Celula rotulo="Login" className="truncate font-mono text-[13px]">
                    {c.login}
                  </Celula>
                  <Celula rotulo="Plano">
                    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
                      <span className="truncate">{c.plano}</span>
                      {c.status_corte === "down" && (
                        <span
                          title="Em redução de velocidade (down)"
                          className="px-1.5 rounded-full bg-[#fff3c4] text-[#8a7000] border border-[#ffe08a] text-[10px] leading-[16px] font-bold"
                        >
                          down
                        </span>
                      )}
                    </span>
                  </Celula>
                  <Celula rotulo="IP" className={`truncate font-mono text-[13px] ${c.ip ? "" : "max-md:hidden"}`}>
                    {c.ip}
                  </Celula>
                  <Celula rotulo="Ramal" className={`truncate ${c.ramal ? "" : "max-md:hidden"}`}>
                    {c.ramal}
                  </Celula>
                  <Celula className="order-first md:order-none max-md:text-[15px] max-md:font-semibold">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span>{c.nome}</span>
                      {bloqueado && (
                        <span className="px-1.5 rounded-full bg-[#feecf0] border border-[#fbcbd6] text-[10px] leading-[16px] font-bold">
                          bloqueado
                        </span>
                      )}
                      {observacao && !bloqueado && (
                        <span className="px-1.5 rounded-full bg-[#effaf3] border border-[#c8eed6] text-[10px] leading-[16px] font-bold">
                          em observação
                        </span>
                      )}
                      {c.abertos > 0 && (
                        <span
                          title={`${c.abertos} título(s) em aberto`}
                          className="min-w-[20px] px-1.5 rounded-full bg-[#48c774] text-white text-[10px] leading-[16px] text-center font-bold"
                        >
                          {c.abertos}
                        </span>
                      )}
                    </span>
                  </Celula>
                  <div className="flex items-center justify-between gap-2 mt-1 md:mt-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 rounded-full border text-[11px] leading-[20px] font-bold whitespace-nowrap ${
                        c.automatico
                          ? "bg-[#effaf3] text-[#257942] border-[#c8eed6]"
                          : "bg-[#f5f6f8] text-[#9aa0a6] border-[#e3e6ea]"
                      }`}
                      title={
                        c.automatico
                          ? "A engrenagem gera o boleto e manda os lembretes deste cliente"
                          : "Nada automático para este cliente (marque e clique em Ativar boleto automático)"
                      }
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${c.automatico ? "bg-[#48c774]" : "bg-[#c4c8cc]"}`}
                      />
                      {c.automatico ? "automático" : "sem automático"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrir(c);
                      }}
                      className="text-[12px] font-bold text-[#3273dc] hover:underline whitespace-nowrap"
                    >
                      Faturas ›
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!carregando && clientes.length === 0 && (
            <p className="text-center py-10 text-[15px] text-[#7a7a7a]">
              {erro || "Nenhum cliente encontrado."}
            </p>
          )}
          {carregando && (
            <p className="text-center py-10 text-[15px] text-[#7a7a7a]">Carregando...</p>
          )}
        </div>

        {/* Paginação */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-[13px] text-[#7a7a7a]">
          <label className="flex items-center gap-2">
            Resultados por página:
            <select
              value={porPagina}
              onChange={(e) => mudar({ porPagina: e.target.value, pagina: 1 })}
              className="h-[32px] border border-[#dbdbdb] rounded-md px-2 bg-white text-[#363636]"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="flex items-center gap-1">
            <BotaoPagina desativado={pagina <= 1} onClick={() => mudar({ pagina: 1 })}>
              «
            </BotaoPagina>
            <BotaoPagina desativado={pagina <= 1} onClick={() => mudar({ pagina: pagina - 1 })}>
              ‹
            </BotaoPagina>
            <span className="px-2">
              página <b className="text-[#363636]">{pagina}</b> de {totalPaginas}
            </span>
            <BotaoPagina
              desativado={pagina >= totalPaginas}
              onClick={() => mudar({ pagina: pagina + 1 })}
            >
              ›
            </BotaoPagina>
            <BotaoPagina
              desativado={pagina >= totalPaginas}
              onClick={() => mudar({ pagina: totalPaginas })}
            >
              »
            </BotaoPagina>
          </div>
        </div>
      </div>

      {/* Ações dos clientes marcados: barra fixa embaixo */}
      {podeEnviarLote && marcados.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 px-2 sm:px-6 pb-2 sm:pb-4 pointer-events-none">
          <div
            className="pointer-events-auto max-w-[1100px] mx-auto bg-white rounded-lg border border-[#dbdbdb] shadow-[0_8px_30px_rgba(0,0,0,.18)] p-3 text-[14px]"
            style={{ fontFamily: paginaMk.fontFamily }}
          >
            {confirmarAuto === null ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                <span className="font-bold text-[#363636] sm:mr-1">
                  {marcados.size} marcado(s):
                </span>
                <Botao
                  variante="primario"
                  title="Enviar mensagem aos clientes marcados"
                  aria-label="Enviar mensagem aos clientes marcados"
                  disabled={!!ocupado}
                  onClick={() => setEnviandoLote(true)}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <FaEnvelope /> Enviar mensagem / boleto
                </Botao>
                <Botao
                  variante="sucesso"
                  disabled={!!ocupado}
                  onClick={() => setConfirmarAuto(true)}
                >
                  {ocupado === "ligar" ? "Ativando..." : "Ativar boleto automático"}
                </Botao>
                <Botao disabled={!!ocupado} onClick={() => setConfirmarAuto(false)}>
                  {ocupado === "desligar" ? "Desativando..." : "Desativar boleto automático"}
                </Botao>
                <button
                  type="button"
                  onClick={() => setMarcados(new Set())}
                  className="sm:ml-auto text-[13px] text-[#7a7a7a] hover:text-[#363636] hover:underline"
                >
                  limpar seleção
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-3">
                  {confirmarAuto ? (
                    <>
                      <b>Ativar</b> o boleto automático de{" "}
                      <b>{marcados.size} cliente(s)</b>? A engrenagem passa a criar
                      as mensalidades que faltam, gerar o boleto deles na Efí e mandar
                      os lembretes por e-mail.
                    </>
                  ) : (
                    <>
                      <b>Desativar</b> o boleto automático de{" "}
                      <b>{marcados.size} cliente(s)</b>? Nada automático para eles; os
                      botões manuais continuam funcionando.
                    </>
                  )}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Botao
                    variante={confirmarAuto ? "sucesso" : "escuro"}
                    onClick={() => definirAutomatico(confirmarAuto)}
                  >
                    {confirmarAuto ? "Sim, ativar" : "Sim, desativar"}
                  </Botao>
                  <Botao variante="leve" onClick={() => setConfirmarAuto(null)}>
                    Cancelar
                  </Botao>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {configurando && (
        <ConfiguracoesMensalidades
          token={token}
          onFechar={() => setConfigurando(false)}
        />
      )}
      {enviandoLote && (
        <EnviarLote
          token={token}
          logins={Array.from(marcados)}
          onFechar={() => setEnviandoLote(false)}
          onEnviado={() => setMarcados(new Set())}
        />
      )}
    </div>
  );
}

function BotaoPagina({
  desativado,
  onClick,
  children,
}: {
  desativado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={desativado}
      onClick={onClick}
      className="h-[32px] min-w-[32px] px-2 rounded-md bg-white border border-[#dbdbdb] text-[#363636] hover:border-[#3273dc] hover:text-[#3273dc] disabled:opacity-40 disabled:hover:border-[#dbdbdb] disabled:hover:text-[#363636]"
    >
      {children}
    </button>
  );
}

export default Mensalidades;
