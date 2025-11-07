import React, { FormEvent, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

// Tipos do objeto retornado pela API
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
}

export const PixfindPaid: React.FC = () => {
  const [chargeId, setChargeId] = useState("");
  const [status, setStatus] = useState<StatusPix | null>(null);
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
      const response = await axios.post<StatusPix>(
        `${process.env.REACT_APP_URL}/Pix/BuscarPixPago`,
        { chargeId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(response.data);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar />
      <div className="max-w-7xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
          Consultar Status de Pagamento (PIX)
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Digite o ID da cobrança"
            value={chargeId}
            onChange={(e) => setChargeId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-400 text-black font-semibold py-3 rounded-lg hover:bg-cyan-300 transition disabled:opacity-50"
          >
            {loading ? "Consultando..." : "Consultar Status"}
          </button>
        </form>

        {error && (
          <p className="text-red-500 mt-4 text-center">{error}</p>
        )}

        {status && (
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

            {status.infoAdicionais && status.infoAdicionais.length > 0 && (
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
            )}

            {status.pix && status.pix.length > 0 && (
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
            )}

            {status.infoAdicionais?.find((i) => i.nome === "QR") && (
              <div className="mt-4">
                <a
                  href={
                    status.infoAdicionais.find((i) => i.nome === "QR")?.valor
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 font-medium hover:underline"
                >
                  🔗 Ver QR Code de Pagamento
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
