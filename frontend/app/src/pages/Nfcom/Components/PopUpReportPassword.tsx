"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { FaFileSignature } from "react-icons/fa";

interface PopUpReportPasswordProps {
  setShowPopUp: (show: boolean) => void;
  showPopUp: boolean;
  setPassword: (text: string) => void;
  password: string;
  generateReport: () => void;
}

export default function PopUpReportPassword({
  setShowPopUp,
  showPopUp,
  setPassword,
  password,
  generateReport,
}: PopUpReportPasswordProps) {
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
                <FaFileSignature
                  aria-hidden="true"
                  className="size-6 text-blue-600"
                />
              </div>
              <span className="flex justify-center mt-5">
                Gerar Relatório PDF
              </span>
              <div className="mt-3 text-center sm:mt-5">
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-gray-900"
                >
                  Informe a Senha do Certificado
                </DialogTitle>
              </div>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                placeholder="Senha do certificado"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    generateReport();
                  }
                }}
                className="ring-2 ring-indigo-400 p-2 rounded w-full"
              />

              <button
                type="button"
                data-autofocus
                onClick={() => {
                  generateReport();
                }}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset hover:bg-blue-500 sm:col-start-1 sm:mt-0"
              >
                Gerar Relatório
              </button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
