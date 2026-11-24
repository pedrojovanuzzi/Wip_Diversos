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
    localStorage.setItem("idle_last_interaction", Date.now().toString());
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

    // Initialize if not present
    if (!localStorage.getItem("idle_last_interaction")) {
      resetTimer();
    }

    const intervalId = setInterval(() => {
      const lastInteraction = parseInt(
        localStorage.getItem("idle_last_interaction") || "0",
        10,
      );
      const now = Date.now();

      if (now - lastInteraction > idleTime * 1000) {
        onIdle();
        // Optionally reset here to prevent repeated calls if desired,
        // but typically onIdle navigates away or sets a state that handling updates.
        // For safety/loop prevention if onIdle doesn't stop the hook:
        // resetTimer(); // Uncomment if needed, but might mask the issue.
      }
    }, 1000); // Check every second

    return () => {
      if (intervalId) clearInterval(intervalId);
      events.forEach((event) => {
        window.removeEventListener(event, handleEvent);
      });
    };
  }, [idleTime, onIdle]);

  return {
    resetTimer,
  };
};
