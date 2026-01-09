import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import Message from "../../components/Message";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { NavBar } from "../../components/navbar/NavBar";

export const GerarNotaDeServicoIndependente = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    msg: string;
    type: "error" | "success";
  } | null>(null);

  const [formData, setFormData] = useState({
    login: "",
    valor: "",
    servico: "14.02",
    descricao: "Serviço Avulso",
    password: "",
    nfeNumber: "",
    ambiente: "1",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Basic validation
    if (
      !formData.login ||
      !formData.valor ||
      !formData.servico ||
      !formData.password ||
      !formData.nfeNumber ||
      !formData.ambiente
    ) {
      setMessage({
        msg: "Preencha todos os campos obrigatórios.",
        type: "error",
      });
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/GerarNfseAvulsa`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      setMessage({
        msg: response.data.message || "NFSE Gerada com Sucesso!",
        type: "success",
      });
      // clear sensitive fields? or keep for next? keeping login might be useful
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (error: any) {
      console.error(error);
      const errorMsg =
        error.response?.data?.error || "Erro ao gerar NFSE. Tente novamente.";
      const detalhe = error.response?.data?.detalhes
        ? JSON.stringify(error.response.data.detalhes).slice(0, 100)
        : "";
      setMessage({ msg: `${errorMsg} ${detalhe}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar></NavBar>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white shadow-md rounded-lg p-8 w-full max-w-lg">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
            Gerar Nota de Serviço Independente
          </h2>

          {message && <Message msg={message.msg} type={message.type} />}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Login */}
            <div className="flex flex-col">
              <label htmlFor="login" className="font-semibold text-gray-700">
                Login do Cliente
              </label>
              <input
                type="text"
                name="login"
                id="login"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: cliente.teste"
                value={formData.login}
                onChange={handleChange}
                required
              />
            </div>

            {/* Ambiente */}
            <div className="flex flex-col">
              <label htmlFor="ambiente" className="font-semibold text-gray-700">
                Ambiente
              </label>
              <select
                name="ambiente"
                id="ambiente"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.ambiente}
                onChange={handleChange}
                required
              >
                <option value="producao">Produção</option>
                <option value="homologacao">Homologação</option>
              </select>
            </div>

            {/* Valor */}
            <div className="flex flex-col">
              <label htmlFor="valor" className="font-semibold text-gray-700">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                name="valor"
                id="valor"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                value={formData.valor}
                onChange={handleChange}
                required
              />
            </div>

            {/* Número da Nota */}
            <div className="flex flex-col">
              <label
                htmlFor="nfeNumber"
                className="font-semibold text-gray-700"
              >
                Ultimo Nota Gerada
              </label>
              <input
                type="text"
                name="nfeNumber"
                id="nfeNumber"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Número da Nota"
                value={formData.nfeNumber}
                onChange={handleChange}
                required
              />
            </div>

            {/* Serviço */}
            <div className="flex flex-col">
              <label htmlFor="servico" className="font-semibold text-gray-700">
                Código do Serviço
              </label>
              <input
                type="text"
                name="servico"
                id="servico"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.servico}
                onChange={handleChange}
                required
              />
            </div>

            {/* Descrição */}
            <div className="flex flex-col">
              <label
                htmlFor="descricao"
                className="font-semibold text-gray-700"
              >
                Discriminação
              </label>
              <textarea
                name="descricao"
                id="descricao"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descrição do serviço..."
                rows={3}
                value={formData.descricao}
                onChange={handleChange}
              />
            </div>

            {/* Senha Certificado */}
            <div className="flex flex-col">
              <label htmlFor="password" className="font-semibold text-gray-700">
                Senha do Certificado
              </label>
              <input
                type="password"
                name="password"
                id="password"
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Senha do certificado digital"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-4 py-2 px-4 rounded font-bold text-white transition-colors flex items-center justify-center gap-2 ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? (
                <>
                  <AiOutlineLoading3Quarters className="animate-spin" />
                  Processando...
                </>
              ) : (
                "Gerar NFSE"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
