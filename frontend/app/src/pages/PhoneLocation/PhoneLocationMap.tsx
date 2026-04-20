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
  device_token: string | null;
  active: boolean;
  last_position_at: string | null;
  created_at: string;
  updated_at: string;
}

const REFRESH_INTERVAL_MS = 30_000;

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

export const PhoneLocationMap = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<PhoneDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // formulário de cadastro
  const [newName, setNewName] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [createdCredentials, setCreatedCredentials] =
    useState<PhoneDevice | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [, setTick] = useState(0);

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
      markersRef.current = L.layerGroup().addTo(map);
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

  // render markers when devices change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    devices.forEach((d) => {
      if (d.latitude == null || d.longitude == null) return;
      const popup = `
        <div style="font-family: sans-serif; font-size: 14px; min-width:180px;">
          <strong style="font-size:16px;">${d.person_name}</strong><br/>
          <div style="margin-top:4px; color:#555;">
            ${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}
          </div>
          <div style="margin-top:4px;">
            <span style="color:#2563eb;">${minutesSince(d.last_position_at)}</span>
          </div>
          ${
            d.accuracy != null
              ? `<div style="color:#666; font-size:12px;">Precisão: ${Math.round(d.accuracy)} m</div>`
              : ""
          }
          ${
            d.battery != null
              ? `<div style="color:#666; font-size:12px;">Bateria: ${Math.round(d.battery)}%</div>`
              : ""
          }
        </div>
      `;
      const marker = L.marker([d.latitude, d.longitude]).bindPopup(popup);
      marker.bindTooltip(d.person_name, {
        permanent: true,
        direction: "top",
        offset: [0, -30],
        className: "phone-location-label",
      });
      markersRef.current?.addLayer(marker);
      bounds.extend([d.latitude, d.longitude]);
    });

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [devices]);

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.token || !newName.trim()) return;
    try {
      const res = await axios.post<PhoneDevice>(
        api,
        {
          person_name: newName.trim(),
          device_id: newDeviceId.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      setCreatedCredentials(res.data);
      setNewName("");
      setNewDeviceId("");
      fetchDevices();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.error || "Erro ao registrar dispositivo.",
      );
    }
  };

  return (
    <>
      <NavBar className="z-[1001]" />

      <style>{`
        .phone-location-label {
          background: rgba(255,255,255,0.9);
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 2px 6px;
          font-weight: 600;
          font-size: 12px;
          color: #111;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
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
            Atualiza automaticamente a cada 30s
          </p>
          {loading && (
            <p className="text-xs text-blue-500 mt-1">Atualizando...</p>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold mb-2">Registrar dispositivo</h2>
          <form onSubmit={handleCreateDevice} className="space-y-2">
            <input
              type="text"
              placeholder="Nome da pessoa"
              className="w-full p-2 border border-gray-300 rounded text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="device_id (opcional)"
              className="w-full p-2 border border-gray-300 rounded text-sm"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded"
            >
              Gerar credenciais
            </button>
          </form>

          {createdCredentials && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
              <p className="font-semibold text-green-800 mb-1">
                Dispositivo criado — envie ao celular:
              </p>
              <p>
                <strong>device_id:</strong>{" "}
                <code className="break-all">
                  {createdCredentials.device_id}
                </code>
              </p>
              <p>
                <strong>device_token:</strong>{" "}
                <code className="break-all">
                  {createdCredentials.device_token}
                </code>
              </p>
              <button
                className="mt-2 text-blue-600 underline"
                onClick={() => setCreatedCredentials(null)}
              >
                Ocultar
              </button>
            </div>
          )}
        </div>

        <div className="p-4">
          <h2 className="text-sm font-semibold mb-2">
            Dispositivos ({devices.length})
          </h2>
          {devices.length === 0 && (
            <p className="text-xs text-gray-500">
              Nenhum dispositivo cadastrado.
            </p>
          )}
          <ul className="space-y-2">
            {devices.map((d) => (
              <li
                key={d.id}
                className="p-2 border border-gray-200 rounded text-sm"
              >
                <div className="flex justify-between items-start">
                  <strong>{d.person_name}</strong>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      d.last_position_at &&
                      Date.now() - new Date(d.last_position_at).getTime() <
                        15 * 60_000
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {d.last_position_at &&
                    Date.now() - new Date(d.last_position_at).getTime() <
                      15 * 60_000
                      ? "online"
                      : "offline"}
                  </span>
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
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default PhoneLocationMap;
