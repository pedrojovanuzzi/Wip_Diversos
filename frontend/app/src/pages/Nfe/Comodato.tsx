import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { HiPlus, HiTrash } from "react-icons/hi2";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";

export const Comodato = () => {
  const { user } = useAuth();
  const token = user?.token;
  const { showSuccess, showError } = useNotification();

  // --- Main States ---
  const [searchCpf, setSearchCpf] = useState("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesSelecionados, setClientesSelecionados] = useState<any[]>([]); // Array of full client objects or IDs
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({
    plano: [],
    vencimento: [],
    cli_ativado: [],
    nova_nfe: [],
    servicos: [],
  });
  const [arquivo, setArquivo] = useState<File | null>(null); // For Filter component compatibility

  // --- Shared States ---
  const [equipamentos, setEquipamentos] = useState<
    { codigo: string; descricao: string; valor: string }[]
  >([]);
  const [novoEquipamento, setNovoEquipamento] = useState({
    codigo: "",
    descricao: "",
    valor: "",
  });
  const [tipoOperacao, setTipoOperacao] = useState<"saida" | "entrada">(
    "saida",
  );
  const [ambiente, setAmbiente] = useState("homologacao");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // --- Search Methods ---
  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");
    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/BuscarClientes`,
        {
          cpf: searchCpfRegex,
          filters: activeFilters,
          dateFilter: dateFilter,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setClientes(resposta.data);
      // Reset selection when search changes or not? Better to reset to avoid confusion
      setClientesSelecionados([]);
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
      showError("Erro ao buscar clientes.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (client: any) => {
    setClientesSelecionados((prev) => {
      const exists = prev.find((c) => c.id === client.id);
      if (exists) {
        return prev.filter((c) => c.id !== client.id);
      } else {
        return [...prev, client];
      }
    });
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      setClientesSelecionados([...clientes]);
    }
  };

  // --- Shared Methods ---
  const adicionarEquipamento = () => {
    if (!novoEquipamento.descricao || !novoEquipamento.valor) {
      showError("Preencha descrição e valor.");
      return;
    }
    setEquipamentos([...equipamentos, novoEquipamento]);
    setNovoEquipamento({ codigo: "", descricao: "", valor: "" });
  };

  const removerEquipamento = (index: number) => {
    const novos = [...equipamentos];
    novos.splice(index, 1);
    setEquipamentos(novos);
  };

  const emitirNFe = async () => {
    // Validation
    if (equipamentos.length === 0) {
      showError("Adicione pelo menos um equipamento.");
      return;
    }
    if (!password) {
      showError("Digite a senha do certificado.");
      return;
    }

    if (clientesSelecionados.length === 0) {
      showError("Selecione pelo menos um cliente.");
      return;
    }

    try {
      setLoading(true);
      const endpoint =
        tipoOperacao === "saida"
          ? "/nfe/comodato/saida"
          : "/nfe/comodato/entrada";

      const targets = clientesSelecionados;
      setProgress({ current: 0, total: targets.length });

      let successCount = 0;
      let errorCount = 0;

      // Sequential Processing to update progress and avoid overloading if batch endpoint missing
      for (let i = 0; i < targets.length; i++) {
        const targetCliente = targets[i];
        try {
          // Clean payload for each client
          const payload = {
            clienteId: targetCliente.id,
            equipamentos,
            password,
            ambiente,
          };

          await axios.post(`${process.env.REACT_APP_URL}${endpoint}`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });
          successCount++;
        } catch (err) {
          console.error(`Falha ao emitir para ${targetCliente.nome}`, err);
          errorCount++;
        }
        setProgress({ current: i + 1, total: targets.length });
      }

      if (errorCount === 0) {
        showSuccess(
          `${successCount} NFE(s) de ${tipoOperacao} emitida(s) com sucesso!`,
        );
      } else {
        showError(
          `${successCount} emitidas com sucesso. ${errorCount} falhas.`,
        );
      }

      // Cleanup
      setEquipamentos([]);
      setPassword("");
      setClientesSelecionados([]);
    } catch (error: any) {
      console.error(error);
      const msg =
        error.response?.data?.message || "Erro crítico ao emitir NFE.";
      showError(msg);
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar />
      <div className="flex-1 p-6 md:ml-32 transition-all duration-300">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
            Emissão de NFE - Comodato
          </h1>

          {/* Search Section */}
          <div className="mb-6 animate-fade-in">
            <div className="mb-4">
              <Stacked
                setSearchCpf={setSearchCpf}
                onSearch={handleSearch}
                title="Gerar Nota Fiscal Comodato"
              />
              <Filter
                setActiveFilters={setActiveFilters}
                setDate={setDateFilter}
                setArquivo={setArquivo} // Not strictly used for comdodato but req by component
                enviarCertificado={() => {}} // Not needed here
              />
            </div>

            {clientes.length > 0 && (
              <div className="mt-4 border rounded overflow-hidden">
                <div className="flex justify-between p-2 bg-gray-100 border-b items-center">
                  <span className="font-semibold px-2">
                    Total Encontrado: {clientes.length}
                  </span>
                  <span className="font-semibold px-2 text-blue-600">
                    Selecionados: {clientesSelecionados.length}
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="p-3">
                          <input
                            type="checkbox"
                            checked={
                              clientes.length > 0 &&
                              clientesSelecionados.length === clientes.length
                            }
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th className="p-3">Nome/Razão</th>
                        <th className="p-3">Login</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {clientes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={
                                !!clientesSelecionados.find(
                                  (sel) => sel.id === c.id,
                                )
                              }
                              onChange={() => handleCheckboxChange(c)}
                            />
                          </td>
                          <td className="p-3">
                            {c.nome || c.razao_social || c.fatura?.titulo}
                          </td>
                          <td className="p-3">{c.login}</td>
                          <td className="p-3">
                            {c.cli_ativado === "s" ? "Ativo" : "Inativo"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* --- Shared Settings (Operation, Equipments, Emit) --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Operation Type */}
            <div className="bg-gray-50 p-4 rounded border">
              <h2 className="font-semibold text-lg mb-2">Tipo de Operação</h2>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="operacao"
                    value="saida"
                    checked={tipoOperacao === "saida"}
                    onChange={() => setTipoOperacao("saida")}
                  />
                  Saída (Envio)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="operacao"
                    value="entrada"
                    checked={tipoOperacao === "entrada"}
                    onChange={() => setTipoOperacao("entrada")}
                  />
                  Entrada (Devolução)
                </label>
              </div>
            </div>

            {/* Environment */}
            <div className="bg-gray-50 p-4 rounded border">
              <h2 className="font-semibold text-lg mb-2">Ambiente</h2>
              <select
                className="border p-2 rounded w-full"
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value)}
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>
          </div>
          {/* Equipments */}
          <div className="mb-6 bg-gray-50 p-4 rounded border">
            <h2 className="font-semibold text-lg mb-2">
              Equipamentos (Aplicado para todos)
            </h2>
            <div className="flex flex-col md:flex-row gap-2 mb-2">
              <input
                type="text"
                placeholder="Código"
                className="border p-2 rounded w-24"
                value={novoEquipamento.codigo}
                onChange={(e) =>
                  setNovoEquipamento({
                    ...novoEquipamento,
                    codigo: e.target.value,
                  })
                }
              />
              <input
                type="text"
                placeholder="Descrição"
                className="border p-2 rounded flex-1"
                value={novoEquipamento.descricao}
                onChange={(e) =>
                  setNovoEquipamento({
                    ...novoEquipamento,
                    descricao: e.target.value,
                  })
                }
              />
              <input
                type="number"
                placeholder="Valor (R$)"
                className="border p-2 rounded w-32"
                value={novoEquipamento.valor}
                onChange={(e) =>
                  setNovoEquipamento({
                    ...novoEquipamento,
                    valor: e.target.value,
                  })
                }
              />
              <button
                onClick={adicionarEquipamento}
                className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 flex items-center justify-center"
              >
                <HiPlus className="w-5 h-5" />
              </button>
            </div>

            {equipamentos.length > 0 ? (
              <table className="w-full bg-white shadow rounded overflow-hidden">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Valor</th>
                    <th className="p-2 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {equipamentos.map((eq, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{eq.codigo}</td>
                      <td className="p-2">{eq.descricao}</td>
                      <td className="p-2">R$ {eq.valor}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removerEquipamento(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <HiTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 italic">
                Nenhum equipamento adicionado.
              </p>
            )}
          </div>

          {/* Password and Emission */}
          <div className="mb-6 bg-gray-50 p-4 rounded border">
            <h2 className="font-semibold text-lg mb-2">5. Confirmação</h2>

            {loading && progress.total > 1 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-sm text-center mt-1">
                  Processando {progress.current} de {progress.total}...
                </p>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block mb-1 text-sm font-medium">
                  Senha do Certificado
                </label>
                <input
                  type="password"
                  className="border p-2 rounded w-full"
                  placeholder="Senha PFX"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                onClick={emitirNFe}
                disabled={loading}
                className={`px-6 py-3 rounded text-white font-bold w-full md:w-auto ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-violet-700 hover:bg-violet-800"
                }`}
              >
                {loading
                  ? progress.total > 0
                    ? "Em Processo..."
                    : "Processando..."
                  : `Emitir para ${clientesSelecionados.length} Cliente(s)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
