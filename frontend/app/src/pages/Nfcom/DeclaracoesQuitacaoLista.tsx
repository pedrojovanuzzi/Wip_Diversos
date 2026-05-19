import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { useNavigate } from "react-router-dom";

interface DeclaracaoItem {
  id: number;
  nome: string;
  cpf_cnpj: string;
  login: string | null;
  contrato: string | null;
  data_declaracao: string | null;
  ano_referencia: string | null;
  created_at: string;
}

export default function DeclaracoesQuitacaoLista() {
  const { user } = useAuth();
  const token = user?.token;
  const { showError } = useNotification();
  const navigate = useNavigate();

  const [itens, setItens] = useState<DeclaracaoItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [baixandoId, setBaixandoId] = useState<number | null>(null);

  const [filtroCpf, setFiltroCpf] = useState("");
  const [filtroLogin, setFiltroLogin] = useState("");
  const [filtroAno, setFiltroAno] = useState("");

  const buscar = React.useCallback(async () => {
    setCarregando(true);
    try {
      const params: Record<string, string> = {};
      if (filtroCpf.trim()) params.cpf = filtroCpf.trim();
      if (filtroLogin.trim()) params.login = filtroLogin.trim();
      if (filtroAno.trim()) params.ano = filtroAno.trim();
      const { data } = await axios.get(
        `${process.env.REACT_APP_URL}/NFCom/declaracaoQuitacao/listar`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        },
      );
      setItens(data);
    } catch (err: any) {
      showError(err?.response?.data?.error || "Erro ao listar declarações.");
    } finally {
      setCarregando(false);
    }
  }, [token, filtroCpf, filtroLogin, filtroAno, showError]);

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limparFiltros = () => {
    setFiltroCpf("");
    setFiltroLogin("");
    setFiltroAno("");
  };

  const anoAtual = new Date().getFullYear();
  const anosOpcoes: number[] = [];
  for (let a = anoAtual + 1; a >= anoAtual - 10; a--) anosOpcoes.push(a);

  const baixar = async (item: DeclaracaoItem) => {
    setBaixandoId(item.id);
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_URL}/NFCom/declaracaoQuitacao/${item.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!data.pdf_base64) {
        showError("PDF não disponível para esta declaração.");
        return;
      }
      const blob = base64ToBlob(data.pdf_base64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `declaracao-quitacao-${item.id}-${(item.cpf_cnpj || "").replace(/\D/g, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err?.response?.data?.error || "Erro ao baixar declaração.");
    } finally {
      setBaixandoId(null);
    }
  };

  const fmtData = (s: string | null) => {
    if (!s) return "-";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <div>
      <NavBar />
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-semibold">
            Declarações de Quitação emitidas
          </h1>
          <button
            onClick={() => navigate("/Nfcom/DeclaracaoQuitacao")}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-all"
          >
            Nova declaração
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end mb-4 p-3 bg-gray-50 rounded ring-1 ring-gray-200">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-600 mb-1">CPF/CNPJ</label>
            <input
              value={filtroCpf}
              onChange={(e) => setFiltroCpf(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="Digite o CPF/CNPJ"
              className="ring-1 ring-gray-400 p-2 rounded w-full text-sm"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-600 mb-1">Login</label>
            <input
              value={filtroLogin}
              onChange={(e) => setFiltroLogin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="Digite o login"
              className="ring-1 ring-gray-400 p-2 rounded w-full text-sm"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-gray-600 mb-1">Ano</label>
            <select
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              className="ring-1 ring-gray-400 p-2 rounded w-full text-sm"
            >
              <option value="">Todos</option>
              {anosOpcoes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={buscar}
            disabled={carregando}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-all disabled:opacity-60"
          >
            {carregando ? "Buscando..." : "Filtrar"}
          </button>
          <button
            onClick={() => {
              limparFiltros();
              setTimeout(buscar, 0);
            }}
            className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400 transition-all"
          >
            Limpar
          </button>
        </div>

        {carregando ? (
          <p className="text-gray-500">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-gray-500">Nenhuma declaração emitida ainda.</p>
        ) : (
          <div className="overflow-auto ring-1 ring-black ring-opacity-20 rounded">
            <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>ID</Th>
                  <Th>Nome / Razão Social</Th>
                  <Th>CPF/CNPJ</Th>
                  <Th>Login</Th>
                  <Th>Nº Contrato</Th>
                  <Th>Data Declaração</Th>
                  <Th>Ano Ref.</Th>
                  <Th>Emitida em</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {itens.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <Td>{it.id}</Td>
                    <Td>{it.nome}</Td>
                    <Td>{it.cpf_cnpj}</Td>
                    <Td>{it.login || "-"}</Td>
                    <Td>{it.contrato || "-"}</Td>
                    <Td>{fmtData(it.data_declaracao)}</Td>
                    <Td>{it.ano_referencia || "-"}</Td>
                    <Td>{fmtData(it.created_at)}</Td>
                    <Td>
                      <button
                        onClick={() => baixar(it)}
                        disabled={baixandoId === it.id}
                        className="bg-emerald-600 text-white py-1 px-3 rounded hover:bg-emerald-700 transition-all disabled:opacity-60"
                      >
                        {baixandoId === it.id ? "Baixando..." : "Baixar PDF"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-gray-800 whitespace-nowrap">{children}</td>;
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
