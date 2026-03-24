import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { FaUpload, FaFilePdf, FaSave } from "react-icons/fa";

interface Template {
  id: number;
  nome_servico: string;
  token_id: string;
  has_document: boolean;
}

export const ZapSignConfig = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [fileBase64, setFileBase64] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/zapsign-templates`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTemplates(response.data);
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      showError("Erro ao carregar serviços ZapSign.");
    } finally {
      setLoading(false);
    }
  }, [token, showError]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      showError("Por favor, selecione um arquivo .docx");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFileBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!selectedServiceId) {
      showError("Selecione um serviço primeiro.");
      return;
    }

    if (!fileBase64) {
      showError("Nenhum arquivo DOCX selecionado.");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        `${process.env.REACT_APP_URL}/zapsign-templates/${selectedServiceId}`,
        { base64_docx: fileBase64 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess("Template ZapSign atualizado com sucesso!");
      setFileBase64("");
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchTemplates();
    } catch (error: any) {
      console.error("Erro ao atualizar template:", error);
      showError(error.response?.data?.error || "Erro ao atualizar template ZapSign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <NavBar />
      <div className="min-h-screen bg-gray-200 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
            <FaFilePdf className="text-3xl text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-800">
              Configuração ZapSign Templates
            </h1>
          </div>

          <p className="text-gray-600 mb-6">
            Selecione o serviço abaixo e faça o upload do arquivo base <strong>.docx</strong> para atualizar o documento dinâmico associado no ZapSign.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Selecionar Serviço
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                disabled={loading}
              >
                <option value="">-- Escolha --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome_servico} {t.token_id ? "(Ativo)" : "(Sem Token)"}
                  </option>
                ))}
              </select>

              {selectedServiceId && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <h3 className="font-semibold text-gray-700 text-sm mb-2">Status do Serviço:</h3>
                  {(() => {
                    const sel = templates.find((t) => t.id.toString() === selectedServiceId);
                    if (!sel) return null;
                    return (
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li><strong>ID ZapSign:</strong> {sel.token_id || "Não configurado"}</li>
                        <li><strong>Base DOCX:</strong> {sel.has_document ? "Possui base salva" : "Nenhuma base salva"}</li>
                      </ul>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Upload Novo Template (.docx)
              </label>
              
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FaUpload className="text-4xl text-gray-400 mb-3" />
                <p className="text-sm text-gray-500 text-center">
                  Clique para selecionar arquivo
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Somente arquivos .docx
                </p>
                {fileName && (
                  <div className="mt-3 text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {fileName}
                  </div>
                )}
              </div>
              
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                onClick={handleSave}
                disabled={loading || !fileBase64 || !selectedServiceId}
                className={`mt-6 w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-lg transition-colors ${
                  loading || !fileBase64 || !selectedServiceId
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {loading ? "Processando..." : (
                  <>
                    <FaSave /> Atualizar ZapSign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
