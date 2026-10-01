"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { CgDanger } from "react-icons/cg";

/** Códigos aceitos pelo evento de cancelamento da NFS-e Nacional. */
export type CodigoMotivo = "1" | "2" | "9";

const MOTIVOS: { codigo: CodigoMotivo; rotulo: string }[] = [
  { codigo: "1", rotulo: "Erro na emissão" },
  { codigo: "2", rotulo: "Serviço não prestado" },
  { codigo: "9", rotulo: "Outros" },
];

interface PopUpButtonProps {
  setShowPopUp: (show: boolean) => void;
  showPopUp: boolean;
  setPassword: (text: string) => void;
  password: string;
  quantidade: number;
  cancelNFSE: (codigoMotivo: CodigoMotivo, motivo: string) => void;
}

export default function PopUpButton({
  setShowPopUp,
  showPopUp,
  setPassword,
  password,
  quantidade,
  cancelNFSE,
}: PopUpButtonProps) {
  const [codigoMotivo, setCodigoMotivo] = useState<CodigoMotivo>("2");
  const [motivo, setMotivo] = useState("");

  // A prefeitura exige descrição de 15 a 255 caracteres; vazia, o backend
  // usa um texto padrão para o código escolhido.
  const tamanho = motivo.trim().length;
  const motivoInvalido = tamanho > 0 && tamanho < 15;
  // "Outros" não diz nada sozinho: aí a descrição é obrigatória.
  const faltaDescricao = codigoMotivo === "9" && tamanho === 0;
  const podeEnviar = !!password && !motivoInvalido && !faltaDescricao;

  return (
    <Dialog
      open={showPopUp}
      onClose={() => setShowPopUp(false)}
      className="relative z-10"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
          >
            <div>
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100">
                <CgDanger aria-hidden="true" className="size-6 text-red-600" />
              </div>
              <div className="mt-3 text-center sm:mt-5">
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-gray-900"
                >
                  Cancelar {quantidade} {quantidade === 1 ? "nota" : "notas"}
                </DialogTitle>
                <p className="mt-1 text-sm text-gray-500">
                  O cancelamento é enviado à prefeitura e não pode ser desfeito.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="codigoMotivo"
                  className="text-sm font-medium text-gray-700"
                >
                  Motivo
                </label>
                <select
                  id="codigoMotivo"
                  value={codigoMotivo}
                  onChange={(e) =>
                    setCodigoMotivo(e.target.value as CodigoMotivo)
                  }
                  className="rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {MOTIVOS.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.codigo} - {m.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="motivo"
                  className="text-sm font-medium text-gray-700"
                >
                  Descrição{" "}
                  {codigoMotivo === "9" ? (
                    <span className="text-red-600">*</span>
                  ) : (
                    <span className="font-normal text-gray-400">
                      (opcional)
                    </span>
                  )}
                </label>
                <textarea
                  id="motivo"
                  rows={3}
                  maxLength={255}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: Valor informado errado na emissão"
                  className="rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span
                  className={`text-xs ${
                    motivoInvalido || faltaDescricao
                      ? "text-red-600"
                      : "text-gray-400"
                  }`}
                >
                  {faltaDescricao
                    ? "Descreva o motivo (mínimo 15 caracteres)."
                    : motivoInvalido
                      ? `Mínimo 15 caracteres (${tamanho}/15).`
                      : `${tamanho}/255`}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="senhaCancelamento"
                  className="text-sm font-medium text-gray-700"
                >
                  Senha do certificado
                </label>
                <input
                  id="senhaCancelamento"
                  type="password"
                  placeholder="Senha"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPopUp(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  data-autofocus
                  disabled={!podeEnviar}
                  onClick={() => {
                    setShowPopUp(false);
                    cancelNFSE(codigoMotivo, motivo.trim());
                  }}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Cancelar nota
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
