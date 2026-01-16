import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

export const TimeClock = () => {
  const webcamRef = useRef<Webcam>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );

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
        }
      );
    } else {
      setMessage("Geolocalização não suportada neste navegador.");
    }
  };

  React.useEffect(() => {
    getLocation();
  }, []);

  const handleClockIn = async (type: string) => {
    if (!employeeId) {
      setMessage("Por favor, informe o ID do funcionário.");
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
      await axios.post(
        `${
          process.env.REACT_APP_API_URL || "http://localhost:3000"
        }/api/time-tracking/clock-in`,
        {
          employeeId,
          lat: location.lat,
          lng: location.lng,
          photo,
          type,
        }
      );
      setMessage(`Ponto registrado com sucesso: ${type}!`);
      setEmployeeId(""); // Clear input
    } catch (error) {
      console.error(error);
      setMessage("Erro ao registrar ponto. Verifique o ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
          <p className="text-xs text-red-500 mb-4">⚠️ Obtendo localização...</p>
        )}

        <input
          type="number"
          placeholder="ID do Funcionário"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

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
  );
};
