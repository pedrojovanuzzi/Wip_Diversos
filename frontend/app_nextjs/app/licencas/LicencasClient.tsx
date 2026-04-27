"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FaPlus,
  FaTrash,
  FaLock,
  FaUnlock,
  FaKey,
  FaDesktop,
} from "react-icons/fa";
import {
  createLicencaAction,
  deleteLicencaAction,
  toggleLicencaStatusAction,
} from "./actions";

export interface Licenca {
  id: number;
  cliente_nome: string;
  software: string;
  chave: string;
  status: "ativo" | "bloqueado" | "cancelado";
  observacao: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  initialLicencas: Licenca[];
  initialError: string | null;
}

export default function LicencasClient({ initialLicencas, initialError }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const [clienteNome, setClienteNome] = useState("");
  const [software, setSoftware] = useState("");
  const [chave, setChave] = useState("");
  const [observacao, setObservacao] = useState("");

  function flash(kind: "ok" | "err", msg: string) {
    if (kind === "ok") {
      setSuccess(msg);
      setError(null);
    } else {
      setError(msg);
      setSuccess(null);
    }
    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 4000);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createLicencaAction({
        cliente_nome: clienteNome,
        software,
        chave,
        observacao,
      });
      if (res.ok) {
        flash("ok", "Licença criada com sucesso!");
        setShowModal(false);
        setClienteNome("");
        setSoftware("");
        setChave("");
        setObservacao("");
        router.refresh();
      } else {
        flash("err", res.error ?? "Erro ao criar licença.");
      }
    });
  }

  function handleToggleStatus(licenca: Licenca) {
    const novoStatus = licenca.status === "ativo" ? "bloqueado" : "ativo";
    if (!window.confirm(`Deseja alterar o status para ${novoStatus}?`)) return;
    startTransition(async () => {
      const res = await toggleLicencaStatusAction(licenca.id, novoStatus);
      if (res.ok) {
        flash("ok", `Status alterado para ${novoStatus}.`);
        router.refresh();
      } else {
        flash("err", res.error ?? "Erro ao alterar status.");
      }
    });
  }

  function handleDelete(id: number) {
    if (!window.confirm("Tem certeza que deseja excluir esta licença?")) return;
    startTransition(async () => {
      const res = await deleteLicencaAction(id);
      if (res.ok) {
        flash("ok", "Licença removida.");
        router.refresh();
      } else {
        flash("err", res.error ?? "Erro ao excluir licença.");
      }
    });
  }

  function gerarChaveAleatoria() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 20; i++) {
      if (i > 0 && i % 4 === 0) result += "-";
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setChave(result);
  }

  return (
    <div className="h-screen bg-gray-200 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaDesktop /> Gerenciar Licenças de Software
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
          >
            <FaPlus /> Nova Licença
          </button>
        </div>

        {success && (
          <div className="mb-4 p-3 rounded bg-green-100 text-green-800 text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="bg-gray-100 shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Software</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chave</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {initialLicencas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Nenhuma licença encontrada.
                    </td>
                  </tr>
                ) : (
                  initialLicencas.map((licenca) => (
                    <tr key={licenca.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {licenca.cliente_nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {licenca.software}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 family-mono">
                        {licenca.chave}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            licenca.status === "ativo"
                              ? "bg-green-100 text-green-800"
                              : licenca.status === "bloqueado"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {licenca.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(licenca.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(licenca)}
                          disabled={pending}
                          className={
                            licenca.status === "ativo"
                              ? "text-red-600 hover:text-red-900 disabled:opacity-50"
                              : "text-green-600 hover:text-green-900 disabled:opacity-50"
                          }
                          title={licenca.status === "ativo" ? "Bloquear" : "Desbloquear"}
                        >
                          {licenca.status === "ativo" ? <FaLock /> : <FaUnlock />}
                        </button>
                        <button
                          onClick={() => handleDelete(licenca.id)}
                          disabled={pending}
                          className="text-red-600 hover:text-red-900 ml-2 disabled:opacity-50"
                          title="Excluir"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Nova Licença</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Nome do Cliente</label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Software</label>
                <input
                  type="text"
                  value={software}
                  onChange={(e) => setSoftware(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Chave (HWID/Serial/MAC)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    required
                  />
                  <button
                    type="button"
                    onClick={gerarChaveAleatoria}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded"
                    title="Gerar Aleatória"
                  >
                    <FaKey />
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">Observação</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-2 px-4 rounded disabled:opacity-60"
                >
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
