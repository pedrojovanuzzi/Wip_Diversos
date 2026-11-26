"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MdOutlineWarningAmber } from "react-icons/md";

interface PopUpConfirmEmailCpfProps {
  showPopUp: boolean;
  setShowPopUp: (show: boolean) => void;
  /** Notas de pessoa física que ficaram pendentes de confirmação. */
  notas: { numeracao: number; motivo: string }[];
  confirmar: () => void;
}

export default function PopUpConfirmEmailCpf({
  showPopUp,
  setShowPopUp,
  notas,
  confirmar,
}: PopUpConfirmEmailCpfProps) {
  const quantidade = notas.length;

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
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-yellow-100">
                <MdOutlineWarningAmber
                  aria-hidden="true"
                  className="size-6 text-yellow-600"
                />
              </div>
              <div className="mt-3 text-center sm:mt-5">
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-gray-900"
                >
                  {quantidade === 1
                    ? "Esta nota é de pessoa física (CPF)"
                    : `${quantidade} notas são de pessoa física (CPF)`}
                </DialogTitle>
                <p className="mt-2 text-sm text-gray-500">
                  O envio automático da NFCom por e-mail vale apenas para CNPJ.
                  Confirme se deseja enviar mesmo assim.
                </p>
              </div>
            </div>

            <ul className="mt-4 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {notas.map((nota) => (
                <li key={nota.numeracao} className="py-0.5">
                  Nota Nº {nota.numeracao}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                data-autofocus
                onClick={confirmar}
                className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 sm:w-auto"
              >
                Enviar mesmo assim
              </button>
              <button
                type="button"
                onClick={() => setShowPopUp(false)}
                className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
              >
                Cancelar
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
