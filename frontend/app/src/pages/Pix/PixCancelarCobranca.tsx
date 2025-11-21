import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export const PixCancelarCobranca = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [tabelaCancelada, setTabelaCancelada] = useState<any>();
  const [txid, setTxId] = useState("");
  const [openModal, setOpenModal] = useState(false);
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

  async function buscarCobranca() {
    try {
      setLoading(true);
      setError("");
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/buscarCobranca`,
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
        <h1 className="text-2xl my-2 font-bold">Cobrança</h1>
        <p>TxId:</p>
        <input
          type="text"
          placeholder="25df0dfec3464a4690e..."
          className="ring-1 rounded-sm p-2 w-1/4 self-center mt-2"
          onChange={(e) => setTxId(e.target.value)}
        />
        <button
          onClick={() => setOpenModal(true)}
          className=" sm:rounded-md ring-1 p-4 sm:p-2 self-center mt-4 bg-red-800 text-white w-full sm:w-[30vw]"
        >
          Cancelar
        </button>{" "}
        <button
          onClick={buscarCobranca}
          className=" sm:rounded-md ring-1 p-4 sm:p-2 self-center mt-4 bg-slate-800 text-white w-full sm:w-[30vw]"
        >
          Buscar Cobrança
        </button>{" "}
        <Dialog
          open={openModal}
          onClose={setOpenModal}
          className="relative z-10"
        >
          <DialogBackdrop
            transition
            className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
          />

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full justify-center p-4 text-center items-center sm:p-0">
              <DialogPanel
                transition
                className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
              >
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:size-10">
                    <ExclamationTriangleIcon
                      aria-hidden="true"
                      className="size-6 text-red-600"
                    />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <DialogTitle
                      as="h3"
                      className="text-base font-semibold text-gray-900"
                    >
                      Cancelar Cobrança
                    </DialogTitle>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Tem certeza que deseja cancelar esta cobrança? Essa ação
                        não pode ser desfeita.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => {
                      cancelarCobranca();
                      setOpenModal(false);
                    }}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    data-autofocus
                    onClick={() => setOpenModal(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Voltar
                  </button>
                </div>
              </DialogPanel>
            </div>
          </div>
        </Dialog>
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

              <tr className="border-b">
                <td className="py-2 px-4 font-semibold">Encerramento</td>
                <td className="py-2 px-4 break-all">
                  Codigo: {tabelaCancelada.encerramento?.rejeicao?.codigo} /
                  <span>
                    {" "}
                    {tabelaCancelada.encerramento?.rejeicao?.descricao}
                  </span>
                </td>
                <br />
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
