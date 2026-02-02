import React from "react";
import { FaExclamationTriangle } from "react-icons/fa";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center animate-bounce-in">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <FaExclamationTriangle className="text-4xl text-red-600" />
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">Atenção!</h2>

        <p className="text-gray-600 text-center mb-6 text-lg">{message}</p>

        <button
          onClick={onClose}
          className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition transform active:scale-95"
        >
          OK
        </button>
      </div>
    </div>
  );
};
