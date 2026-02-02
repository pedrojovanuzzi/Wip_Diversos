import React, { useState, useEffect } from "react";
import { FaBackspace, FaTimes } from "react-icons/fa";

interface CpfVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cpf: string) => void;
  loading?: boolean;
}

export const CpfVerificationModal: React.FC<CpfVerificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (isOpen) {
      setOtp("");
    }
  }, [isOpen]);

  const handleNumClick = (num: string) => {
    if (otp.length < 11) {
      setOtp((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setOtp((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setOtp("");
  };

  const formatCPF = (value: string) => {
    // 000.000.000-00
    // Simple mask logic for display
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Confirme seu CPF</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Display */}
        <div className="mb-6 bg-slate-900 rounded-xl p-4 text-center border-2 border-slate-700 h-16 flex items-center justify-center">
          <span
            className={`text-2xl font-mono tracking-widest ${otp ? "text-white" : "text-gray-500"}`}
          >
            {otp ? formatCPF(otp) : "___.___.___-__"}
          </span>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumClick(num.toString())}
              className="h-14 bg-slate-700 rounded-xl text-white text-xl font-bold hover:bg-slate-600 active:bg-blue-600 transition shadow-lg active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-14 bg-red-900/50 rounded-xl text-red-200 text-lg font-bold hover:bg-red-900/70 active:scale-95 transition"
          >
            C
          </button>
          <button
            onClick={() => handleNumClick("0")}
            className="h-14 bg-slate-700 rounded-xl text-white text-xl font-bold hover:bg-slate-600 active:bg-blue-600 transition shadow-lg active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-14 bg-slate-700 rounded-xl text-white text-xl font-bold hover:bg-slate-600 flex items-center justify-center active:scale-95 transition"
          >
            <FaBackspace />
          </button>
        </div>

        <button
          onClick={() => onConfirm(otp)}
          disabled={loading || otp.length < 11}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 ${
            otp.length === 11 && !loading
              ? "bg-green-600 text-white hover:bg-green-500 shadow-green-900/20 shadow-lg"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {loading ? "Verificando..." : "Confirmar Ponto"}
        </button>
      </div>
    </div>
  );
};
