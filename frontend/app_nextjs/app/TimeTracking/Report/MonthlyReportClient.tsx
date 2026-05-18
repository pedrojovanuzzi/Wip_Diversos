"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";
import moment from "moment";
import { AiOutlinePrinter } from "react-icons/ai";
import NavBar from "@/components/NavBar";
import { SignatureModal } from "@/components/SignatureModal";
import type { User } from "@/lib/auth";

export default function MonthlyReportClient({ user }: { user: User }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [month, setMonth] = useState(moment().format("MM"));
  const [year, setYear] = useState(moment().format("YYYY"));
  const [records, setRecords] = useState<any[]>([]);
  const [dailySignatures, setDailySignatures] = useState<{
    [key: string]: string;
  }>({});
  const [overtimeData, setOvertimeData] = useState<{
    [key: string]: { hours50: any; hours100: any };
  }>({});
  const [dayStatuses, setDayStatuses] = useState<{ [key: string]: string }>({});
  const [savingStatusDate, setSavingStatusDate] = useState<string | null>(null);
  const [monthlySignature, setMonthlySignature] = useState<string | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);

  const componentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Ponto_${selectedEmployee}_${month}_${year}`,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const url = `${process.env.REACT_APP_URL}/time-tracking/employee`;
      const res = await axios.get(url);
      const sorted = [...res.data].sort((a: any, b: any) => {
        const nameA = a.name ? a.name.trim().toUpperCase() : "";
        const nameB = b.name ? b.name.trim().toUpperCase() : "";
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
      setEmployees(sorted);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchOvertime = async () => {
    try {
      if (!selectedEmployee) return;
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/time-tracking/overtime/${selectedEmployee}/${month}/${year}`
      );
      const overtime: any = {};
      const signatures: any = {};
      const statuses: { [key: string]: string } = {};

      res.data.forEach((r: any) => {
        const d = moment(r.date.toString().split("T")[0]).format("DD/MM/YYYY");
        overtime[d] = {
          hours50: Number(r.hours50),
          hours100: Number(r.hours100),
        };
        if (r.signature) {
          signatures[d] = r.signature;
        }
        if (r.dayStatus) {
          statuses[d] = r.dayStatus;
        }
      });
      setOvertimeData(overtime);
      setDailySignatures(signatures);
      setDayStatuses(statuses);
    } catch (error) {
      console.error("Error fetching overtime:", error);
    }
  };

  const handleSaveSignature = (data: string) => {
    setMonthlySignature(data);
    setShowSigModal(false);
  };

  const saveDayStatus = async (
    dateBr: string,
    status: "FOLGA" | "FALTA" | "ATESTADO" | null,
  ) => {
    if (!selectedEmployee) return;
    const isoDate = moment(dateBr, "DD/MM/YYYY").format("YYYY-MM-DD");
    setSavingStatusDate(dateBr);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/time-tracking/day-status`,
        {
          employeeId: Number(selectedEmployee),
          date: isoDate,
          status,
        },
      );
      setDayStatuses((prev) => {
        const next = { ...prev };
        if (status) next[dateBr] = status;
        else delete next[dateBr];
        return next;
      });
    } catch (error) {
      console.error("Erro ao salvar status do dia:", error);
      alert("Erro ao salvar status do dia.");
    } finally {
      setSavingStatusDate(null);
    }
  };

  const fetchRecords = async () => {
    if (!selectedEmployee) {
      alert("Selecione um funcionário!");
      return;
    }
    try {
      const url = `${process.env.REACT_APP_URL}/time-tracking/records/${selectedEmployee}`;
      const res = await axios.get(url);
      setRecords(res.data);
      if (res.data.length === 0) {
        alert("Nenhum registro encontrado para este funcionário.");
      }
      fetchOvertime();
    } catch (error) {
      console.error("Error fetching records:", error);
      alert("Erro ao buscar registros.");
    }
  };

  const getGroupedRecords = () => {
    const filtered = records.filter((r) => {
      const m = moment(r.timestamp);
      return m.format("MM") === month && m.format("YYYY") === year;
    });

    const grouped: { [key: string]: any[] } = {};
    const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();

    for (let i = 1; i <= daysInMonth; i++) {
      const day = moment(
        `${year}-${month}-${i < 10 ? `0${i}` : i}`,
        "YYYY-MM-DD"
      ).format("DD/MM/YYYY");
      grouped[day] = [];
    }

    filtered.forEach((r) => {
      const day = moment(r.timestamp).format("DD/MM/YYYY");
      if (grouped[day]) {
        grouped[day].push(r);
      }
    });

    return grouped;
  };

  const grouped = getGroupedRecords();
  const employeeData = employees.find((e) => e.id === Number(selectedEmployee));

  const sumTime = (values: number[]) => {
    let totalMinutes = 0;
    values.forEach((val) => {
      const h = Math.floor(val);
      const m = Math.round((val - h) * 100);
      totalMinutes += h * 60 + m;
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours + minutes / 100;
  };

  const total50 = sumTime(
    Object.values(overtimeData).map((curr) => Number(curr.hours50) || 0)
  );
  const total100 = sumTime(
    Object.values(overtimeData).map((curr) => Number(curr.hours100) || 0)
  );

  return (
    <>
      <NavBar user={user}></NavBar>
      <div className="p-8 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 no-print">
          Relatório Mensal
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-lg mb-8 no-print">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Funcionário
              </label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="">Selecione...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mês
              </label>
              <select
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {[
                  "01", "02", "03", "04", "05", "06",
                  "07", "08", "09", "10", "11", "12"
                ].map(m => (
                  <option key={m} value={m}>
                    {moment(m, "MM").format("MMMM")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Ano
              </label>
              <input
                type="number"
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <button
              onClick={fetchRecords}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              Buscar
            </button>
            <button
              onClick={() => handlePrint()}
              disabled={!selectedEmployee}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2 transition disabled:opacity-50"
            >
              <AiOutlinePrinter /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Report Area */}
        <div
          className="bg-white p-4 shadow-lg mx-auto max-w-4xl print-container"
          ref={componentRef}
        >
          <style jsx global>{`
            @page {
              size: A4;
              margin: 2mm;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
              }
              .print-container {
                box-shadow: none !important;
                padding: 0 !important;
                width: 100% !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `}</style>
          
          <div className="text-center border-b pb-1">
            <h2 className="text-sm font-bold uppercase">
              Folha de Ponto Mensal / Período: {month}/{year}
            </h2>
          </div>
          <div className="text-center text-xs mb-1 text-gray-600">
            <p>Empresa: WIP TELECOM MULTIMIDIA EIRELI - 20.843.290/0001-42</p>
          </div>

          {employeeData && (
            <div className="flex justify-evenly text-[11px] mb-2">
              <div>
                <strong>Nome:</strong> {employeeData.name}
              </div>
              <div>
                <strong>CBO:</strong> {employeeData.role}
              </div>
              <div>
                <strong>CPF:</strong> {employeeData.cpf}
              </div>
            </div>
          )}

          <table className="w-full border-collapse border border-gray-300 text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-1">Data</th>
                <th className="border border-gray-300 p-1">
                  Registros (Horário - Tipo)
                </th>
                <th className="border border-gray-300 p-1 w-16">H.E. 50%</th>
                <th className="border border-gray-300 p-1 w-16">H.E. 100%</th>
                <th className="border border-gray-300 p-1">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(grouped).map((date) => {
                const dayRecords = grouped[date];
                dayRecords.sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime()
                );

                const currentOvertime = overtimeData[date] || {
                  hours50: "",
                  hours100: "",
                };

                const isSunday = moment(date, "DD/MM/YYYY").day() === 0;

                return (
                  <tr key={date} className={isSunday ? "bg-gray-200" : ""}>
                    <td className="border border-gray-300 p-1 text-center font-medium">
                      {date}
                    </td>
                    <td className="border border-gray-300 p-1">
                      <div className="flex flex-wrap gap-1 items-center">
                        {dayRecords.length > 0 ? (
                          dayRecords.map((r, idx) => (
                            <span
                              key={idx}
                              className="bg-gray-50 px-1 rounded text-[9px] border border-gray-200"
                            >
                              {moment(r.timestamp).format("HH:mm")} - {r.type}
                            </span>
                          ))
                        ) : dayStatuses[date] ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              dayStatuses[date] === "FOLGA"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : dayStatuses[date] === "FALTA"
                                ? "bg-red-100 text-red-800 border border-red-300"
                                : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                            }`}
                          >
                            {dayStatuses[date]}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {dayRecords.length === 0 && (
                          <div className="flex gap-1 ml-1 no-print">
                            {dayStatuses[date] ? (
                              <button
                                disabled={savingStatusDate === date}
                                onClick={() => saveDayStatus(date, null)}
                                className="text-[9px] px-1.5 py-0.5 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                                title="Remover status"
                              >
                                ×
                              </button>
                            ) : (
                              <>
                                <button
                                  disabled={savingStatusDate === date}
                                  onClick={() => saveDayStatus(date, "FOLGA")}
                                  className="text-[9px] px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded disabled:opacity-50"
                                >
                                  Folga
                                </button>
                                <button
                                  disabled={savingStatusDate === date}
                                  onClick={() => saveDayStatus(date, "FALTA")}
                                  className="text-[9px] px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 rounded disabled:opacity-50"
                                >
                                  Falta
                                </button>
                                <button
                                  disabled={savingStatusDate === date}
                                  onClick={() =>
                                    saveDayStatus(date, "ATESTADO")
                                  }
                                  className="text-[9px] px-1.5 py-0.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded disabled:opacity-50"
                                >
                                  Atestado
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-1 text-center">
                      {currentOvertime.hours50 || "-"}
                    </td>
                    <td className="border border-gray-300 p-1 text-center">
                      {currentOvertime.hours100 || "-"}
                    </td>
                    <td className="border border-gray-300 p-1 text-center">
                      <div className="flex gap-1 justify-center items-center h-4">
                        {dailySignatures[date] && (
                          <img
                            src={dailySignatures[date]}
                            alt="Assinatura"
                            className="h-full scale-[200%] object-contain"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-bold">
                <td
                  className="border border-gray-300 p-1.5 text-right"
                  colSpan={2}
                >
                  TOTAIS
                </td>
                <td className="border border-gray-300 p-1.5 text-center">
                  {total50 > 0 ? total50.toFixed(2).replace(".", ":") : "-"}
                </td>
                <td className="border border-gray-300 p-1.5 text-center">
                  {total100 > 0 ? total100.toFixed(2).replace(".", ":") : "-"}
                </td>
                <td className="border border-gray-300 p-1.5"> </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 flex justify-evenly items-end text-[10px]">
            <div className="text-center w-64">
              <div className="border-t border-black pt-1">
                Assinatura do Empregador
              </div>
            </div>

            <div className="text-center w-64">
              <div className="mb-1 flex flex-col items-center justify-end min-h-[40px]">
                {monthlySignature ? (
                  <div className="relative group">
                    <img
                      src={monthlySignature}
                      alt="Assinatura Funcionário"
                      className="h-8 scale-[200%] object-contain"
                    />
                    <button
                      onClick={() => {
                        if (window.confirm("Deseja refazer a assinatura?")) {
                          setMonthlySignature(null);
                        }
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity no-print"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSigModal(true)}
                    className="bg-gray-100 border border-gray-300 px-4 py-1 rounded hover:bg-gray-200 no-print text-[10px]"
                  >
                    Assinar
                  </button>
                )}
              </div>
              <div className="border-t border-black pt-1">
                Assinatura do Funcionário
              </div>
            </div>
          </div>
        </div>
      </div>
      {showSigModal && (
        <SignatureModal
          onClose={() => setShowSigModal(false)}
          onSave={handleSaveSignature}
        />
      )}
    </>
  );
}
