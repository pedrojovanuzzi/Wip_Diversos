import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { Navigate } from "react-router-dom";

export const EnviarMensagem = () => {
  const { user } = useAuth();
  const token = user?.token;
  const { showSuccess, showError } = useNotification();

  // --- Main States ---
  const [searchCpf, setSearchCpf] = useState("");
  const [searchNome, setSearchNome] = useState("");
  const [searchCidade, setSearchCidade] = useState("");
  const [searchPlano, setSearchPlano] = useState("");
  const [searchStatus, setSearchStatus] = useState("s"); // Default to Active ('s')
  const [searchCaixaHerm, setSearchCaixaHerm] = useState("");

  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesSelecionados, setClientesSelecionados] = useState<any[]>([]);

  // --- Message States ---
  const [messageMode, setMessageMode] = useState<"text" | "template">("text");
  const [messageText, setMessageText] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [loading, setLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);

  // --- Search Methods ---
  const handleSearch = async () => {
    // Only strip non-digits if it looks like a CPF/CNPJ search (numbers only or standard format).
    // If it's empty, we might not want to send it.
    // The backend uses 'Like', so sending empty string matches everything, which is fine if controlled.
    // However, usually we want at least one filter or a limit. Backend has limit 100.

    const cleanCpf = searchCpf.replace(/\D/g, "");

    try {
      setLoading(true);
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/whatsapp/clients`,
        {
          cpf: cleanCpf,
          nome: searchNome,
          cidade: searchCidade,
          plano: searchPlano,
          status: searchStatus === "all" ? undefined : searchStatus,
          caixa_herm: searchCaixaHerm,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // Backend already sorts by name ASC
      setClientes(resposta.data);
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

  // --- Send Method ---
  const handleSend = async () => {
    if (clientesSelecionados.length === 0) {
      showError("Selecione pelo menos um cliente.");
      return;
    }

    if (messageMode === "text" && !messageText.trim()) {
      showError("Digite uma mensagem.");
      return;
    }

    if (messageMode === "template" && !templateName.trim()) {
      showError("Digite o nome do template.");
      return;
    }

    try {
      setLoading(true);
      setBroadcastResult(null);

      const payload = {
        clientIds: clientesSelecionados.map((c) => c.id),
        message: messageMode === "text" ? messageText : undefined,
        templateName: messageMode === "template" ? templateName : undefined,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/whatsapp/broadcast`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setBroadcastResult(response.data);
      showSuccess(
        `Processado: ${response.data.successCount} enviados, ${response.data.failureCount} falhas.`,
      );
    } catch (error: any) {
      console.error("Erro ao enviar broadcast:", error);
      showError(error.response?.data?.message || "Erro ao enviar mensagens.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.permission < 5) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar />
      <div className="flex-1 p-6 md:ml-32 transition-all duration-300">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">
            Disparo de Mensagens WhatsApp
          </h1>

          {/* Search Section */}
          <div className="mb-6 animate-fade-in">
            <div className="mb-4 bg-gray-50 p-4 rounded border">
              <h2 className="font-semibold mb-2">Filtros de Busca</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={searchCpf}
                    onChange={(e) => setSearchCpf(e.target.value)}
                    placeholder="Digite CPF/CNPJ"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nome
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={searchNome}
                    onChange={(e) => setSearchNome(e.target.value)}
                    placeholder="Digite o Nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cidade
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={searchCidade}
                    onChange={(e) => setSearchCidade(e.target.value)}
                    placeholder="Digite a Cidade"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Plano
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={searchPlano}
                    onChange={(e) => setSearchPlano(e.target.value)}
                    placeholder="Digite o Plano"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    className="w-full border rounded p-2"
                    value={searchStatus}
                    onChange={(e) => setSearchStatus(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="s">Ativo</option>
                    <option value="n">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Caixa Herm.
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={searchCaixaHerm}
                    onChange={(e) => {
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 5);
                      let formatted = digits;
                      if (digits.length >= 3) {
                        formatted = digits.split("").join("-");
                      }
                      setSearchCaixaHerm(formatted);
                    }}
                    placeholder="Ex: 3-2-5"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSearch}
                  className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700 transition-all font-bold"
                >
                  Buscar Clientes
                </button>
              </div>
            </div>

            {clientes.length > 0 && (
              <div className="mt-4 border rounded overflow-hidden">
                <div className="flex justify-between p-2 bg-gray-100 border-b items-center">
                  <span className="font-semibold px-2">
                    Total Encontrado: {clientes.length}
                  </span>
                  <span className="font-semibold px-2 text-green-600">
                    Selecionados: {clientesSelecionados.length}
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="p-3 w-10">
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
                        <th className="p-3">Telefone/Celular</th>
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
                          <td className="p-3">{c.nome || c.razao_social}</td>
                          <td className="p-3">{c.login}</td>
                          <td className="p-3">{c.celular || c.fone || "-"}</td>
                          <td className="p-3">
                            {c.cli_ativado === "s" ? (
                              <span className="text-green-600 font-bold">
                                Ativo
                              </span>
                            ) : (
                              <span className="text-red-500">Inativo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Message Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded border">
              <h2 className="font-semibold text-lg mb-3">
                Configuração da Mensagem
              </h2>

              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="msgMode"
                    checked={messageMode === "text"}
                    onChange={() => setMessageMode("text")}
                  />
                  Texto Livre
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="msgMode"
                    checked={messageMode === "template"}
                    onChange={() => setMessageMode("template")}
                  />
                  Template
                </label>
              </div>

              {messageMode === "text" ? (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Mensagem
                  </label>
                  <textarea
                    className="w-full border rounded p-2 h-32"
                    placeholder="Digite sua mensagem aqui..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    * Mensagens de texto livre podem falhar se a janela de 24h
                    estiver fechada.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nome do Template
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    placeholder="ex: hello_world"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    * O template deve estar aprovado no Gerenciador do WhatsApp.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded border flex flex-col justify-between">
              <div>
                <h2 className="font-semibold text-lg mb-3">Resumo do Envio</h2>
                <p>
                  Total de Destinatários:{" "}
                  <strong>{clientesSelecionados.length}</strong>
                </p>
                <p>
                  Modo:{" "}
                  <strong>
                    {messageMode === "text" ? "Texto Livre" : "Template"}
                  </strong>
                </p>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleSend}
                  disabled={loading || clientesSelecionados.length === 0}
                  className={`w-full py-3 rounded text-white font-bold transition-all ${
                    loading || clientesSelecionados.length === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 shadow-lg"
                  }`}
                >
                  {loading ? "Enviando..." : "Enviar Mensagens"}
                </button>
              </div>
            </div>
          </div>

          {/* Results/Errors */}
          {broadcastResult && (
            <div className="bg-white border rounded p-4 animate-fade-in">
              <h3 className="font-bold mb-2">Resultado do Envio</h3>
              <div className="flex gap-4 mb-2">
                <span className="text-green-600">
                  Sucesso: {broadcastResult.successCount}
                </span>
                <span className="text-red-600">
                  Falhas: {broadcastResult.failureCount}
                </span>
              </div>
              {broadcastResult.errors && broadcastResult.errors.length > 0 && (
                <div className="bg-red-50 p-2 rounded max-h-40 overflow-y-auto text-sm">
                  <p className="font-semibold text-red-700">
                    Erros Detalhados:
                  </p>
                  <ul className="list-disc pl-5">
                    {broadcastResult.errors.map((err: any, idx: number) => (
                      <li key={idx}>
                        Client ID {err.clientId}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
