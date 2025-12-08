"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { FaFilePdf } from "react-icons/fa";

interface PopUpObsProps {
  setShowPopUp: (show: boolean) => void;
  showPopUp: boolean;
  setObs: (text: string) => void;
  obs: string;
  confirmAction: () => void;
}

export default function PopUpObs({
  setShowPopUp,
  showPopUp,
  setObs,
  obs,
  confirmAction,
}: PopUpObsProps) {
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
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-100">
                <FaFilePdf
                  aria-hidden="true"
                  className="size-6 text-blue-600"
                />
              </div>
              <span className="flex justify-center mt-5 text-lg font-medium text-gray-900">
                Gerar PDF
              </span>
              <div className="mt-3 text-center sm:mt-5">
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-gray-900"
                >
                  Digite a Observação da Nota Fiscal
                </DialogTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Esta observação será incluída no rodapé do PDF.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              <input
                type="text"
                placeholder="Observação (opcional)"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                className="w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-3"
              />

              <div className="flex gap-3 sm:flex-row-reverse mt-2">
                <button
                  type="button"
                  onClick={() => {
                    confirmAction();
                  }}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                >
                  Gerar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPopUp(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
