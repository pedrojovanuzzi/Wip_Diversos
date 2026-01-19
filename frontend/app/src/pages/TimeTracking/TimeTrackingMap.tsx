import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";

// Fix Leaflet default icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

interface Record {
  id: number;
  location: string;
  type: string;
  timestamp: string;
  employeeId?: number;
  employee: {
    id: number;
    name: string;
  };
  photo_url?: string;
}

interface Employee {
  id: number;
  name: string;
}

export const TimeTrackingMap = () => {
  const [records, setRecords] = useState<Record[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [selectedType, setSelectedType] = useState<string>("");

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    fetchData();
    // Cleanup map
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const [recordsRes, employeesRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_URL}/time-tracking/map-records`),
        axios.get(`${process.env.REACT_APP_URL}/time-tracking/employee`),
      ]);
      setRecords(recordsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(
        [-23.55052, -46.633308], // Default SP
        10,
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
    }
  }, []);

  // Filter and Update Markers
  useEffect(() => {
    if (mapRef.current && markersRef.current) {
      markersRef.current.clearLayers();
      const bounds = L.latLngBounds([]);

      // Filter logic
      const filteredRecords = records.filter((r) => {
        // Employee Filter
        if (selectedEmployee && r.employee?.id !== Number(selectedEmployee)) {
          return false;
        }

        // Date Filter
        if (selectedDate) {
          const recordDate = new Date(r.timestamp).toISOString().split("T")[0];
          if (recordDate !== selectedDate) return false;
        }

        // Type Filter
        if (selectedType && r.type !== selectedType) {
          return false;
        }

        return true;
      });

      filteredRecords.forEach((record) => {
        if (!record.location) return;
        const [lat, lng] = record.location.split(",").map(Number);
        if (isNaN(lat) || isNaN(lng)) return;

        const dateStr = new Date(record.timestamp).toLocaleString();

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 14px;">
            <strong style="display:block; font-size: 16px; margin-bottom: 4px;">
              ${record.employee?.name || "Funcionário"}
            </strong>
            <div style="text-align: center; margin-bottom: 5px;">
              <img src="${
                record.photo_url
                  ? `${process.env.REACT_APP_URL?.replace(/\/api$/, "")}/${record.photo_url}`
                  : "https://via.placeholder.com/100"
              }" style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%; border: 2px solid #ccc;" />
            </div>
             <span style="color: #555;">${dateStr}</span><br/>
             <span style="
                display: inline-block; 
                margin-top: 4px; 
                padding: 2px 6px; 
                border-radius: 4px; 
                color: white; 
                font-size: 12px;
                background-color: ${
                  record.type === "Entrada" || record.type === "Volta Almoço"
                    ? "#22c55e"
                    : "#ef4444"
                };
             ">
               ${record.type}
             </span>
          </div>
        `;

        const marker = L.marker([lat, lng]).bindPopup(popupContent);
        markersRef.current?.addLayer(marker);
        bounds.extend([lat, lng]);
      });

      // Fit bounds if we have visible markers
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [records, selectedEmployee, selectedDate, selectedType]);

  return (
    <>
      <NavBar className="z-[1001]" />
      {/* Map Container - Absolute Full Screen */}
      <div className="absolute top-0 left-0 w-full h-full z-0">
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      </div>

      {/* Floating Controls */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white p-4 rounded-lg shadow-lg w-11/12 max-w-md">
        <h1 className="text-xl font-bold text-center mb-4">Mapa de Ponto</h1>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por Funcionário
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">Todos</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por Data
          </label>
          <input
            type="date"
            className="w-full p-2 border border-gray-300 rounded"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por Tipo
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Entrada">Entrada</option>
            <option value="Saída Almoço">Saída Almoço</option>
            <option value="Volta Almoço">Volta Almoço</option>
            <option value="Saída">Saída</option>
          </select>
        </div>
      </div>
    </>
  );
};
