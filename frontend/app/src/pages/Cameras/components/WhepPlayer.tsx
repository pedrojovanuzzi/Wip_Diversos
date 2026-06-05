import React, { useEffect, useRef, useState } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

interface Props {
  whepUrl: string;
  className?: string;
}

/**
 * Player WebRTC/WHEP minimalista para o MediaMTX.
 * Fluxo non-trickle: cria a oferta, espera o ICE terminar, envia a SDP e aplica a resposta.
 */
export const WhepPlayer: React.FC<Props> = ({ whepUrl, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (ev) => {
      if (videoRef.current && ev.streams[0]) {
        videoRef.current.srcObject = ev.streams[0];
      }
    };

    const waitIce = () =>
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const check = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", check);
        // fallback caso o ICE demore
        setTimeout(resolve, 3000);
      });

    const start = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitIce();

        const resp = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription?.sdp || "",
        });
        if (!resp.ok) {
          throw new Error(`WHEP ${resp.status}`);
        }
        const answer = await resp.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError("Não foi possível conectar ao vídeo.");
          setLoading(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      pc.close();
    };
  }, [whepUrl]);

  return (
    <div className={`relative bg-black rounded-md overflow-hidden ${className || ""}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
      />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-white gap-2">
          <AiOutlineLoading3Quarters className="animate-spin" /> Conectando...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-300 text-sm p-4 text-center">
          {error}
        </div>
      )}
    </div>
  );
};
