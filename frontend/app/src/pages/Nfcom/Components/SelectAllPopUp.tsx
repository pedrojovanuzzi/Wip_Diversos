import React, { ReactNode } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
interface SeleactAllPopUpInterface {
  showPopUp: boolean;
  setShowPopUp: (show: boolean) => void;
  selectedIds: number[];
  setIsSelectAllMode: (mode: boolean) => void;
}

const SelectAllPopUp = ({
  showPopUp,
  setShowPopUp,
  selectedIds,
  setIsSelectAllMode,
}: SeleactAllPopUpInterface) => {
  return (
    <Dialog
      className="relative z-10"
      open={showPopUp}
      onClose={() => setShowPopUp(false)}
    >
      <DialogBackdrop className="fixed flex justify-center items-center inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in">
        <DialogPanel className="relative flex flex-col transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95">
          <DialogTitle className="text-lg font-semibold">
            Você selecionou {selectedIds.length} registros
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Deseja selecionar todos os registros?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowPopUp(false);
                setIsSelectAllMode(false);
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                setShowPopUp(false);
                setIsSelectAllMode(true);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Confirmar
            </button>
          </div>
        </DialogPanel>
      </DialogBackdrop>
    </Dialog>
  );
};

export default SelectAllPopUp;
