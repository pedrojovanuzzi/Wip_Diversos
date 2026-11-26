"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import moment from "moment";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import NavBar from "@/components/NavBar";
import { CpfVerificationModal } from "@/components/CpfVerificationModal";
import { ErrorModal } from "@/components/ErrorModal";
import { agoraLocal } from "@/lib/hora";
import type { User } from "@/lib/auth";

// Câmera e assinatura mexem no navegador ao carregar: só no cliente.
const Webcam = dynamic<any>(() => import("react-webcam"), { ssr: false });
const SignatureModal = dynamic(
  () => import("@/components/SignatureModal").then((m) => m.SignatureModal),
  { ssr: false },
);

export interface Funcionario {
  id: number;
  name: string;
}

type Escala = "8h" | "12h" | "Integral" | "4h";

/**
 * Origem: frontend/app/src/pages/TimeTracking/TimeClock.tsx
 * A lista de funcionários e a hora inicial chegam do page.tsx (servidor).
 */
export default function ClockInClient({
  user,
  funcionarios,
  agoraInicial,
}: {
  user: User | null;
  funcionarios: Funcionario[];
  agoraInicial: string;
}) {
  const webcamRef = useRef<any>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Modais
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: string } | null>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Começa com a hora que o servidor mandou: assim o primeiro desenho é igual
  // no servidor e no navegador. Depois o relógio anda pelo setInterval.
  const [selectedTime, setSelectedTime] = useState(agoraInicial);
  const [signatureDate, setSignatureDate] = useState(agoraInicial.slice(0, 10));
  const [showSigModal, setShowSigModal] = useState(false);
  // CPF validado na batida, reaproveitado para salvar a assinatura do dia
  const [verifiedCpf, setVerifiedCpf] = useState("");

  const [scale, setScale] = useState<Escala>("8h");
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);

  const permission = user?.permission || 0;
  const canEditDate = permission >= 5;

  const capture = useCallback(() => webcamRef.current?.getScreenshot(), []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocalização não suportada neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
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
        setMessage("Erro ao obter localização. Permita o acesso.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
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

  // GPS só existe no navegador
  useEffect(() => {
    getLocation();
  }, []);

  // Relógio: quem não pode editar a data vê a hora andando
  useEffect(() => {
    if (canEditDate) return;
    const interval = setInterval(() => setSelectedTime(agoraLocal()), 1000);
    return () => clearInterval(interval);
  }, [canEditDate]);

  useEffect(() => {
    if (selectedTime) {
      setSignatureDate(selectedTime.split("T")[0]);
      const isSaturday = moment(selectedTime).day() === 6;
      if (isSaturday && scale === "8h") setScale("4h");
      else if (!isSaturday && scale === "4h") setScale("8h");
    }
    fetchDailyRecords();
  }, [selectedTime, employeeId, fetchDailyRecords, scale]);

  const isTypeRegistered = (type: string) => dailyRecords.some((r) => r.type === type);

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
      setErrorMessage("Aguardando localização... Tente novamente em instantes.");
      setShowErrorModal(true);
      getLocation();
      return;
    }
    // Operador com permissão >= 5 dispensa o CPF (autentica pelo token).
    if (permission >= 5) {
      doClockIn(type, "");
      return;
    }
    setPendingAction({ type });
    setShowCpfModal(true);
  };

  const handleConfirmCpf = async (cpf: string) => {
    if (!pendingAction) return;
    await doClockIn(pendingAction.type, cpf);
  };

  const doClockIn = async (type: string, cpf: string) => {
    if (!location) {
      setErrorMessage("Localização perdida. Tente novamente.");
      setShowErrorModal(true);
      setShowCpfModal(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const photo = capture();
      if (!photo) throw new Error("Erro ao capturar foto.");

      // É a primeira batida do dia? (avaliado antes de atualizar os registros)
      const isFirstPunchOfDay = dailyRecords.length === 0;

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
          scale,
        },
        // Envia o token para o backend reconhecer operador permissão >= 5.
        user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : undefined,
      );
      setMessage(`Ponto registrado com sucesso: ${type}!`);
      fetchDailyRecords();
      setShowCpfModal(false);

      if (isFirstPunchOfDay && cpf) {
        // Na primeira batida do dia, abre a assinatura da folha automaticamente,
        // reaproveitando o CPF já validado. Sem CPF (nível 5), não abre.
        setVerifiedCpf(cpf);
        setShowSigModal(true);
      } else {
        setEmployeeId("");
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(
        error.response?.data?.error || error.message || "Erro ao realizar operação.",
      );
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

    setLoading(true);
    setMessage("");

    try {
      await axios.post(`${process.env.REACT_APP_URL}/time-tracking/signature`, {
        employeeId,
        date: signatureDate,
        signature: signatureData,
        cpf: verifiedCpf,
      });
      setMessage("Assinatura salva com sucesso!");
      setShowSigModal(false);
      setEmployeeId("");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(
        error.response?.data?.error || error.message || "Erro ao salvar a assinatura.",
      );
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const ehSabado = moment(selectedTime).day() === 6;
  const botaoEscala = (ativo: boolean, cor: string) =>
    `flex-1 py-2 rounded text-sm font-bold transition-all ${
      ativo ? `bg-white ${cor} shadow-sm` : "text-gray-500 hover:text-gray-700"
    }`;
  const botaoPonto = (tipo: string, cor: string) =>
    `${isTypeRegistered(tipo) ? "bg-gray-400 cursor-not-allowed" : cor} text-white font-bold py-2 px-4 rounded transition duration-200`;

  return (
    <>
      <NavBar user={user} />
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

          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione seu nome</option>
            {funcionarios.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>

          {/* Escala */}
          <div className="flex space-x-2 mb-4 w-full bg-gray-200 p-1 rounded">
            {ehSabado ? (
              <button onClick={() => setScale("4h")} className={botaoEscala(scale === "4h", "text-blue-600")}>
                5x2
              </button>
            ) : (
              <button onClick={() => setScale("8h")} className={botaoEscala(scale === "8h", "text-blue-600")}>
                5x2
              </button>
            )}
            <button onClick={() => setScale("12h")} className={botaoEscala(scale === "12h", "text-purple-600")}>
              12x36
            </button>
            <button onClick={() => setScale("Integral")} className={botaoEscala(scale === "Integral", "text-green-600")}>
              Integral
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="col-span-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">Data e Hora</label>
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
              className={botaoPonto("Entrada", "bg-green-600 hover:bg-green-700")}
            >
              Entrada
            </button>
            <button
              onClick={() => initiateClockIn("Saída Almoço")}
              disabled={loading || isTypeRegistered("Saída Almoço")}
              className={botaoPonto("Saída Almoço", "bg-yellow-500 hover:bg-yellow-600")}
            >
              Saída Almoço
            </button>
            <button
              onClick={() => initiateClockIn("Volta Almoço")}
              disabled={loading || isTypeRegistered("Volta Almoço")}
              className={botaoPonto("Volta Almoço", "bg-yellow-600 hover:bg-yellow-700")}
            >
              Volta Almoço
            </button>
            <button
              onClick={() => initiateClockIn("Saída")}
              disabled={loading || isTypeRegistered("Saída")}
              className={botaoPonto("Saída", "bg-red-600 hover:bg-red-700")}
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

      {showSigModal && (
        <SignatureModal onClose={() => setShowSigModal(false)} onSave={handleSaveSignature} />
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
}
