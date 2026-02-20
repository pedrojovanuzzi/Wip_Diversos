import React, { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { NavBar } from "../../components/navbar/NavBar";
import { SignatureModal } from "../../components/SignatureModal";
import { CpfVerificationModal } from "../../components/CpfVerificationModal";
import { ErrorModal } from "../../components/ErrorModal";
import moment from "moment";
import { useAuth } from "../../context/AuthContext";

export const TimeClock = () => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Modal States
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    type: string;
    payload?: any;
  } | null>(null);

  const [employees, setEmployees] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [selectedTime, setSelectedTime] = useState(
    moment().format("YYYY-MM-DDTHH:mm:ss"),
  );

  const [signatureDate, setSignatureDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showSigModal, setShowSigModal] = useState(false);

  const [scale, setScale] = useState<"8h" | "12h" | "Integral" | "4h">("8h");
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);

  // Check permission
  const canEditDate = (user?.permission || 0) >= 5;

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    return imageSrc;
  }, [webcamRef]);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Accuracy:", position.coords.accuracy);
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          if (position.coords.accuracy > 100) {
            setMessage(
              `Atenção: A precisão do GPS está baixa (${Math.round(
                position.coords.accuracy,
              )}m). Tente usar o celular.`,
            );
          } else {
            setMessage("");
          }
        },
        (error) => {
          console.error("Error getting location: ", error);
          const msg = "Erro ao obter localização. Permita o acesso.";
          setMessage(msg);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    } else {
      setMessage("Geolocalização não suportada neste navegador.");
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/time-tracking/employee`,
      );
      const sorted = [...res.data].sort((a: any, b: any) => {
        const nameA = a.name ? a.name.trim().toUpperCase() : "";
        const nameB = b.name ? b.name.trim().toUpperCase() : "";
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      setEmployees(sorted);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchDailyRecords = useCallback(async () => {
    if (!employeeId || !selectedTime) return;

    try {
      const datePart = selectedTime.split("T")[0];
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/time-tracking/records/date/${employeeId}?date=${datePart}`,
      );
      setDailyRecords(res.data);
    } catch (error) {
      console.error("Error fetching daily records:", error);
    }
  }, [employeeId, selectedTime]);

  useEffect(() => {
    getLocation();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedTime) {
      const datePart = selectedTime.split("T")[0];
      setSignatureDate(datePart);

      const isSaturday = moment(selectedTime).day() === 6;
      if (isSaturday && scale === "8h") {
        setScale("4h");
      } else if (!isSaturday && scale === "4h") {
        setScale("8h");
      }
    }
    fetchDailyRecords();
  }, [selectedTime, employeeId, fetchDailyRecords, scale]);

  const isTypeRegistered = (type: string) => {
    return dailyRecords.some((record) => record.type === type);
  };

  const initiateClockIn = (type: string) => {
    if (!employeeId) {
      setErrorMessage("Por favor, selecione o Nome do funcionário.");
      setShowErrorModal(true);
      return;
    }

    if (isTypeRegistered(type)) {
      setErrorMessage(`O registro de "${type}" já foi realizado hoje.`);
      setShowErrorModal(true);
      return;
    }

    if (!location) {
      setErrorMessage(
        "Aguardando localização... Tente novamente em instantes.",
      );
      setShowErrorModal(true);
      getLocation();
      return;
    }

    setPendingAction({ type });
    setShowCpfModal(true);
  };

  const handleConfirmCpf = async (cpf: string) => {
    if (!pendingAction) return;

    const { type } = pendingAction;

    if (type !== "signature") {
      if (!location) {
        setErrorMessage("Localização perdida. Tente novamente.");
        setShowErrorModal(true);
        setShowCpfModal(false);
        return;
      }
    }

    setLoading(true);
    setMessage("");

    try {
      if (type === "signature") {
        const { date, signature } = pendingAction.payload;
        await axios.post(
          `${process.env.REACT_APP_URL}/time-tracking/signature`,
          {
            employeeId,
            date,
            signature,
            cpf,
          },
        );
        setMessage("Assinatura salva com sucesso!");
        setShowSigModal(false);
      } else {
        // Clock In
        const photo = capture();
        if (!photo) {
          throw new Error("Erro ao capturar foto.");
        }
        await axios.post(
          `${process.env.REACT_APP_URL}/time-tracking/clock-in`,
          {
            employeeId,
            lat: location?.lat,
            lng: location?.lng,
            photo,
            type,
            timestamp: selectedTime,
            cpf,
            scale, // Pass the selected scale
          },
        );
        setMessage(`Ponto registrado com sucesso: ${type}!`);
        setEmployeeId("");
        fetchDailyRecords();
      }

      setShowCpfModal(false);
    } catch (error: any) {
      console.error(error);
      const errorMsg =
        error.response?.data?.error ||
        error.message ||
        "Erro ao realizar operação.";
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (signatureData: string) => {
    if (!employeeId) {
      setErrorMessage("Selecione um funcionário primeiro!");
      setShowErrorModal(true);
      return;
    }
    if (!signatureDate) {
      setErrorMessage("Selecione uma data!");
      setShowErrorModal(true);
      return;
    }

    const [y, m, d] = signatureDate.split("-");
    const formattedDate = `${y}-${m}-${d}`;

    setPendingAction({
      type: "signature",
      payload: {
        date: formattedDate,
        signature: signatureData,
      },
    });
    setShowCpfModal(true);
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

          {/* Scale Selector */}
          <div className="flex space-x-2 mb-4 w-full bg-gray-200 p-1 rounded">
            {moment(selectedTime).day() === 6 ? (
              <button
                onClick={() => setScale("4h")}
                className={`flex-1 py-2 rounded text-sm font-bold transition-all ${
                  scale === "4h"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Escala 4h
              </button>
            ) : (
              <button
                onClick={() => setScale("8h")}
                className={`flex-1 py-2 rounded text-sm font-bold transition-all ${
                  scale === "8h"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Escala 8h
              </button>
            )}
            <button
              onClick={() => setScale("12h")}
              className={`flex-1 py-2 rounded text-sm font-bold transition-all ${
                scale === "12h"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Escala 12h
            </button>
            <button
              onClick={() => setScale("Integral")}
              className={`flex-1 py-2 rounded text-sm font-bold transition-all ${
                scale === "Integral"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Integral
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="col-span-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Data e Hora
              </label>
              <input
                type="datetime-local"
                step="1"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className={`w-full p-2 border border-gray-300 rounded ${!canEditDate ? "bg-gray-200 cursor-not-allowed" : ""}`}
                disabled={!canEditDate}
              />
            </div>
            <button
              onClick={() => initiateClockIn("Entrada")}
              disabled={loading || isTypeRegistered("Entrada")}
              className={`${isTypeRegistered("Entrada") ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"} text-white font-bold py-2 px-4 rounded transition duration-200`}
            >
              Entrada
            </button>
            <button
              onClick={() => initiateClockIn("Saída Almoço")}
              disabled={loading || isTypeRegistered("Saída Almoço")}
              className={`${isTypeRegistered("Saída Almoço") ? "bg-gray-400 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600"} text-white font-bold py-2 px-4 rounded transition duration-200`}
            >
              Saída Almoço
            </button>
            <button
              onClick={() => initiateClockIn("Volta Almoço")}
              disabled={loading || isTypeRegistered("Volta Almoço")}
              className={`${isTypeRegistered("Volta Almoço") ? "bg-gray-400 cursor-not-allowed" : "bg-yellow-600 hover:bg-yellow-700"} text-white font-bold py-2 px-4 rounded transition duration-200`}
            >
              Volta Almoço
            </button>
            <button
              onClick={() => initiateClockIn("Saída")}
              disabled={loading || isTypeRegistered("Saída")}
              className={`${isTypeRegistered("Saída") ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"} text-white font-bold py-2 px-4 rounded transition duration-200`}
            >
              Saída
            </button>

            {/* Signature Section */}
            <div className="col-span-2 mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => {
                    if (!employeeId) {
                      setErrorMessage("Selecione um funcionário primeiro.");
                      setShowErrorModal(true);
                      return;
                    }
                    setShowSigModal(true);
                  }}
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition duration-200 flex items-center justify-center gap-2"
                >
                  <span>✍️</span> Assinar Dia
                </button>
              </div>
            </div>
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

      {showSigModal && (
        <SignatureModal
          onClose={() => setShowSigModal(false)}
          onSave={handleSaveSignature}
        />
      )}

      <CpfVerificationModal
        isOpen={showCpfModal}
        onClose={() => setShowCpfModal(false)}
        onConfirm={handleConfirmCpf}
        loading={loading}
      />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
      />
    </>
  );
};
