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
    ["@", "_", "SPACE", "-", "/"],
  ];

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border-white/10  w-full max-w-4xl mx-auto select-none">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5 w-full">
          {row.map((key, keyIndex) => (
            <React.Fragment key={`${rowIndex}-${keyIndex}`}>
              {(() => {
                let widthClass = "w-8 sm:w-10 lg:w-20"; // Responsive default key width
                let bgClass =
                  "bg-slate-700 hover:bg-slate-600 active:bg-cyan-600";
                let textClass =
                  "text-white text-base sm:text-lg lg:text-3xl font-medium"; // Responsive font size

                // Special key styling
                if (key === "SPACE") {
                  widthClass = "flex-grow max-w-lg";
                } else if (
                  key === "BACKSPACE" ||
                  key === "ENTER" ||
                  key === "SHIFT" ||
                  key === "CAPS"
                ) {
                  widthClass = "w-14 sm:w-16 lg:w-32 px-1 lg:px-4";
                  bgClass =
                    "bg-slate-800 hover:bg-slate-700 active:bg-purple-600";
                  textClass =
                    "text-slate-300 text-[10px] sm:text-xs lg:text-lg font-bold tracking-wide";
                }

                // Activated state for toggle keys
                if (
                  (key === "SHIFT" && isShift) ||
                  (key === "CAPS" && isCaps)
                ) {
                  bgClass =
                    "bg-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.5)] border-cyan-400";
                  textClass = "text-white font-bold";
                }

                return (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleKeyPress(key);
                    }}
                    className={`
                      ${widthClass} h-12 lg:h-20 rounded-lg lg:rounded-xl 
                      flex items-center justify-center 
                      transition-all duration-150 transform active:scale-95
                      border-b-2 lg:border-b-4 border-black/30 active:border-b-0 active:translate-y-1
                      ${bgClass} ${textClass}
                    `}
                  >
                    {key === "BACKSPACE" ? (
                      <FaBackspace className="text-sm lg:text-xl" />
                    ) : key === "SHIFT" ? (
                      <FaArrowUp
                        className={`text-xs lg:text-sm duration-300 ${
                          isShift ? "rotate-0" : ""
                        }`}
                      />
                    ) : key === "SPACE" ? (
                      <div className="w-16 lg:w-32 h-1 bg-white/20 rounded-full"></div>
                    ) : (
                      getKeyLabel(key)
                    )}
                  </button>
                );
              })()}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
};
