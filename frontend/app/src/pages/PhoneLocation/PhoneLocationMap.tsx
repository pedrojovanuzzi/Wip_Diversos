import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

// Fix Leaflet default icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

interface PhoneDevice {
  id: number;
  device_id: string;
  person_name: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  battery: number | null;
  active: boolean;
  last_position_at: string | null;
  created_at: string;
  updated_at: string;
}

const REFRESH_INTERVAL_MS = 10_000;

function minutesSince(iso: string | null): string {
  if (!iso) return "sem dados";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.floor((now - then) / 60_000));
  if (diffMin === 0) return "há poucos segundos";
  if (diffMin === 1) return "há 1 minuto";
  if (diffMin < 60) return `há ${diffMin} minutos`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours < 24) return `há ${hours}h ${mins}min`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

const ONLINE_THRESHOLD_MS = 2 * 60_000;

function isOnline(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < ONLINE_THRESHOLD_MS;
}

function buildMarkerIcon(name: string, online: boolean): L.DivIcon {
  const initials = getInitials(name);
  const bg = colorFromString(name);
  const ring = online ? "#22c55e" : "#9ca3af";
  const pulse = online
    ? `<span class="pl-pulse" style="background:${ring};"></span>`
    : "";
  const html = `
    <div class="pl-marker">
      ${pulse}
      <div class="pl-avatar" style="background:${bg}; box-shadow: 0 0 0 3px ${ring}, 0 2px 6px rgba(0,0,0,0.25);">
        <span>${initials}</span>
      </div>
      <div class="pl-name">${name}</div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "pl-marker-wrapper",
    iconSize: [48, 60],
    iconAnchor: [24, 52],
    popupAnchor: [0, -48],
  });
}

const HIDDEN_STORAGE_KEY = "phone-location:hidden-devices";

function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveHidden(set: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export const PhoneLocationMap = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<PhoneDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden());

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasFitBoundsRef = useRef(false);
  const [, setTick] = useState(0);

  const toggleHidden = useCallback((deviceId: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      saveHidden(next);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setHidden(() => {
      const next = new Set<string>();
      saveHidden(next);
      return next;
    });
  }, []);

  const api = useMemo(
    () => `${process.env.REACT_APP_URL}/phone-location`,
    [],
  );

  const fetchDevices = useCallback(async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const res = await axios.get<PhoneDevice[]>(api, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setDevices(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os dispositivos.");
    } finally {
      setLoading(false);
    }
  }, [api, user?.token]);

  // init map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        worldCopyJump: true,
      }).setView([0, 0], 2);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // fetch on mount + auto-refresh
  useEffect(() => {
    fetchDevices();
    const id = setInterval(fetchDevices, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchDevices]);

  // re-render a cada 30s para atualizar "há X minutos"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // render / sync markers when devices change (sem flicker)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = L.latLngBounds([]);
    const seen = new Set<string>();

    devices.forEach((d) => {
      if (d.latitude == null || d.longitude == null) return;
      if (hidden.has(d.device_id)) return;
      seen.add(d.device_id);

      const online = isOnline(d.last_position_at);
      const statusColor = online ? "#16a34a" : "#6b7280";
      const statusLabel = online ? "Online" : "Offline";
      const popupHtml = `
        <div class="pl-popup">
          <div class="pl-popup-head">
            <div class="pl-popup-avatar" style="background:${colorFromString(d.person_name)};">
              ${getInitials(d.person_name)}
            </div>
            <div class="pl-popup-heading">
              <strong>${d.person_name}</strong>
              <span class="pl-popup-status" style="color:${statusColor};">
                <span class="pl-popup-dot" style="background:${statusColor};"></span>
                ${statusLabel} · ${minutesSince(d.last_position_at)}
              </span>
            </div>
          </div>
          <div class="pl-popup-body">
            <div class="pl-popup-row">
              <span>📍</span>
              <span>${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}</span>
            </div>
            ${
              d.accuracy != null
                ? `<div class="pl-popup-row"><span>🎯</span><span>Precisão: ${Math.round(d.accuracy)} m</span></div>`
                : ""
            }
            ${
              d.battery != null
                ? `<div class="pl-popup-row"><span>🔋</span><span>Bateria: ${Math.round(d.battery)}%</span></div>`
                : ""
            }
          </div>
        </div>
      `;

      const existing = markersRef.current.get(d.device_id);
      if (existing) {
        existing.setLatLng([d.latitude, d.longitude]);
        existing.setIcon(buildMarkerIcon(d.person_name, online));
        existing.setPopupContent(popupHtml);
      } else {
        const marker = L.marker([d.latitude, d.longitude], {
          icon: buildMarkerIcon(d.person_name, online),
        })
          .bindPopup(popupHtml, { closeButton: true })
          .addTo(map);
        markersRef.current.set(d.device_id, marker);
      }

      bounds.extend([d.latitude, d.longitude]);
    });

    // remove dispositivos que sumiram da resposta
    markersRef.current.forEach((marker, deviceId) => {
      if (!seen.has(deviceId)) {
        map.removeLayer(marker);
        markersRef.current.delete(deviceId);
      }
    });

    // centraliza apenas na primeira carga com dados
    if (!hasFitBoundsRef.current && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      hasFitBoundsRef.current = true;
    }
  }, [devices, hidden]);

  return (
    <>
      <NavBar className="z-[1001]" />

      <style>{`
        .leaflet-marker-icon.pl-marker-wrapper {
          transition: transform 0.6s ease-out;
        }
        .pl-marker-wrapper {
          background: transparent !important;
          border: none !important;
        }
        .pl-marker {
          position: relative;
          width: 48px;
          height: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: auto;
        }
        .pl-avatar {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          font-family: system-ui, sans-serif;
          z-index: 2;
          transition: transform 0.15s ease;
        }
        .pl-marker:hover .pl-avatar {
          transform: scale(1.1);
        }
        .pl-name {
          position: absolute;
          top: -22px;
          background: rgba(17,24,39,0.92);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          font-family: system-ui, sans-serif;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          pointer-events: none;
        }
        .pl-name::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          border-width: 4px 4px 0 4px;
          border-style: solid;
          border-color: rgba(17,24,39,0.92) transparent transparent transparent;
        }
        .pl-pulse {
          position: absolute;
          top: 6px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          opacity: 0.6;
          animation: pl-pulse 2s ease-out infinite;
          z-index: 1;
        }
        @keyframes pl-pulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0;   }
        }

        .leaflet-popup-content-wrapper {
          border-radius: 10px !important;
          padding: 0 !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.18) !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
          min-width: 240px;
        }
        .pl-popup {
          font-family: system-ui, sans-serif;
          padding: 12px 14px;
        }
        .pl-popup-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .pl-popup-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }
        .pl-popup-heading {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .pl-popup-heading strong {
          font-size: 15px;
          color: #111;
        }
        .pl-popup-status {
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pl-popup-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .pl-popup-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pl-popup-row {
          font-size: 12px;
          color: #444;
          display: flex;
          gap: 6px;
          align-items: center;
        }
      `}</style>

      <div className="absolute top-0 left-0 w-full h-full z-0">
        <div
          ref={mapContainerRef}
          style={{ height: "100%", width: "100%" }}
        />
      </div>

      {/* Painel lateral */}
      <div className="absolute top-20 right-4 z-[1000] bg-white rounded-lg shadow-lg w-80 max-h-[85vh] overflow-y-auto">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">Rastreamento de Celulares</h1>
          <p className="text-xs text-gray-500">
            Atualiza automaticamente a cada {Math.round(REFRESH_INTERVAL_MS / 1000)}s
          </p>
          {loading && (
            <p className="text-xs text-blue-500 mt-1">Atualizando...</p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">
              Funcionários ({devices.length - hidden.size}/{devices.length})
            </h2>
            {hidden.size > 0 && (
              <button
                onClick={showAll}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Mostrar todos
              </button>
            )}
          </div>
          {devices.length === 0 && (
            <p className="text-xs text-gray-500">
              Nenhum funcionário registrado ainda. O registro é feito
              automaticamente quando o aplicativo envia a primeira posição.
            </p>
          )}
          <ul className="space-y-2">
            {devices.map((d) => {
              const isHidden = hidden.has(d.device_id);
              const online = isOnline(d.last_position_at);
              return (
                <li
                  key={d.id}
                  className={`p-2 border rounded text-sm transition-opacity ${
                    isHidden
                      ? "border-gray-200 bg-gray-50 opacity-60"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <strong className={isHidden ? "line-through" : ""}>
                      {d.person_name}
                    </strong>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          online
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {online ? "online" : "offline"}
                      </span>
                      <button
                        onClick={() => toggleHidden(d.device_id)}
                        title={isHidden ? "Mostrar no mapa" : "Ocultar do mapa"}
                        className={`text-base leading-none px-1.5 py-0.5 rounded hover:bg-gray-100 ${
                          isHidden ? "text-gray-400" : "text-gray-700"
                        }`}
                      >
                        {isHidden ? "\u{1F648}" : "\u{1F441}"}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {minutesSince(d.last_position_at)}
                  </div>
                  {d.latitude != null && d.longitude != null ? (
                    <div className="text-[11px] text-gray-500">
                      {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400">
                      sem localização
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
};

export default PhoneLocationMap;
