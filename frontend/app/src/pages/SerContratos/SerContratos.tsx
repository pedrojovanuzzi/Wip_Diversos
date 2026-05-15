import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import {
  BsTrash,
  BsCamera,
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

export const SerContratos: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loginInput, setLoginInput] = useState("");
  const [loaded, setLoaded] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [qtdCamera, setQtdCamera] = useState(1);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

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
    try {
      const res = await axios.get<ListResponse>(
        `${base}/sercontratos/${encodeURIComponent(target)}`,
        { headers },
      );
      setLoaded(res.data);
    } catch (e: any) {
      showMsg(
        e?.response?.data?.message || "Erro ao consultar cliente.",
        "error",
      );
      setLoaded(null);
    } finally {
      setLoading(false);
    }
  };

  const addServico = async (tipo: "STREAMER" | "CAMERA") => {
    if (!loaded) return;
    setAdding(true);
    try {
      const body =
        tipo === "CAMERA"
          ? { login: loaded.login, tipo, quantidade: qtdCamera }
          : { login: loaded.login, tipo };
      const res = await axios.post(`${base}/sercontratos`, body, { headers });
      showMsg(res.data.message || "Adicionado com sucesso.", "success");
      await fetchList(loaded.login);
    } catch (e: any) {
      showMsg(
        e?.response?.data?.message || "Erro ao adicionar serviço.",
        "error",
      );
    } finally {
      setAdding(false);
    }
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
            <button
              onClick={() => navigate("/Streaming")}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded font-semibold hover:bg-gray-900"
              title="Gerenciar assinantes do Watch Brasil"
            >
              <BsGearFill /> Admin Streaming
            </button>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Login do cliente
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={loginInput}
                onChange={(e) =>
                  setLoginInput(e.target.value.toUpperCase().trim())
                }
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

          {loaded && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <BsCollectionPlay className="text-2xl text-purple-600" />
                    <h2 className="font-bold text-gray-800">Streaming</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    R$ {(loaded.valoresUnitarios.STREAMER ?? 39.9).toFixed(2)} —
                    máx. 1 por cliente
                  </p>
                  {totalStreaming > 0 ? (
                    <div className="flex items-center justify-between bg-purple-50 p-2 rounded">
                      <span className="text-sm text-purple-800 font-semibold">
                        ✓ Cliente já possui Streaming
                      </span>
                      <button
                        onClick={() => {
                          const item = loaded.items.find(
                            (i) => i.nome === "STREAMER",
                          );
                          if (item) removeItem(item.id);
                        }}
                        className="text-red-600 hover:text-red-800"
                        title="Remover"
                      >
                        <BsTrash />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addServico("STREAMER")}
                      disabled={adding}
                      className="w-full py-2 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      {adding ? "Adicionando..." : "Adicionar Streaming"}
                    </button>
                  )}
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <BsCamera className="text-2xl text-blue-600" />
                    <h2 className="font-bold text-gray-800">Câmeras</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    R$ {(loaded.valoresUnitarios.CAMERA ?? 20).toFixed(2)} cada
                    — múltiplas permitidas
                  </p>
                  <div className="mb-2 text-sm text-blue-800 font-semibold">
                    Atual: {totalCameras} câmera(s){" "}
                    {totalCameras > 0 && (
                      <span className="text-gray-600 font-normal">
                        = R$ {(totalCameras * 20).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={qtdCamera}
                      onChange={(e) =>
                        setQtdCamera(
                          Math.max(
                            1,
                            Math.min(20, Number(e.target.value) || 1),
                          ),
                        )
                      }
                      className="w-20 p-2 border border-gray-300 rounded text-center"
                    />
                    <button
                      onClick={() => addServico("CAMERA")}
                      disabled={adding}
                      className="flex-1 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {adding ? "Adicionando..." : `Adicionar ${qtdCamera}`}
                    </button>
                    {totalCameras > 0 && (
                      <button
                        onClick={removeAllCameras}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded font-semibold hover:bg-red-200"
                        title="Remover todas"
                      >
                        <BsTrash />
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
                          <td className="p-2 font-semibold">{it.nome}</td>
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
                            <button
                              onClick={() => removeItem(it.id)}
                              disabled={removingId === it.id}
                              className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                            >
                              <BsTrash />
                            </button>
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
      </div>
    </>
  );
};
