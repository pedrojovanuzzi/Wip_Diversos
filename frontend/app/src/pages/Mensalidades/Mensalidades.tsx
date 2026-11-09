import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { FaCog, FaEnvelope } from "react-icons/fa";
import { cabecalhoTabela, linhaZebra, paginaMk } from "./mkauthEstilo";
import { EnviarLote } from "./EnviarLote";
import { ConfiguracoesMensalidades } from "./ConfiguracoesMensalidades";

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
  abertos: number;
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
  }, [token, pagina, porPagina, tipo, campo, busca]);

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
  const marcar = (login: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      n.has(login) ? n.delete(login) : n.add(login);
      return n;
    });

  return (
    <div style={paginaMk}>
      <NavBar />
      <div className="px-3 sm:px-4 pb-10">
        {/* Trilha, como "CLIENTES • TODOS 00011" */}
        <div className="text-center my-6 text-[15px] uppercase">
          <Link to="/mensalidades" className="text-[#3273dc] hover:underline">
            Clientes
          </Link>
          <span className="mx-2">•</span>
          <select
            value={tipo}
            onChange={(e) => mudar({ tipo: e.target.value, pagina: 1 })}
            className="bg-transparent uppercase cursor-pointer outline-none"
            aria-label="Tipo de cliente"
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>{" "}
          {String(total).padStart(5, "0")}
        </div>

        {/* Caixa de busca */}
        <form onSubmit={pesquisar} className="mb-5">
          <div className="flex flex-col sm:flex-row gap-1 sm:items-end">
            <label className="flex-1">
              <strong className="block mb-1 text-[15px]">Procurar por:</strong>
              <input
                value={textoBusca}
                onChange={(e) => setTextoBusca(e.target.value)}
                placeholder="digite aqui o que deseja encontrar"
                maxLength={255}
                className="w-full h-[30px] border border-[#dbdbdb] rounded px-2 text-[15px] placeholder-[#b5b5b5] focus:outline-none focus:border-[#3273dc]"
              />
            </label>
            <label className="sm:w-[170px]">
              <strong className="block mb-1 text-[15px]">Filtro:</strong>
              <select
                value={campoBusca}
                onChange={(e) => setCampoBusca(e.target.value)}
                className="w-full h-[30px] border border-[#dbdbdb] rounded px-2 text-[15px] bg-white"
              >
                {CAMPOS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-1">
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setTextoBusca("");
                    mudar({ busca: "", pagina: 1 });
                  }}
                  className="h-[30px] px-3 rounded bg-[#363636] text-white text-sm"
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="h-[30px] px-3 rounded bg-[#363636] text-white text-sm"
              >
                IR
              </button>
              {/* Engrenagem: fica junto do IR, longe do sino do canto. */}
              {podeEnviarLote && (
                <button
                  type="button"
                  onClick={() => setConfigurando(true)}
                  title="Configurações"
                  aria-label="Configurações"
                  className="h-[30px] w-[30px] flex items-center justify-center rounded bg-[#363636] text-white text-sm"
                >
                  <FaCog />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Lista */}
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 min-w-[640px]">
            <thead>
              <tr className={cabecalhoTabela}>
                <th className="px-1 py-0.5 w-[30%]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={todosDaPagina}
                      onChange={marcarPagina}
                      aria-label="Marcar todos os clientes da página"
                    />
                    Login
                  </label>
                </th>
                <th className="px-1 py-0.5 w-[20%]">Plano</th>
                <th className="px-1 py-0.5 w-[10%]">IP</th>
                <th className="px-1 py-0.5 w-[10%]">Ramal</th>
                <th className="px-1 py-0.5">Nome</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => {
                const bloqueado = c.bloqueado === "sim";
                const cor = bloqueado
                  ? "text-[#f14668] font-bold"
                  : c.cli_ativado === "n"
                    ? "text-[#b5b5b5]"
                    : "";
                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className={`${linhaZebra(i)} ${cor} cursor-pointer hover:bg-[#eef3fc]`}
                      onClick={() => abrir(c)}
                    >
                      <td className="px-1 pt-0.5 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="mr-1 align-middle"
                          checked={marcados.has(c.login)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => marcar(c.login)}
                          aria-label={`Marcar ${c.login}`}
                        />
                        <span className="text-[#f14668] mr-1">+</span>
                        {c.login}
                      </td>
                      <td className="px-1 pt-0.5">{c.plano}</td>
                      <td className="px-1 pt-0.5">{c.ip}</td>
                      <td className="px-1 pt-0.5">{c.ramal}</td>
                      <td className="px-1 pt-0.5">
                        <span className="relative">
                          {c.nome}
                          {c.abertos > 0 && (
                            <span
                              title={`${c.abertos} título(s) em aberto`}
                              className="absolute -top-2 -right-4 min-w-[18px] h-[13px] px-1 rounded-full bg-[#48c774] text-white text-[9px] leading-[13px] text-center font-normal"
                            >
                              {c.abertos}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                    <tr className={linhaZebra(i)}>
                      <td colSpan={5} className="px-1 pb-0.5">
                        <button
                          type="button"
                          onClick={() => abrir(c)}
                          className="text-[12px] font-bold text-[#46484a] hover:underline"
                        >
                          Faturas
                        </button>
                        <span className="text-[12px] text-[#46484a]"> |</span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {!carregando && clientes.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-[15px]">
                    {erro || "Nenhum cliente encontrado."}
                  </td>
                </tr>
              )}
              {carregando && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-[15px]">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ações dos clientes marcados */}
        {podeEnviarLote && (
          <div className="flex flex-wrap items-center gap-2 mt-4 text-[14px]">
            <button
              type="button"
              title="Enviar mensagem aos clientes marcados"
              aria-label="Enviar mensagem aos clientes marcados"
              disabled={!marcados.size}
              onClick={() => setEnviandoLote(true)}
              className="h-[25px] px-2 flex items-center gap-2 rounded-[3px] text-white bg-[#3273dc] disabled:opacity-40"
            >
              <FaEnvelope /> Enviar mensagem / boleto
            </button>
            <span>
              {marcados.size
                ? `${marcados.size} cliente(s) marcado(s)`
                : "Marque os clientes na caixinha ao lado do login."}
            </span>
            {marcados.size > 0 && (
              <button
                type="button"
                onClick={() => setMarcados(new Set())}
                className="text-[#3273dc] hover:underline"
              >
                limpar
              </button>
            )}
          </div>
        )}

        {/* Paginação */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-[14px]">
          <label className="flex items-center gap-2">
            Resultados por página:
            <select
              value={porPagina}
              onChange={(e) => mudar({ porPagina: e.target.value, pagina: 1 })}
              className="h-[28px] border border-[#dbdbdb] rounded px-1 bg-white"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="flex items-center gap-1">
            <BotaoPagina
              desativado={pagina <= 1}
              onClick={() => mudar({ pagina: 1 })}
            >
              «
            </BotaoPagina>
            <BotaoPagina
              desativado={pagina <= 1}
              onClick={() => mudar({ pagina: pagina - 1 })}
            >
              ‹
            </BotaoPagina>
            <span className="px-2">
              página {pagina} de {totalPaginas}
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
      className="h-[28px] min-w-[28px] px-2 rounded bg-[#363636] text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export default Mensalidades;
