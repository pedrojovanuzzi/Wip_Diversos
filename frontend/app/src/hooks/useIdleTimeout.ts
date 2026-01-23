import { useState, useEffect, useRef } from "react";

export const useIdleTimeout = ({
  onIdle,
  idleTime = 180, // Default 3 minutes
}: {
  onIdle: () => void;
  idleTime?: number;
}) => {
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(onIdle, idleTime * 1000);
  };

  useEffect(() => {
    const events = [
      "mousemove",
      "mousedown",
      "keypress",
      "DOMMouseScroll",
      "mousewheel",
      "touchmove",
      "MSPointerMove",
      "click",
    ];

    const handleEvent = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleEvent);
    });

    resetTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleEvent);
      });
    };
  }, [idleTime, onIdle]);

  return {
    resetTimer,
  };
};
