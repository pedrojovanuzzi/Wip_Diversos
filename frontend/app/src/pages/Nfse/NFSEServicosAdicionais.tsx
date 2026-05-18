import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

interface ClienteServico {
  login: string;
  nome: string;
  email: string;
  cidade: string;
  cpf_cnpj: string;
  cli_ativado: string;
  qtd_streamer: number | string;
  qtd_camera: number | string;
  valor_streamer: number | string;
  valor_camera: number | string;
  valor_total: number | string;
}

export const NFSEServicosAdicionais: React.FC = () => {
  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const [clientes, setClientes] = useState<ClienteServico[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [emitting, setEmitting] = useState(false);

  // filtros
  const [cpf, setCpf] = useState("");
  const [cidade, setCidade] = useState("");
  const [ativo, setAtivo] = useState<string>("");

  // params NFSE
  const [password, setPassword] = useState("");
  const [ambiente, setAmbiente] = useState("homologacao");
  const [aliquota, setAliquota] = useState("5.0");
  const [servico, setServico] = useState("010501");
  const [nfeNumber, setNfeNumber] = useState("");
  const [rpsNumber, setRpsNumber] = useState("");

  const headers = { Authorization: `Bearer ${token}` };
  const base = process.env.REACT_APP_URL;

  const buscar = async () => {
    setLoading(true);
    try {
      const res = await axios.post<ClienteServico[]>(
        `${base}/nfse/BuscarClientesServicos`,
        { cpf, cidade, ativo: ativo || undefined },
        { headers },
      );
      setClientes(res.data || []);
      setSelecionados([]);
    } catch (e: any) {
      showError(e?.response?.data?.error || "Erro ao buscar clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (login: string) => {
    setSelecionados((prev) =>
      prev.includes(login) ? prev.filter((l) => l !== login) : [...prev, login],
    );
  };

  const toggleAll = () => {
    if (selecionados.length === clientes.length) {
      setSelecionados([]);
    } else {
      setSelecionados(clientes.map((c) => c.login));
    }
  };

  const totalSelecionado = clientes
    .filter((c) => selecionados.includes(c.login))
    .reduce((s, c) => s + Number(c.valor_total || 0), 0);

  const emitir = async () => {
    if (selecionados.length === 0) {
      showError("Selecione ao menos um cliente.");
      return;
    }
    if (!password) {
      showError("Informe a senha do certificado.");
      return;
    }
    if (!nfeNumber) {
      showError("Informe o último número NF-e.");
      return;
    }
    setEmitting(true);
    try {
      const res = await axios.post(
        `${base}/nfse/EmitirNfseServicos`,
        {
          logins: selecionados,
          password,
          ambiente,
          aliquota,
          servico,
          nfeNumber,
          rpsNumber: rpsNumber || undefined,
        },
        { headers, timeout: 600000 },
      );
      const okCount = (res.data?.results || []).filter((r: any) => r.ok).length;
      const total = (res.data?.results || []).length;
      if (okCount === total) {
        showSuccess(res.data.message || `${okCount} nota(s) emitidas.`);
      } else {
        showError(`${okCount}/${total} emitidas. Verifique falhas no console.`);
        console.warn("Resultados emissão:", res.data?.results);
      }
      await buscar();
    } catch (e: any) {
      showError(e?.response?.data?.error || "Erro ao emitir notas.");
      console.error(e);
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div>
      <NavBar />
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          NFSE — Serviços Adicionais (Streaming / Câmera)
        </h1>

        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
          className="bg-white p-4 rounded shadow mb-4 grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <input
            type="text"
            name="filter-cpf"
            autoComplete="off"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="CPF/CNPJ"
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="filter-cidade"
            autoComplete="off"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Cidade"
            className="border p-2 rounded"
          />
          <select
            value={ativo}
            onChange={(e) => setAtivo(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Todos</option>
            <option value="s">Ativos</option>
            <option value="n">Inativos</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white rounded font-semibold disabled:bg-gray-400"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        <div className="bg-white rounded shadow overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2">
                  <input
                    type="checkbox"
                    checked={
                      selecionados.length > 0 &&
                      selecionados.length === clientes.length
                    }
                    onChange={toggleAll}
                  />
                </th>
                <th className="p-2 text-left">Login</th>
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Cidade</th>
                <th className="p-2 text-center">Streaming</th>
                <th className="p-2 text-center">Câmera</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    Nenhum cliente com serviços adicionais.
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.login} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(c.login)}
                        onChange={() => toggle(c.login)}
                      />
                    </td>
                    <td className="p-2 font-mono">{c.login}</td>
                    <td className="p-2">{c.nome}</td>
                    <td className="p-2">{c.cidade}</td>
                    <td className="p-2 text-center">
                      {Number(c.qtd_streamer) > 0
                        ? `${c.qtd_streamer}x (R$ ${Number(c.valor_streamer).toFixed(2)})`
                        : "-"}
                    </td>
                    <td className="p-2 text-center">
                      {Number(c.qtd_camera) > 0
                        ? `${c.qtd_camera}x (R$ ${Number(c.valor_camera).toFixed(2)})`
                        : "-"}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      R$ {Number(c.valor_total).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {clientes.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="p-2" colSpan={6}>
                    {selecionados.length} selecionado(s) — Total
                  </td>
                  <td className="p-2 text-right text-green-700">
                    R$ {totalSelecionado.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <form
          autoComplete="off"
          onSubmit={(e) => e.preventDefault()}
          className="bg-white p-4 rounded shadow grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {/* dummies pra atrapalhar autofill do Chrome */}
          <input
            type="text"
            name="fake-user"
            autoComplete="username"
            style={{ display: "none" }}
            readOnly
          />
          <input
            type="password"
            name="fake-pass"
            autoComplete="new-password"
            style={{ display: "none" }}
            readOnly
          />
          <input
            type="password"
            name="cert-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do certificado"
            className="border p-2 rounded"
          />
          <select
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
          <input
            type="text"
            name="aliquota-field"
            autoComplete="off"
            value={aliquota}
            onChange={(e) => setAliquota(e.target.value)}
            placeholder="Alíquota (ex: 5.0)"
            className="border p-2 rounded"
          />
          <input
            type="text"
            name="item-lista-servico"
            autoComplete="off"
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            placeholder="Item Lista Serviço (ex: 010501)"
            className="border p-2 rounded"
          />
          <input
            type="text"
            value={nfeNumber}
            onChange={(e) => setNfeNumber(e.target.value)}
            placeholder="Último Nº NF-e *"
            className="border-2 border-red-400 p-2 rounded"
          />
          <input
            type="text"
            value={rpsNumber}
            onChange={(e) => setRpsNumber(e.target.value)}
            placeholder="Número RPS (opcional)"
            className="border p-2 rounded"
          />
          <button
            onClick={emitir}
            disabled={emitting || selecionados.length === 0}
            className="md:col-span-3 bg-violet-700 hover:bg-violet-600 text-white py-3 rounded font-semibold disabled:bg-gray-400"
          >
            {emitting
              ? "Emitindo..."
              : `Emitir ${selecionados.length} NFSE(s) — R$ ${totalSelecionado.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
};
