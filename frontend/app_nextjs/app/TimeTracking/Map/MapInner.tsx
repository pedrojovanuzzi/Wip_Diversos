"use client";

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

// Fix Leaflet default icon issue
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
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

export default function MapInner({ user }: { user: User }) {
  const [records, setRecords] = useState<Record[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedType, setSelectedType] = useState<string>("");

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

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

  useEffect(() => {
    fetchData();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(
        [-23.55052, -46.633308], // Default SP
        10
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

      const filteredRecords = records.filter((r) => {
        if (selectedEmployee && r.employee?.id !== Number(selectedEmployee)) {
          return false;
        }
        if (selectedDate) {
          const recordDate = new Date(r.timestamp).toISOString().split("T")[0];
          if (recordDate !== selectedDate) return false;
        }
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
        const photoUrl = record.photo_url || "";
        let imgSrc = "https://via.placeholder.com/100";

        if (photoUrl && user.token) {
          const normalizedPath = photoUrl.replace(/\\/g, "/");
          const filename = normalizedPath.split("/").pop();
          imgSrc = `${process.env.REACT_APP_URL}/time-tracking/image/${filename}?token=${user.token}`;
        }

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 14px;">
            <strong style="display:block; font-size: 16px; margin-bottom: 4px;">
              ${record.employee?.name || "Funcionário"}
            </strong>
            <div style="text-align: center; margin-bottom: 5px;">
              <img src="${imgSrc}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%; border: 2px solid #ccc;" />
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

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [records, selectedEmployee, selectedDate, selectedType, user.token]);

  return (
    <>
      <NavBar user={user} className="z-[1001]" />
      <div className="absolute top-0 left-0 w-full h-full z-0 pt-[64px]">
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      </div>

      <div className="absolute top-[80px] left-1/2 transform -translate-x-1/2 z-[1000] bg-white p-4 rounded-lg shadow-lg w-11/12 max-w-md">
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
}
