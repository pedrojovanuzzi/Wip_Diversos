"use client";

import React, { useState } from "react";
import axios from "axios";
import NavBar from "@/components/NavBar";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { useNotification } from "@/lib/NotificationContext";
import type { User } from "@/lib/auth";

export default function GerarNotaIndependenteClient({ user }: { user: User }) {
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  const [formData, setFormData] = useState({
    login: "",
    valor: "",
    servico: "140201",
    descricao: "Serviço Avulso",
    password: "",
    nfeNumber: "",
    ambiente: "homologacao",
    aliquota: "5.0000",
    rpsNumber: "",
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

    // Basic validation
    if (
      !formData.login ||
      !formData.valor ||
      !formData.servico ||
      !formData.password ||
      !formData.nfeNumber ||
      !formData.ambiente ||
      !formData.aliquota
    ) {
      showError("Preencha todos os campos obrigatórios.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/GerarNfseAvulsa`,
        formData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      showSuccess(response.data.message || "NFSE Gerada com Sucesso!");
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (error: any) {
      console.error(error);
      const errorMsg =
        error.response?.data?.error || "Erro ao gerar NFSE. Tente novamente.";
      const detalhe = error.response?.data?.detalhes
        ? " — " + JSON.stringify(error.response.data.detalhes).slice(0, 150)
        : "";
      showError(`${errorMsg}${detalhe}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavBar user={user} />
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-lg border border-gray-100">
          <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">
            Gerar Nota de Serviço Independente
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login" className="block text-sm font-semibold text-gray-700 mb-1">
                Login do Cliente
              </label>
              <input
                type="text"
                name="login"
                id="login"
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: cliente.teste"
                value={formData.login}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="ambiente" className="block text-sm font-semibold text-gray-700 mb-1">
                  Ambiente
                </label>
                <select
                  name="ambiente"
                  id="ambiente"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.ambiente}
                  onChange={handleChange}
                  required
                >
                  <option value="producao">Produção</option>
                  <option value="homologacao">Homologação</option>
                </select>
              </div>

              <div>
                <label htmlFor="aliquota" className="block text-sm font-semibold text-gray-700 mb-1">
                  Alíquota (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="aliquota"
                  id="aliquota"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="5.0000"
                  value={formData.aliquota}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="valor" className="block text-sm font-semibold text-gray-700 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="valor"
                  id="valor"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                  value={formData.valor}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label htmlFor="nfeNumber" className="block text-sm font-semibold text-gray-700 mb-1">
                  Última Nota Gerada
                </label>
                <input
                  type="text"
                  name="nfeNumber"
                  id="nfeNumber"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Número da Nota"
                  value={formData.nfeNumber}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rpsNumber" className="block text-sm font-semibold text-gray-700 mb-1">
                  Número RPS (Opcional)
                </label>
                <input
                  type="text"
                  name="rpsNumber"
                  id="rpsNumber"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: 123456"
                  value={formData.rpsNumber}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="servico" className="block text-sm font-semibold text-gray-700 mb-1">
                  Código do Serviço
                </label>
                <input
                  type="text"
                  name="servico"
                  id="servico"
                  className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.servico}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="descricao" className="block text-sm font-semibold text-gray-700 mb-1">
                Discriminação
              </label>
              <textarea
                name="descricao"
                id="descricao"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Descrição do serviço..."
                rows={3}
                value={formData.descricao}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                Senha do Certificado
              </label>
              <input
                type="password"
                name="password"
                id="password"
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Senha PFX"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-md font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                loading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <>
                  <AiOutlineLoading3Quarters className="animate-spin" />
                  Processando...
                </>
              ) : (
                "GERAR NFSE"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
