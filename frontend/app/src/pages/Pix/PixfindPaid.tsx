import React, { FormEvent, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

interface InfoAdicional {
  nome: string;
  valor: string;
}

interface PixDetalhe {
  endToEndId: string;
  txid: string;
  valor: string;
  chave: string;
  horario: string;
}

interface StatusPix {
  calendario?: {
    criacao: string;
    expiracao: number;
  };
  txid?: string;
  revisao?: number;
  status?: string;
  valor?: {
    original: string;
  };
  chave?: string;
  devedor?: {
    cpf: string;
    nome: string;
  };
  solicitacaoPagador?: string;
  infoAdicionais?: InfoAdicional[];
  loc?: {
    id: number;
    location: string;
    tipoCob: string;
    criacao: string;
  };
  pix?: PixDetalhe[];
  pixCopiaECola?: string;
  location?: string;
}

export const PixfindPaid: React.FC = () => {
  const [chargeId, setChargeId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [porData, setPorData] = useState(false);
  const [status, setStatus] = useState<StatusPix | StatusPix[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const token = user?.token;

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  setStatus(null);

  try {
    const url = porData
      ? `${process.env.REACT_APP_URL}/Pix/BuscarPixPagoData`
      : `${process.env.REACT_APP_URL}/Pix/BuscarPixPago`;

    const formatToUTC = (dateStr: string) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      return date.toISOString();
    };

    const payload = porData
      ? { inicio: formatToUTC(inicio), fim: formatToUTC(fim) }
      : { chargeId };

    const response = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // ✅ Corrige: se for busca por data, extrai o array interno
    if (porData) {
      const data = response.data?.cobs || response.data;
      setStatus(Array.isArray(data) ? data : []);
    } else {
      setStatus(response.data);
    }
  } catch (err: any) {
    setError(err.message || "Erro ao buscar status");
  } finally {
    setLoading(false);
  }
};


  const handleCopy = (texto: string) => {
    navigator.clipboard.writeText(texto);
    alert("✅ Pix Copia e Cola copiado!");
  };

  return (
    <>
      <NavBar />
      <div className="max-w-7xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
          Consultar Status de Pagamento (PIX)
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={porData}
              onChange={() => setPorData(!porData)}
              className="w-4 h-4 accent-cyan-500"
            />
            <label className="text-sm text-gray-700">
              Buscar por intervalo de datas
            </label>
          </div>

          {!porData ? (
            <input
              type="text"
              placeholder="Digite o ID da cobrança"
              value={chargeId}
              onChange={(e) => setChargeId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
              required
            />
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-gray-700 text-sm mb-1">
                  Início
                </label>
                <input
                  type="datetime-local"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-gray-700 text-sm mb-1">Fim</label>
                <input
                  type="datetime-local"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-400 text-black font-semibold py-3 rounded-lg hover:bg-cyan-300 transition disabled:opacity-50"
          >
            {loading
              ? "Consultando..."
              : porData
              ? "Buscar por Data"
              : "Consultar por ID"}
          </button>
        </form>

        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

        {/* 🔹 Caso venha UM resultado */}
        {status && !Array.isArray(status) && (
          <div className="mt-6 bg-gray-50 border border-gray-200 p-5 rounded-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-3">
              🔹 Detalhes da Cobrança
            </h3>

            <div className="space-y-2 text-gray-700 text-sm">
              <p>
                <strong>Status:</strong> {status.status || "—"}
              </p>
              <p>
                <strong>Valor:</strong> R$ {status.valor?.original || "—"}
              </p>
              <p>
                <strong>Pagador:</strong> {status.devedor?.nome || "—"} (
                {status.devedor?.cpf || "—"})
              </p>
              <p>
                <strong>Solicitação:</strong> {status.solicitacaoPagador || "—"}
              </p>
              <p>
                <strong>Data:</strong>{" "}
                {status.calendario?.criacao
                  ? new Date(status.calendario.criacao).toLocaleString()
                  : "—"}
              </p>
              <p>
                <strong>Expira em:</strong>{" "}
                {status.calendario?.expiracao ?? "—"} segundos
              </p>
              <p>
                <strong>TXID:</strong> {status.txid || "—"}
              </p>
              <p>
                <strong>Chave:</strong> {status.chave || "—"}
              </p>
            </div>

            {status.infoAdicionais?.length ? (
              <div className="mt-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  📋 Informações Adicionais:
                </h4>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {status.infoAdicionais.map((item, i) => (
                    <li key={i}>
                      <strong>{item.nome}:</strong> {item.valor}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {status.pix?.length ? (
              <div className="mt-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  💸 Detalhes do PIX:
                </h4>
                {status.pix.map((p, i) => (
                  <div key={i} className="p-3 bg-white border rounded-lg mb-2">
                    <p>
                      <strong>EndToEnd ID:</strong> {p.endToEndId}
                    </p>
                    <p>
                      <strong>Valor:</strong> R$ {p.valor}
                    </p>
                    <p>
                      <strong>Data/Hora:</strong>{" "}
                      {new Date(p.horario).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {status.pixCopiaECola && (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <button
                  onClick={() => handleCopy(status.pixCopiaECola!)}
                  className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition"
                >
                  📋 Copiar Pix Copia e Cola
                </button>
                <a
                  href={`https://${status.location}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 font-medium hover:underline"
                >
                  🔗 Ver QR Code
                </a>
              </div>
            )}
          </div>
        )}

        {/* 🔸 Caso venha MAIS DE UM resultado */}
        {Array.isArray(status) && (
          <div className="mt-8 space-y-4">
            <h1>Quantidade de Titulos: {status.length}</h1>
            {status.map((pix, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 p-5 rounded-lg"
              >
                
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  💳 Cobrança #{index + 1}
                </h3>
                <p>
                  <strong>Status:</strong> {pix.status}
                </p>
                <p>
                  <strong>Valor:</strong> R$ {pix.valor?.original}
                </p>
                <p>
                  <strong>TXID:</strong> {pix.txid}
                </p>
                <p>
                  <strong>PPPOE:</strong> {pix.devedor?.nome}
                </p>
                <p>
                  <strong>TITULO:</strong> {pix.infoAdicionais![0].valor}
                </p>
                <p>
                  <strong>Data:</strong>{" "}
                  {pix.calendario?.criacao
                    ? new Date(pix.calendario.criacao).toLocaleString()
                    : "—"}
                </p>

                {pix.pixCopiaECola && (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <button
                      onClick={() => handleCopy(pix.pixCopiaECola!)}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition"
                    >
                      📋 Copiar Pix Copia e Cola
                    </button>
                    <a
                      href={`https://${pix.location}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 font-medium hover:underline"
                    >
                      🔗 Ver QR Code
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
