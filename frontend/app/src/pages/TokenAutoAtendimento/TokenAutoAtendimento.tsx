import React from "react";
import { FaCreditCard, FaComments, FaUser } from "react-icons/fa";
import { QRCodeCanvas } from "qrcode.react";
import { HiChip } from "react-icons/hi";
import { Link, useLocation } from "react-router-dom";
import { Keyboard } from "./components/Keyboard";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";
import { IdleScreen } from "./components/IdleScreen";
import { useState } from "react";

export const TokenAutoAtendimento = () => {
  const location = useLocation();
  const [isIdle, setIsIdle] = useState(() => {
    // If explicitly requested to be idle (e.g. timeout or finish task)
    if (location.state?.forceIdle === true) return true;

    // If explicitly requested to be active (e.g. back button)
    if (location.state?.forceIdle === false) return false;

    // Default to idle (Attract Mode) on fresh load
    return true;
  });

  const { resetTimer } = useIdleTimeout({
    onIdle: () => setIsIdle(true),
    idleTime: 180, // 3 minutes
  });

  const handleStart = () => {
    setIsIdle(false);
    resetTimer();
  };

  if (isIdle) {
    return <IdleScreen onStart={handleStart} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opactiy-80"></div>
        {/* Abstract circuit-like lines or glows can be added here with SVG or CSS */}
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Kiosk Frame */}
      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[800px] sm:h-[800px]  border-t-white/20 border-l-white/20">
        {/* Glow Effects on Frame */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-purple-400 to-transparent opacity-50"></div>

        {/* Header */}
        <div className="flex flex-col items-center pt-10 pb-6">
          <div className="flex items-center space-x-3 text-cyan-400 mb-2">
            <img
              src="/imgs/icon.png"
              alt="Logo"
              className="h-20 w-auto drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            />
            <div className="flex flex-col">
              <span className="text-3xl font-bold tracking-wider text-white drop-shadow-md">
                TOTEM
              </span>
              <span className="text-xs tracking-[0.2em] text-cyan-300">
                WIP TELECOM
              </span>
            </div>
          </div>
        </div>

        {/* Main Buttons */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-5 px-8">
          <button className="group w-full relative overflow-hidden rounded-full p-[2px] transition-all duration-300 hover:scale-[1.02] active:scale-95 focus:outline-none">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full opacity-80 blur group-hover:opacity-100 transition-opacity"></div>
            <Link to="/TokenAutoAtendimento/pagar-fatura">
              <div className="relative bg-slate-900/40 backdrop-blur-sm rounded-full w-full h-16 flex items-center justify-between px-6 border border-white/10 group-hover:bg-opacity-30 transition-all">
                <span className="text-white font-bold text-lg tracking-wide uppercase drop-shadow">
                  Pagar Ultima Fatura
                </span>
                <FaCreditCard className="text-purple-200 text-2xl" />
              </div>
            </Link>
          </button>

          {/* <button className="group w-full relative overflow-hidden rounded-full p-[2px] transition-all duration-300 hover:scale-[1.02] active:scale-95 focus:outline-none">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full opacity-80 blur group-hover:opacity-100 transition-opacity"></div>
            <Link to="/TokenAutoAtendimento/criar-chamado">
              <div className="relative bg-slate-900/40 backdrop-blur-sm rounded-full w-full h-16 flex items-center justify-between px-6 border border-white/10 group-hover:bg-opacity-30 transition-all">
                <span className="text-white font-bold text-lg tracking-wide uppercase drop-shadow">
                  Criar Chamado
                </span>
                <FaComments className="text-amber-100 text-2xl" />
              </div>
            </Link>
          </button> */}

          <button className="group w-full relative overflow-hidden rounded-full p-[2px] transition-all duration-300 hover:scale-[1.02] active:scale-95 focus:outline-none">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full opacity-80 blur group-hover:opacity-100 transition-opacity"></div>
            <Link to="/TokenAutoAtendimento/fazer-cadastro">
              <div className="relative bg-slate-900/40 backdrop-blur-sm rounded-full w-full h-16 flex items-center justify-between px-6 border border-white/10 group-hover:bg-opacity-30 transition-all">
                <span className="text-white font-bold text-lg tracking-wide uppercase drop-shadow">
                  Fazer Cadastro
                </span>
                <FaUser className="text-purple-100 text-2xl" />
              </div>
            </Link>
          </button>
        </div>

        <Keyboard onKeyPress={(key) => console.log(key)} />

        {/* Card Slot Visual */}
        <div className="absolute bottom-8 right-[50%] translate-x-[50%] w-32 h-1 bg-black/50 rounded-full shadow-[inset_0_-1px_1px_rgba(255,255,255,0.2)]"></div>
        <div className="absolute bottom-4 right-[50%] translate-x-[50%] w-20 h-12 border-t-2 border-white/10 rounded-t-xl mb-[-40px]"></div>
      </div>
    </div>
  );
};
