import React from "react";
import { FaHandPointUp } from "react-icons/fa";

interface IdleScreenProps {
  onStart: () => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({ onStart }) => {
  return (
    <div
      onClick={onStart}
      className="fixed inset-0 z-50 flex flex-col h-screen w-screen overflow-hidden bg-slate-900 font-sans"
    >
      {/* Background Ambience matches TokenAutoAtendimento */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opactiy-80"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="w-full bg-slate-900/50 backdrop-blur-md border-b border-white/5 py-6 px-6 flex flex-col items-center justify-center relative z-10">
        <img
          src="/imgs/icon.png"
          alt="Logo"
          className="h-24 mb-4 object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
        />
        <div className="text-slate-400 font-light text-2xl uppercase tracking-[0.2em]">
          Terminal <span className="lowercase text-slate-500">de</span>
        </div>
        <div className="text-white font-bold text-4xl sm:text-5xl uppercase tracking-wider mt-1 drop-shadow-lg">
          Autoatendimento
        </div>
        {/* Glow line under header */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-70"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-8 z-10">
        {/* Central Card/Icon */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-full p-16 shadow-[0_0_60px_rgba(34,211,238,0.15)] mb-16 animate-pulse relative group">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>
          <FaHandPointUp className="text-cyan-400 text-8xl sm:text-9xl relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
        </div>

        {/* Action Button */}
        <button className="group relative px-12 py-6 rounded-full shadow-2xl transform transition-all hover:scale-105 active:scale-95 cursor-pointer overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-700 opacity-90 group-hover:opacity-100 transition-opacity"></div>

          {/* Button content */}
          <div className="relative flex items-center space-x-4">
            <span className="text-3xl text-white font-bold tracking-widest uppercase drop-shadow-md">
              Toque Aqui
            </span>
          </div>

          {/* Button Glow/Sheen */}
          <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 group-hover:animate-shine"></div>
        </button>
      </div>

      {/* Footer */}
      <div className="w-full py-10 text-center relative z-10">
        <div className="bg-slate-800/40 backdrop-blur-sm inline-block px-10 py-4 rounded-full border border-white/5 shadow-lg">
          <p className="text-slate-300 text-lg sm:text-l font-light tracking-widest drop-shadow-md">
            O NOSSO COMPROMISSO É AGILIZAR O SEU ATENDIMENTO
          </p>
        </div>
        {/* Decorative corner elements */}
        <div className="absolute bottom-6 right-8 text-white/5 text-[10rem] font-bold opacity-20 pointer-events-none select-none leading-none">
          W
        </div>
      </div>
    </div>
  );
};
