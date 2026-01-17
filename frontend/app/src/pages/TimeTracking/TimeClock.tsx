import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { NavBar } from "../../components/navbar/NavBar";

export const TimeClock = () => {
  const webcamRef = useRef<Webcam>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const [mode, setMode] = useState<"clock" | "overtime">("clock");
  const [overtimeDate, setOvertimeDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [overtime50, setOvertime50] = useState("");
  const [overtime100, setOvertime100] = useState("");

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    return imageSrc;
  }, [webcamRef]);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
          setMessage("Erro ao obter localização. Permita o acesso.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      setMessage("Geolocalização não suportada neste navegador.");
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/time-tracking/employee`
      );
      setEmployees(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  React.useEffect(() => {
    getLocation();
    fetchEmployees();
  }, []);

  const handleClockIn = async (type: string) => {
    if (!employeeId) {
      setMessage("Por favor, selecione o Nome do funcionário.");
      return;
    }
    if (!location) {
      setMessage("Aguardando localização...");
      getLocation(); // Retry
      return;
    }

    const photo = capture();
    if (!photo) {
      setMessage("Erro ao capturar foto. Verifique a câmera.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await axios.post(`${process.env.REACT_APP_URL}/time-tracking/clock-in`, {
        employeeId,
        lat: location.lat,
        lng: location.lng,
        photo,
        type,
      });
      setMessage(`Ponto registrado com sucesso: ${type}!`);
      setEmployeeId(""); // Clear input
    } catch (error) {
      console.error(error);
      setMessage("Erro ao registrar ponto. Verifique o ID.");
    } finally {
      setLoading(false);
    }
  };

  const parseTimeInput = (input: string) => {
    if (!input) return 0;
    if (input.includes(":")) {
      const [h, m] = input.split(":").map(Number);
      return (h || 0) + (m || 0) / 100;
    }
    // Fallback if users enter minutes as number (e.g. 90 -> 1.30)
    const val = parseFloat(input);
    if (!isNaN(val)) {
      return Math.floor(val / 60) + (val % 60) / 100;
    }
    return 0;
  };

  const handleOvertime = async () => {
    if (!employeeId) {
      setMessage("Por favor, selecione o Nome do funcionário.");
      return;
    }
    if (!overtimeDate) {
      setMessage("Selecione a data.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Convert HH:MM input to H.MM format
      const h50 = parseTimeInput(overtime50);
      const h100 = parseTimeInput(overtime100);

      await axios.post(`${process.env.REACT_APP_URL}/time-tracking/overtime`, {
        employeeId,
        date: overtimeDate,
        hours50: h50.toFixed(2),
        hours100: h100.toFixed(2),
      });
      setMessage("Horas extras registradas com sucesso!");
      setOvertime50("");
      setOvertime100("");
    } catch (error) {
      console.error(error);
      setMessage("Erro ao registrar horas extras.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar></NavBar>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Bater Ponto</h1>

        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md flex flex-col items-center">
          <div className="mb-4 w-full h-64 bg-gray-200 rounded overflow-hidden relative">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full h-full object-cover"
              videoConstraints={{ facingMode: "user" }}
            />
          </div>

          {location ? (
            <p className="text-xs text-green-600 mb-4">📍 Localização obtida</p>
          ) : (
            <p className="text-xs text-red-500 mb-4">
              ⚠️ Obtendo localização...
            </p>
          )}

          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione seu nome</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>

          <div className="flex space-x-2 mb-4 w-full">
            <button
              onClick={() => setMode("clock")}
              className={`flex-1 py-2 rounded ${
                mode === "clock"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Ponto
            </button>
            <button
              onClick={() => setMode("overtime")}
              className={`flex-1 py-2 rounded ${
                mode === "overtime"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Hora Extra
            </button>
          </div>

          {mode === "clock" ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => handleClockIn("Entrada")}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Entrada
              </button>
              <button
                onClick={() => handleClockIn("Saída Almoço")}
                disabled={loading}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Saída Almoço
              </button>
              <button
                onClick={() => handleClockIn("Volta Almoço")}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Volta Almoço
              </button>
              <button
                onClick={() => handleClockIn("Saída")}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Saída
              </button>
            </div>
          ) : (
            <div className="flex flex-col w-full gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Data
                </label>
                <input
                  type="date"
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    50% (HH:MM)
                  </label>
                  <input
                    type="text"
                    value={overtime50}
                    onChange={(e) => setOvertime50(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Ex: 01:30"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    100% (HH:MM)
                  </label>
                  <input
                    type="text"
                    value={overtime100}
                    onChange={(e) => setOvertime100(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Ex: 00:45"
                  />
                </div>
              </div>
              <button
                onClick={handleOvertime}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-200 w-full"
              >
                Registrar Hora Extra
              </button>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center text-blue-600">
              <AiOutlineLoading3Quarters className="animate-spin mr-2" />
              Processando...
            </div>
          )}

          {message && (
            <p
              className={`mt-4 text-center font-semibold ${
                message.includes("sucesso") ? "text-green-600" : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </>
  );
};
