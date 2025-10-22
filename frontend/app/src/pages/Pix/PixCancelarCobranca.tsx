import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

export const PixCancelarCobranca = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [tabelaCancelada, setTabelaCancelada] = useState<any>();
  const [txid, setTxId] = useState("");
  const token = user?.token;

  // 🔧 Função que converte qualquer tipo de erro em string segura
  function stringifySafe(x: any): string {
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }

  // 🔧 Função que captura qualquer tipo de erro (string, objeto, AxiosError, etc.)
  function extractErrorMessage(err: any): string {
    if (err && err.response) {
      const d = err.response.data;
      if (typeof d === "string") return d;
      if (d == null) return `HTTP ${err.response.status || ""}`;
      return stringifySafe(d);
    }
    if (err && err.request) {
      return "Falha de rede ou servidor indisponível.";
    }
    if (err instanceof Error && err.message) return err.message;
    return stringifySafe(err);
  }

  async function cancelarCobranca() {
    try {
      setLoading(true);
      setError("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/cancelarCobranca`,
        { txid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
      setTabelaCancelada(response.data);
    } catch (error: any) {
      console.log(error);
      const msg = extractErrorMessage(error);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col">
        <NavBar></NavBar>
        <h1 className="text-2xl my-2 font-bold">Cancelar Cobrança</h1>
        <p>TxId:</p>
        <input
          type="text"
          placeholder="25df0dfec3464a4690e..."
          className="ring-1 rounded-sm p-2 w-1/4 self-center mt-2"
          onChange={(e) => setTxId(e.target.value)}
        />
        <button
          onClick={cancelarCobranca}
          className=" sm:rounded-md ring-1 p-4 sm:p-2 self-center mt-4 bg-slate-800 text-white w-full sm:w-[30vw]"
        >
          Enviar
        </button>{" "}
        {loading && <p className="mt-2">Carregando ....</p>}
        {error && (
          <p className="text-red-500 break-all self-center w-1/2 mt-2">
            Erro: {error}
          </p>
        )}
        {tabelaCancelada && (
          <table className="min-w-full border border-gray-300 rounded-md mt-5">
            <thead className="bg-gray-100">
              <tr>
                {/* Cabeçalho da tabela */}
                <th className="py-2 px-4 border-b text-left text-gray-700">
                  Campo
                </th>
                <th className="py-2 px-4 border-b text-left text-gray-700">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {/* ID da recorrência */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">ID Recorrência</td>
                <td className="py-2 px-4">{tabelaCancelada.idRec}</td>
              </tr>

              {/* Status principal da cobrança */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Status</td>
                <td className="py-2 px-4">{tabelaCancelada.status}</td>
              </tr>

              {/* Valor da cobrança */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Valor</td>
                <td className="py-2 px-4">
                  R$ {tabelaCancelada.valor.original}
                </td>
              </tr>

              {/* Informações adicionais */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Informações</td>
                <td className="py-2 px-4">{tabelaCancelada.infoAdicional}</td>
              </tr>

              {/* Política de retentativa */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">
                  Política de Retentativa
                </td>
                <td className="py-2 px-4">
                  {tabelaCancelada.politicaRetentativa}
                </td>
              </tr>

              {/* Dados do calendário */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Data de Criação</td>
                <td className="py-2 px-4">
                  {tabelaCancelada.calendario.criacao}
                </td>
              </tr>

              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Data de Vencimento</td>
                <td className="py-2 px-4">
                  {tabelaCancelada.calendario.dataDeVencimento}
                </td>
              </tr>

              {/* Informações do recebedor */}
              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Recebedor</td>
                <td className="py-2 px-4">
                  <div className="flex flex-col">
                    <p>
                      <strong>Nome:</strong> {tabelaCancelada.recebedor.nome}
                    </p>
                    <p>
                      <strong>CNPJ:</strong> {tabelaCancelada.recebedor.cnpj}
                    </p>
                    <p>
                      <strong>Agência:</strong>{" "}
                      {tabelaCancelada.recebedor.agencia}
                    </p>
                    <p>
                      <strong>Conta:</strong> {tabelaCancelada.recebedor.conta}
                    </p>
                    <p>
                      <strong>Tipo:</strong>{" "}
                      {tabelaCancelada.recebedor.tipoConta}
                    </p>
                  </div>
                </td>
              </tr>

              {/* Histórico de atualizações */}
              <tr className="border-b align-top">
                <td className="py-2 px-4 font-semibold">Atualizações</td>
                <td className="py-2 px-4">
                  {Array.isArray(tabelaCancelada.atualizacao) &&
                    tabelaCancelada.atualizacao.map((a: any) => (
                      <div className="flex gap-4 border-b py-1">
                        <p className="text-sm text-gray-700">{a.status}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(a.data).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                </td>
              </tr>

              {/* Tentativas de cobrança */}
              <tr className="border-b align-top">
                <td className="py-2 px-4 font-semibold">Tentativas</td>
                <td className="py-2 px-4">
                  {Array.isArray(tabelaCancelada.tentativas) &&
                    tabelaCancelada.tentativas.map((t: any) => (
                      <div className="flex flex-col border-b py-1">
                        <p>
                          <strong>Status:</strong> {t.status}
                        </p>
                        <p>
                          <strong>Data:</strong>{" "}
                          {new Date(t.data).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
