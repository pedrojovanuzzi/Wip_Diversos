import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsTrash,
  BsCamera,
  BsCameraVideoFill,
  BsCollectionPlay,
  BsGearFill,
} from "react-icons/bs";

interface ContratoItem {
  id: number;
  cfop_serc: string;
  nome: string;
  valor: number | string;
  incluir: string;
  data: string;
  insuser: string;
  login: string;
}

interface ListResponse {
  login: string;
  items: ContratoItem[];
  total: number;
  valoresUnitarios: Record<string, number>;
}

// Planos de armazenamento das gravações (espelha o backend: cameraStoragePlans.ts).
const STORAGE_PLANS = [
  { gb: 5, price: 20 },
  { gb: 10, price: 30 },
  { gb: 15, price: 35 },
  { gb: 20, price: 40 },
];

export const SerContratos: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loginInput, setLoginInput] = useState("");
  const [loaded, setLoaded] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [showStreamingForm, setShowStreamingForm] = useState(false);
  const [streamingFormTipo, setStreamingFormTipo] = useState<
    "STREAMER" | "STREAMER_COLAB"
  >("STREAMER");
  const [streamingForm, setStreamingForm] = useState({
    email: "",
    phone: "",
  });
  const [streamingFormError, setStreamingFormError] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [camLinkModal, setCamLinkModal] = useState<{
    login: string;
    setupLink: string | null;
    status: string;
    alreadyConfigured?: boolean;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Plano de armazenamento escolhido ao adicionar Câmeras (padrão 5 GB).
  const [cameraGb, setCameraGb] = useState(5);

  const base = process.env.REACT_APP_URL;
  const headers = { Authorization: `Bearer ${user?.token}` };

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchList = async (login?: string) => {
    const target = (login ?? loginInput).trim();
    if (!target) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await axios.get<ListResponse>(
        `${base}/sercontratos/${encodeURIComponent(target)}`,
        { headers },
      );
      setLoaded(res.data);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setNotFound(true);
      } else {
        showMsg(
          e?.response?.data?.message || "Erro ao consultar cliente.",
          "error",
        );
      }
      setLoaded(null);
    } finally {
      setLoading(false);
    }
  };

  const addServico = async (
    tipo: "STREAMER" | "STREAMER_COLAB" | "CAMERA",
    extras?: Record<string, any>,
  ) => {
    if (!loaded) return;
    setAdding(true);
    try {
      const body = { login: loaded.login, tipo, ...(extras || {}) };
      const res = await axios.post(`${base}/sercontratos`, body, { headers });
      const fl = res.data?.faturasLimpeza;
      let extraMsg = "";
      if (fl?.removidos > 0) {
        extraMsg += ` ${fl.removidos} fatura(s) em aberto fora do mês foram removidas.`;
      }
      if (fl?.registradosPendentes?.length > 0) {
        const detalhes = fl.registradosPendentes
          .map(
            (t: any) =>
              `#${t.id} (venc ${new Date(t.datavenc).toLocaleDateString("pt-BR")}) — ${t.motivo}`,
          )
          .join("\n");
        window.alert(
          `Atenção: as faturas abaixo NÃO foram removidas porque já estão registradas no banco/gateway. Trate manualmente:\n\n${detalhes}`,
        );
      }
      showMsg((res.data.message || "Adicionado com sucesso.") + extraMsg, "success");
      await fetchList(loaded.login);
      if (tipo === "CAMERA") {
        await ensureCameraClient(loaded.login, extras?.storageGb);
      }
    } catch (e: any) {
      if (
        e?.response?.status === 409 &&
        e?.response?.data?.code === "OVERDUE_INVOICES"
      ) {
        const vs = e.response.data.vencidas || [];
        const lista = vs
          .map(
            (v: any) =>
              `#${v.id} — venc ${new Date(v.datavenc).toLocaleDateString("pt-BR")} — R$ ${Number(v.valor).toFixed(2)}`,
          )
          .join("\n");
        window.alert(
          `${e.response.data.message}\n\nFaturas vencidas:\n${lista}`,
        );
      } else if (
        e?.response?.status === 409 &&
        e?.response?.data?.code === "STREAMING_REPLACE_REQUIRED"
      ) {
        const atual = e.response.data.currentType || "STREAMING";
        if (
          window.confirm(
            `Cliente já possui ${atual}. Deseja substituir pelo novo streaming?`,
          )
        ) {
          try {
            const retry = await axios.post(
              `${base}/sercontratos`,
              {
                login: loaded.login,
                tipo,
                replace: true,
                ...(extras || {}),
              },
              { headers },
            );
            showMsg(retry.data.message || "Substituído com sucesso.", "success");
            await fetchList(loaded.login);
          } catch (e2: any) {
            showMsg(
              e2?.response?.data?.message || "Erro ao substituir streaming.",
              "error",
            );
          }
        }
      } else {
        showMsg(
          e?.response?.data?.message || "Erro ao adicionar serviço.",
          "error",
        );
      }
    } finally {
      setAdding(false);
    }
  };

  // Garante a conta de câmeras do cliente e abre o popup com o link de cadastro.
  const ensureCameraClient = async (login: string, storageGb?: number) => {
    try {
      const res = await axios.post(
        `${base}/cameras/admin/clientes/ensure`,
        { login, storageGb },
        { headers },
      );
      setLinkCopied(false);
      setCamLinkModal({
        login,
        setupLink: res.data.setupLink ?? null,
        status: res.data.status,
        alreadyConfigured: res.data.alreadyConfigured,
      });
    } catch (e: any) {
      showMsg(
        e?.response?.data?.message ||
          "Câmera adicionada, mas falhou ao gerar o link de acesso.",
        "error",
      );
    }
  };

  const copySetupLink = async () => {
    if (!camLinkModal?.setupLink) return;
    try {
      await navigator.clipboard.writeText(camLinkModal.setupLink);
      setLinkCopied(true);
    } catch {
      // ignore
    }
  };

  const validateStreamingForm = (): string | null => {
    const { email, phone } = streamingForm;
    if (!email.trim()) return "Email obrigatório.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Email inválido.";
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11)
      return "Celular inválido (10 ou 11 dígitos).";
    return null;
  };

  const submitStreamingForm = async () => {
    const err = validateStreamingForm();
    if (err) {
      setStreamingFormError(err);
      return;
    }
    setStreamingFormError(null);
    await addServico(streamingFormTipo, {
      email: streamingForm.email.trim(),
      phone: streamingForm.phone.replace(/\D/g, ""),
    });
    setShowStreamingForm(false);
    setStreamingForm({ email: "", phone: "" });
  };

  const openStreamingForm = (tipo: "STREAMER" | "STREAMER_COLAB") => {
    setStreamingFormError(null);
    setStreamingFormTipo(tipo);
    setStreamingForm({ email: "", phone: "" });
    setShowStreamingForm(true);
  };

  const removeItem = async (id: number) => {
    if (!loaded) return;
    if (!window.confirm("Remover este serviço do cliente?")) return;
    setRemovingId(id);
    try {
      await axios.delete(`${base}/sercontratos/${id}`, { headers });
      showMsg("Removido.", "success");
      await fetchList(loaded.login);
    } catch (e: any) {
      showMsg(e?.response?.data?.message || "Erro ao remover.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  const convertStreaming = async (
    novoTipo: "STREAMER" | "STREAMER_COLAB",
  ) => {
    if (!loaded) return;
    const labelNovo =
      novoTipo === "STREAMER_COLAB" ? "Colaborador (grátis)" : "Pago";
    if (
      !window.confirm(
        `Converter o streaming deste cliente para ${labelNovo}? A conta no Watch Brasil será mantida.`,
      )
    )
      return;
    setAdding(true);
    try {
      const res = await axios.post(
        `${base}/sercontratos/streaming/convert`,
        { login: loaded.login, novoTipo },
        { headers },
      );
      showMsg(
        res.data?.updated
          ? `Streaming convertido para ${novoTipo}.`
          : "Nada para converter.",
        "success",
      );
      await fetchList(loaded.login);
    } catch (e: any) {
      showMsg(
        e?.response?.data?.message || "Erro ao converter streaming.",
        "error",
      );
    } finally {
      setAdding(false);
    }
  };

  const removeAllCameras = async () => {
    if (!loaded) return;
    if (!window.confirm("Remover TODAS as câmeras deste cliente?")) return;
    try {
      await axios.post(
        `${base}/sercontratos/remove-by-type`,
        { login: loaded.login, tipo: "CAMERA" },
        { headers },
      );
      showMsg("Câmeras removidas.", "success");
      await fetchList(loaded.login);
    } catch (e: any) {
      showMsg(e?.response?.data?.message || "Erro ao remover.", "error");
    }
  };

  const totalStreaming = loaded?.items.filter((i) => i.nome === "STREAMER")
    .length || 0;
  const totalStreamingColab = loaded?.items.filter(
    (i) => i.nome === "STREAMER_COLAB",
  ).length || 0;
  const temStreaming = totalStreaming > 0 || totalStreamingColab > 0;
  const totalCameras = loaded?.items.filter((i) => i.nome === "CAMERA").length ||
    0;

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              Serviços Adicionais — Streaming e Câmeras
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open("/Cameras/Login", "_blank")}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700"
                title="Abrir o portal de câmeras do cliente"
              >
                <BsCameraVideoFill /> Portal de Câmeras
              </button>
              {(user?.permission ?? 0) >= 5 && (
                <button
                  onClick={() => navigate("/Cameras/Admin")}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700"
                  title="Gerenciar câmeras (CFTV) dos clientes"
                >
                  <BsCamera /> Gerenciar Câmeras
                </button>
              )}
              <button
                onClick={() => navigate("/Streaming")}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded font-semibold hover:bg-gray-900"
                title="Gerenciar assinantes do Watch Brasil"
              >
                <BsGearFill /> Admin Streaming
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Login do cliente
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value.toUpperCase().trim());
                  if (notFound) setNotFound(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchList();
                }}
                placeholder="Ex: PEDROJOVANUZZI"
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
              <button
                onClick={() => fetchList()}
                disabled={loading || !loginInput.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {loading ? (
                  <AiOutlineLoading3Quarters className="animate-spin" />
                ) : (
                  "Buscar"
                )}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded text-sm ${
                message.type === "success"
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {notFound && (
            <div className="mb-4 p-4 rounded bg-red-50 border border-red-200 text-red-800 text-center">
              <p className="font-semibold">Cliente não cadastrado.</p>
              <p className="text-sm">
                Verifique o login digitado. Não é possível adicionar Streaming
                ou Câmera para um cliente inexistente.
              </p>
            </div>
          )}

          {loaded && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <BsCollectionPlay className="text-2xl text-purple-600" />
                    <h2 className="font-bold text-gray-800">Streaming</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Pago R$ {(loaded.valoresUnitarios.STREAMER ?? 39.9).toFixed(2)} ·
                    Colaborador grátis — máx. 1 por cliente
                  </p>
                  {temStreaming && (
                    <div className="flex items-center bg-purple-50 p-2 rounded mb-2">
                      <span className="text-sm text-purple-800 font-semibold">
                        ✓ Cliente possui{" "}
                        {totalStreamingColab > 0
                          ? "Streaming Colaborador (grátis)"
                          : "Streaming"}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {!temStreaming && (
                      <>
                        <button
                          onClick={() => openStreamingForm("STREAMER")}
                          disabled={adding}
                          className="w-full py-2 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                        >
                          {adding ? "Aguarde..." : "Adicionar Streaming"}
                        </button>
                        <button
                          onClick={() => openStreamingForm("STREAMER_COLAB")}
                          disabled={adding}
                          className="w-full py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                          title="Libera a TV sem custo na mensalidade"
                        >
                          {adding
                            ? "Aguarde..."
                            : "Adicionar Streaming Colaborador (grátis)"}
                        </button>
                      </>
                    )}
                    {totalStreaming > 0 && (
                      <button
                        onClick={() => convertStreaming("STREAMER_COLAB")}
                        disabled={adding}
                        className="w-full py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:bg-gray-400"
                        title="Mantém a conta no Watch Brasil; só zera a cobrança"
                      >
                        {adding
                          ? "Aguarde..."
                          : "Converter para Colaborador (grátis)"}
                      </button>
                    )}
                    {totalStreamingColab > 0 && (
                      <button
                        onClick={() => convertStreaming("STREAMER")}
                        disabled={adding}
                        className="w-full py-2 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                        title="Mantém a conta no Watch Brasil; passa a cobrar"
                      >
                        {adding
                          ? "Aguarde..."
                          : "Converter para Pago"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <BsCamera className="text-2xl text-blue-600" />
                    <h2 className="font-bold text-gray-800">Câmeras</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Plano de armazenamento das gravações — máx. 1 por cliente ·
                    câmeras ilimitadas no portal
                  </p>
                  {totalCameras > 0 && (
                    <div className="flex items-center bg-blue-50 p-2 rounded mb-2">
                      <span className="text-sm text-blue-800 font-semibold">
                        ✓ Cliente possui Câmeras
                      </span>
                    </div>
                  )}
                  {totalCameras === 0 && (
                    <label className="block mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        Armazenamento
                      </span>
                      <select
                        value={cameraGb}
                        onChange={(e) => setCameraGb(Number(e.target.value))}
                        disabled={adding}
                        className="mt-1 w-full ring-1 ring-gray-300 rounded px-2 py-1.5 text-sm"
                      >
                        {STORAGE_PLANS.map((p) => (
                          <option key={p.gb} value={p.gb}>
                            {p.gb} GB — R$ {p.price.toFixed(2)}/mês
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="flex gap-2">
                    {totalCameras === 0 ? (
                      <button
                        onClick={() => addServico("CAMERA", { storageGb: cameraGb })}
                        disabled={adding}
                        className="flex-1 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {adding ? "Adicionando..." : "Adicionar Câmeras"}
                      </button>
                    ) : (
                      <button
                        onClick={removeAllCameras}
                        className="flex-1 py-2 bg-red-100 text-red-700 rounded font-semibold hover:bg-red-200"
                      >
                        Remover Câmeras
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
                <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
                  <h2 className="font-bold">
                    Serviços contratados — {loaded.login}
                  </h2>
                  <span className="text-lg font-bold">
                    Total: R$ {loaded.total.toFixed(2)}
                  </span>
                </div>
                {loaded.items.length === 0 ? (
                  <p className="p-4 text-center text-gray-500 text-sm">
                    Nenhum serviço contratado.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Serviço</th>
                        <th className="p-2 text-right">Valor</th>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-left">Criado por</th>
                        <th className="p-2 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loaded.items.map((it) => (
                        <tr
                          key={it.id}
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="p-2 text-gray-500">{it.id}</td>
                          <td className="p-2 font-semibold">
                            {it.nome === "STREAMER_COLAB"
                              ? "STREAMING COLABORADOR"
                              : it.nome}
                          </td>
                          <td className="p-2 text-right">
                            R$ {Number(it.valor).toFixed(2)}
                          </td>
                          <td className="p-2 text-gray-600">
                            {it.data
                              ? new Date(it.data).toLocaleString("pt-BR")
                              : "—"}
                          </td>
                          <td className="p-2 text-gray-600">{it.insuser}</td>
                          <td className="p-2 text-center">
                            {it.nome === "STREAMER" ? (
                              <span className="text-gray-300" title="Streaming pago não pode ser removido por aqui">
                                —
                              </span>
                            ) : (
                              <button
                                onClick={() => removeItem(it.id)}
                                disabled={removingId === it.id}
                                className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                              >
                                <BsTrash />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {showStreamingForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-2 mb-4">
                <BsCollectionPlay className="text-2xl text-purple-600" />
                <h2 className="text-xl font-bold text-gray-800">
                  {streamingFormTipo === "STREAMER_COLAB"
                    ? "Cadastro do Streaming Colaborador (grátis)"
                    : "Cadastro do Streaming"}
                </h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {streamingFormTipo === "STREAMER_COLAB"
                  ? "Libera a TV sem custo na mensalidade. Substitui qualquer streaming anterior."
                  : "Preencha os dados do cliente para ativar o streaming."}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={streamingForm.email}
                    onChange={(e) =>
                      setStreamingForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="cliente@email.com"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Celular
                  </label>
                  <input
                    type="tel"
                    value={streamingForm.phone}
                    onChange={(e) =>
                      setStreamingForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="(14) 99999-9999"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {streamingFormError && (
                <div className="mt-3 p-2 bg-red-100 border border-red-200 text-red-800 text-sm rounded">
                  {streamingFormError}
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowStreamingForm(false)}
                  disabled={adding}
                  className="flex-1 py-2 bg-gray-200 text-gray-800 rounded font-semibold hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitStreamingForm}
                  disabled={adding}
                  className="flex-1 py-2 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {adding ? "Adicionando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup: link de cadastro de câmeras do cliente */}
        {camLinkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center gap-2 mb-1">
                <BsCamera className="text-2xl text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-800">
                  Acesso às câmeras
                </h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Cliente <span className="font-semibold">{camLinkModal.login}</span>
              </p>

              {camLinkModal.setupLink ? (
                <>
                  <p className="text-sm text-gray-700 mb-2">
                    Envie este link para o cliente definir o <b>e-mail e a senha</b> de
                    acesso ao portal de câmeras:
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={camLinkModal.setupLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm bg-gray-50"
                    />
                    <button
                      onClick={copySetupLink}
                      className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 whitespace-nowrap"
                    >
                      {linkCopied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    O login do cliente é o próprio PPPOE e não pode ser alterado.
                  </p>
                </>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  Este cliente já configurou o acesso (status:{" "}
                  <b>{camLinkModal.status}</b>). Para gerar um novo link, use o
                  botão <b>Gerenciar Câmeras</b>.
                </div>
              )}

              <div className="flex justify-end mt-5">
                <button
                  onClick={() => setCamLinkModal(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded font-semibold hover:bg-gray-300"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
