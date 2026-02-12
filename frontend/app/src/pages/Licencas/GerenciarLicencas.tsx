import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
// Ajuste o import do notification se necessário, baseando-me no BuscarNfe
// Se não existir, vou remover ou criar um mock local.
import { useNotification } from "../../context/NotificationContext";
import {
  FaPlus,
  FaTrash,
  FaLock,
  FaUnlock,
  FaKey,
  FaDesktop,
} from "react-icons/fa";

interface Licenca {
  id: number;
  cliente_nome: string;
  software: string;
  chave: string;
  status: "ativo" | "bloqueado" | "cancelado";
  observacao: string;
  created_at: string;
  updated_at: string;
}

export const GerenciarLicencas = () => {
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [clienteNome, setClienteNome] = useState("");
  const [software, setSoftware] = useState("");
  const [chave, setChave] = useState("");
  const [observacao, setObservacao] = useState("");

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const fetchLicencas = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/licenca/listar`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setLicencas(response.data);
    } catch (error) {
      console.error("Erro ao buscar licenças:", error);
      showError("Erro ao carregar licenças.");
    } finally {
      setLoading(false);
    }
  }, [token, showError]);

  useEffect(() => {
    fetchLicencas();
  }, [fetchLicencas]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome || !chave) {
      showError("Cliente e Chave são obrigatórios.");
      return;
    }

    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/licenca/criar`,
        { cliente_nome: clienteNome, software, chave, observacao },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess("Licença criada com sucesso!");
      setShowModal(false);
      setClienteNome("");
      setSoftware("");
      setChave("");
      setObservacao("");
      fetchLicencas();
    } catch (error: any) {
      console.error("Erro ao criar licença:", error);
      showError(error.response?.data?.message || "Erro ao criar licença.");
    }
  };

  const handleToggleStatus = async (licenca: Licenca) => {
    const novoStatus = licenca.status === "ativo" ? "bloqueado" : "ativo";
    if (!window.confirm(`Deseja alterar o status para ${novoStatus}?`)) return;

    try {
      await axios.put(
        `${process.env.REACT_APP_URL}/licenca/status/${licenca.id}`,
        { status: novoStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      showSuccess(`Status alterado para ${novoStatus}.`);
      fetchLicencas();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      showError("Erro ao alterar status.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir esta licença?")) return;

    try {
      await axios.delete(`${process.env.REACT_APP_URL}/licenca/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showSuccess("Licença removida.");
      fetchLicencas();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      showError("Erro ao excluir licença.");
    }
  };

  const gerarChaveAleatoria = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 20; i++) {
      if (i > 0 && i % 4 === 0) result += "-";
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setChave(result);
  };

  return (
    <div>
      <NavBar />
      <div className="h-screen bg-gray-200 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaDesktop /> Gerenciar Licenças de Software
            </h1>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
            >
              <FaPlus /> Nova Licença
            </button>
          </div>

          <div className="bg-gray-100 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Software
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chave
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center">
                        Carregando...
                      </td>
                    </tr>
                  ) : licencas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        Nenhuma licença encontrada.
                      </td>
                    </tr>
                  ) : (
                    licencas.map((licenca) => (
                      <tr key={licenca.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {licenca.cliente_nome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {licenca.software}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 family-mono">
                          {licenca.chave}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              licenca.status === "ativo"
                                ? "bg-green-100 text-green-800"
                                : licenca.status === "bloqueado"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {licenca.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(licenca.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(licenca)}
                            className={`text-${licenca.status === "ativo" ? "red" : "green"}-600 hover:text-${licenca.status === "ativo" ? "red" : "green"}-900`}
                            title={
                              licenca.status === "ativo"
                                ? "Bloquear"
                                : "Desbloquear"
                            }
                          >
                            {licenca.status === "ativo" ? (
                              <FaLock />
                            ) : (
                              <FaUnlock />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(licenca.id)}
                            className="text-red-600 hover:text-red-900 ml-2"
                            title="Excluir"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Nova Licença
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Software
                </label>
                <input
                  type="text"
                  value={software}
                  onChange={(e) => setSoftware(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Chave (HWID/Serial/MAC)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                  />
                  <button
                    type="button"
                    onClick={gerarChaveAleatoria}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                    title="Gerar Aleatória"
                  >
                    <FaKey />
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Observação
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
