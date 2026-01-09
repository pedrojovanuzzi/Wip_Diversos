import React, { useState } from "react";
import { FaBackspace, FaArrowUp, FaSpaceShuttle } from "react-icons/fa";

interface KeyboardProps {
  onKeyPress: (key: string) => void;
}

export const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress }) => {
  const [isShift, setIsShift] = useState(false);
  const [isCaps, setIsCaps] = useState(false);

  const handleKeyPress = (key: string) => {
    if (key === "SHIFT") {
      setIsShift(!isShift);
    } else if (key === "CAPS") {
      setIsCaps(!isCaps);
    } else {
      let keyToSend = key;
      if (key.length === 1) {
        // Only modify case for single characters (letters)
        if (isShift || isCaps) {
          keyToSend = key.toUpperCase();
        } else {
          keyToSend = key.toLowerCase();
        }
      }
      onKeyPress(keyToSend);
      if (isShift) setIsShift(false); // Auto-release shift after one char
    }
  };

  const getKeyLabel = (key: string) => {
    if (key.length === 1 && /[a-zA-ZçÇ]/.test(key)) {
      return isShift || isCaps ? key.toUpperCase() : key.toLowerCase();
    }
    return key;
  };

  const rows = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "BACKSPACE"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ç", "ENTER"],
    ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "SHIFT"],
    ["SPACE"],
  ];

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl w-full max-w-4xl mx-auto select-none">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5 w-full">
          {row.map((key, keyIndex) => {
            let widthClass = "w-12 sm:w-14"; // Default key width
            let bgClass = "bg-slate-700 hover:bg-slate-600 active:bg-cyan-600";
            let textClass = "text-white text-xl font-medium";

            // Special key styling
            if (key === "SPACE") {
              widthClass = "flex-grow max-w-md";
            } else if (
              key === "BACKSPACE" ||
              key === "ENTER" ||
              key === "SHIFT" ||
              key === "CAPS"
            ) {
              widthClass = "w-20 sm:w-24 px-2";
              bgClass = "bg-slate-800 hover:bg-slate-700 active:bg-purple-600";
              textClass = "text-slate-300 text-sm font-bold tracking-wide";
            }

            // Activated state for toggle keys
            if ((key === "SHIFT" && isShift) || (key === "CAPS" && isCaps)) {
              bgClass =
                "bg-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.5)] border-cyan-400";
              textClass = "text-white font-bold";
            }

            return (
              <button
                key={`${rowIndex}-${keyIndex}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleKeyPress(key);
                }}
                className={`
                  ${widthClass} h-14 rounded-lg 
                  flex items-center justify-center 
                  transition-all duration-150 transform active:scale-95
                  border-b-4 border-black/30 active:border-b-0 active:translate-y-1
                  ${bgClass} ${textClass}
                `}
              >
                {key === "BACKSPACE" ? (
                  <FaBackspace className="text-xl" />
                ) : key === "SHIFT" ? (
                  <FaArrowUp
                    className={`text-sm duration-300 ${
                      isShift ? "rotate-0" : ""
                    }`}
                  />
                ) : key === "SPACE" ? (
                  <div className="w-32 h-1 bg-white/20 rounded-full"></div>
                ) : (
                  getKeyLabel(key)
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
