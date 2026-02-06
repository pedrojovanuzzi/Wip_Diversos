import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { CiSearch } from "react-icons/ci";
import { BiCalendar, BiUser } from "react-icons/bi";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

export const BuscarNfe = () => {
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [nfes, setNfes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [status, setStatus] = useState<string>(""); // autorizado, cancelado, etc.
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { user } = useAuth();
  const token = user?.token;
  const { showError } = useNotification();

  const handleSearch = async () => {
    setLoading(true);
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFEletronica/buscarGeradas`,
        {
          cpf: searchCpf,
          dateFilter: {
            start: dataInicio,
            end: dataFim,
          },
          status: status,
          ambiente: ambiente,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      setNfes(resposta.data);
    } catch (erro) {
      console.error("Erro ao buscar NFEs:", erro);
      showError("Erro ao buscar NFEs.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchCpf("");
    setDataInicio("");
    setDataFim("");
    setStatus("");
    setNfes([]);
  };

  // Carregar ao entrar (opcional, pode ser pesado se não tiver filtro)
  // useEffect(() => {
  //   handleSearch();
  // }, []);

  return (
    <div>
      <NavBar />
      <div className="min-h-full">
        <div className=" bg-pink-800 pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Buscar NF-e Geradas (Produtos)
              </h1>
            </div>
          </header>
        </div>

        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CPF/CNPJ Destinatário
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiUser />
                    </span>
                    <input
                      type="text"
                      value={searchCpf}
                      onChange={(e) => setSearchCpf(e.target.value)}
                      placeholder="Ex: 000.000.000-00"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inicial
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiCalendar />
                    </span>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Final
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiCalendar />
                    </span>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ambiente
                  </label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="homologacao">Homologação</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="autorizado">Autorizada</option>
                    <option value="erro_autorizacao">Erro Autorização</option>
                    <option value="assinado">Assinado</option>
                    <option value="cancelado">Cancelada</option>
                    <option value="enviado">Enviado (Pendente)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={handleClear}
                  className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all font-medium"
                >
                  Limpar
                </button>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all font-medium flex items-center gap-2 disabled:bg-gray-400"
                >
                  <CiSearch className="text-xl" />
                  {loading ? "Buscando..." : "Buscar"}
                </button>
              </div>

              {/* Tabela */}
              {nfes.length > 0 ? (
                <div className="mt-8 bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-medium text-gray-900">
                      Resultados encontrados: {nfes.length}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Nº NFe / Série
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Emissão
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Destinatário
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Valor
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Chave
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {nfes.map((nfe) => (
                          <tr key={nfe.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {nfe.nNF} / {nfe.serie}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(nfe.data_emissao).toLocaleString(
                                "pt-BR",
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {nfe.destinatario_nome}
                              <br />
                              <span className="text-xs text-gray-500">
                                {nfe.destinatario_cpf_cnpj}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              R$ {Number(nfe.valor_total).toFixed(2)}
                            </td>
                            <td
                              className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs"
                              title={nfe.chave}
                            >
                              {nfe.chave}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                  nfe.status === "autorizado"
                                    ? "bg-green-50 text-green-700 ring-green-600/20"
                                    : nfe.status === "cancelado" ||
                                        nfe.status === "erro_autorizacao"
                                      ? "bg-red-50 text-red-700 ring-red-600/20"
                                      : nfe.status === "enviado"
                                        ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                                        : nfe.status === "assinado"
                                          ? "bg-cyan-50 text-cyan-700 ring-cyan-600/20"
                                          : "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                                }`}
                              >
                                {nfe.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {/* Futuramente link para PDF ou algo assim */}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                !loading && (
                  <div className="text-center mt-10 text-gray-500 py-10">
                    <p>Nenhuma nota encontrada com os filtros selecionados.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
