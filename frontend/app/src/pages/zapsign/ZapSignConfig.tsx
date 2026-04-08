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
  tipo: string;
  has_document: boolean;
}

export const ZapSignConfig = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [fileBase64, setFileBase64] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [selectedTipo, setSelectedTipo] = useState<string>("pago");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
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

  // Reseta tipo para "pago" se mudar para serviço que não é Instalação e o tipo era dificuldade_acesso
  useEffect(() => {
    if (selectedServiceName !== "Instalação" && selectedTipo === "dificuldade_acesso") {
      setSelectedTipo("pago");
    }
  }, [selectedServiceName, selectedTipo]);

  // Atualiza o ID selecionado quando o nome ou tipo mudam
  useEffect(() => {
    if (selectedServiceName && selectedTipo) {
      const match = templates.find(
        (t) => t.nome_servico === selectedServiceName && t.tipo === selectedTipo
      );
      if (match) {
        setSelectedServiceId(match.id.toString());
      } else {
        setSelectedServiceId("");
      }
    } else {
      setSelectedServiceId("");
    }
  }, [selectedServiceName, selectedTipo, templates]);

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

  const handleCriarTemplate = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/zapsign-templates`,
        { nome_servico: selectedServiceName, tipo: selectedTipo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess("Template criado! Agora faça o upload do DOCX.");
      fetchTemplates();
    } catch (error: any) {
      showError(error.response?.data?.error || "Erro ao criar template.");
    } finally {
      setLoading(false);
    }
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
    <div className="flex flex-col min-h-screen bg-gray-100">
      <NavBar />
      <div className="flex-grow p-4 sm:p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaFilePdf className="text-3xl" />
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-tight">Configuração ZapSign</h1>
                <p className="text-indigo-100 text-xs font-medium">Gestão de Templates por Modalidade</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Lado Esquerdo: Seleção */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">
                      1. Escolha o Serviço
                    </label>
                    <select
                      value={selectedServiceName}
                      onChange={(e) => setSelectedServiceName(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-4 shadow-sm transition-all font-semibold"
                      disabled={loading}
                    >
                      <option value="">-- Selecione um Serviço --</option>
                      {Array.from(new Set(templates.map((t) => t.nome_servico))).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">
                      2. Modalidade do Contrato
                    </label>
                    <div className="flex p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
                      <button
                        onClick={() => setSelectedTipo("pago")}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                          selectedTipo === "pago"
                            ? "bg-white text-indigo-600 shadow-lg scale-[1.02]"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Pago
                      </button>
                      <button
                        onClick={() => setSelectedTipo("gratis")}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                          selectedTipo === "gratis"
                            ? "bg-white text-green-600 shadow-lg scale-[1.02]"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Grátis
                      </button>
                      {selectedServiceName === "Instalação" && (
                        <button
                          onClick={() => setSelectedTipo("dificuldade_acesso")}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                            selectedTipo === "dificuldade_acesso"
                              ? "bg-white text-orange-600 shadow-lg scale-[1.02]"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          Dif. Acesso
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedServiceName && selectedTipo && !selectedServiceId && (
                  <div className="p-6 bg-orange-50 rounded-2xl border border-orange-200">
                    <p className="text-orange-700 text-xs font-bold mb-3">
                      Template não encontrado para "{selectedServiceName}" — {selectedTipo}. Clique para criar.
                    </p>
                    <button
                      onClick={handleCriarTemplate}
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-orange-500 text-white text-xs font-black uppercase tracking-wider hover:bg-orange-600 transition-all disabled:opacity-50"
                    >
                      {loading ? "Criando..." : "Criar Template"}
                    </button>
                  </div>
                )}

                {selectedServiceId && (
                  <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-indigo-900 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      Status do Template
                    </h3>
                    <div className="space-y-4">
                      {(() => {
                        const sel = templates.find((t) => t.id.toString() === selectedServiceId);
                        if (!sel) return null;
                        return (
                          <>
                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-indigo-100">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Configurado:</span>
                              <span className={`text-xs font-black p-1 px-3 rounded-full ${sel.has_document ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {sel.has_document ? 'SIM' : 'NÃO'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-indigo-100">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Token ZapSign:</span>
                              <span className="text-[10px] font-mono text-indigo-600 font-bold truncate max-w-[150px]">
                                {sel.token_id || "PENDENTE"}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Lado Direito: Upload */}
              <div className="flex flex-col h-full">
                <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">
                  3. Upload de Arquivo
                </label>
                <div 
                  className={`flex-grow border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-500 relative group ${
                    fileName ? 'border-indigo-400 bg-indigo-50 shadow-inner' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`mb-6 p-6 rounded-full bg-white shadow-xl transition-transform duration-500 group-hover:scale-110 ${fileName ? 'scale-110' : ''}`}>
                    <FaUpload className={`text-4xl ${fileName ? 'text-indigo-600' : 'text-gray-300'}`} />
                  </div>
                  
                  <p className="text-sm font-black text-gray-800 uppercase tracking-tight">
                    {fileName ? 'Documento Pronto' : 'Selecione o DOCX'}
                  </p>
                  
                  {fileName && (
                    <div className="mt-4 bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-full shadow-lg">
                      {fileName}
                    </div>
                  )}
                  
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={loading || !fileBase64 || !selectedServiceId}
                  className={`mt-8 w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                    loading || !fileBase64 || !selectedServiceId
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Sincronizando...</span>
                    </div>
                  ) : (
                    <>
                      <FaSave className="text-lg" />
                      <span>Atualizar no ZapSign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
