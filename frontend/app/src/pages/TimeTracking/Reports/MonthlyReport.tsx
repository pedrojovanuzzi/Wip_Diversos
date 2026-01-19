import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";
import { SignatureModal } from "../../../components/SignatureModal";
import moment from "moment";
import { AiOutlinePrinter, AiOutlineEdit } from "react-icons/ai";
import { NavBar } from "../../../components/navbar/NavBar";

export const MonthlyReport = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [month, setMonth] = useState(moment().format("MM"));
  const [year, setYear] = useState(moment().format("YYYY"));
  const [records, setRecords] = useState<any[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);
  const [signingDate, setSigningDate] = useState<string | null>(null);
  const [dailySignatures, setDailySignatures] = useState<{
    [key: string]: string;
  }>({});
  const [overtimeData, setOvertimeData] = useState<{
    [key: string]: { hours50: any; hours100: any };
  }>({});

  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Ponto_${selectedEmployee}_${month}_${year}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 3mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
        }
        .print-container {
           transform-origin: top center;
           width: 100%;
        }
        input {
          border: none;
          background: transparent;
          text-align: center;
        }
      }
    `,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const url = `${process.env.REACT_APP_URL}/time-tracking/employee`;
      console.log("Fetching employees from:", url);
      const res = await axios.get(url);
      console.log("Employees fetched:", res.data);
      setEmployees(res.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchOvertime = async () => {
    try {
      if (!selectedEmployee) return;
      const res = await axios.get(
        `${process.env.REACT_APP_URL}/time-tracking/overtime/${selectedEmployee}/${month}/${year}`,
      );
      const overtime: any = {};
      const signatures: any = {};

      res.data.forEach((r: any) => {
        const d = moment(r.date.toString().split("T")[0]).format("DD/MM/YYYY");
        overtime[d] = {
          hours50: Number(r.hours50),
          hours100: Number(r.hours100),
        };
        if (r.signature) {
          signatures[d] = r.signature;
        }
      });
      setOvertimeData(overtime);
      setDailySignatures(signatures);
    } catch (error) {
      console.error("Error fetching overtime:", error);
    }
  };

  const fetchRecords = async () => {
    if (!selectedEmployee) {
      alert("Selecione um funcionário!");
      return;
    }
    try {
      const url = `${process.env.REACT_APP_URL}/time-tracking/records/${selectedEmployee}`;
      console.log("Fetching records from:", url);

      const res = await axios.get(url);
      console.log("Records fetched:", res.data);
      setRecords(res.data);
      if (res.data.length === 0) {
        alert("Nenhum registro encontrado para este funcionário.");
      }
      // Also fetch overtime data
      fetchOvertime();
    } catch (error) {
      console.error("Error fetching records:", error);
      alert("Erro ao buscar registros check o console.");
    }
  };

  const handleOvertimeChange = (
    date: string,
    field: "hours50" | "hours100",
    value: string,
  ) => {
    setOvertimeData((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] || { hours50: 0, hours100: 0 }),
        [field]: value,
      },
    }));
  };

  const saveOvertime = async (
    date: string,
    hours50: string,
    hours100: string,
  ) => {
    try {
      // Convert date DD/MM/YYYY to YYYY-MM-DD
      const [d, m, y] = date.split("/");
      const formattedDate = `${y}-${m}-${d}`;

      await axios.post(`${process.env.REACT_APP_URL}/time-tracking/overtime`, {
        employeeId: selectedEmployee,
        date: formattedDate,
        hours50: hours50,
        hours100: hours100,
      });
      console.log("Saved overtime for", date);
    } catch (err) {
      console.error("Error saving overtime", err);
      alert("Erro ao salvar hora extra");
    }
  };

  const handleSaveSignature = async (signatureData: string) => {
    if (signingDate) {
      // Daily Signature
      try {
        const [d, m, y] = signingDate.split("/");
        const formattedDate = `${y}-${m}-${d}`;

        await axios.post(
          `${process.env.REACT_APP_URL}/time-tracking/signature`,
          {
            employeeId: selectedEmployee,
            date: formattedDate,
            signature: signatureData,
          },
        );

        setDailySignatures((prev) => ({
          ...prev,
          [signingDate]: signatureData,
        }));
      } catch (error) {
        console.error("Error saving signature:", error);
        alert("Erro ao salvar assinatura.");
      }
      setSigningDate(null);
    } else {
      // General Report Signature (Bottom)
      setSignature(signatureData);
    }
    setShowSigModal(false);
  };

  const openSigModal = (date: string) => {
    if (!selectedEmployee) {
      alert("Selecione um funcionário primeiro!");
      return;
    }
    setSigningDate(date);
    setShowSigModal(true);
  };

  // Group records by day for the selected month/year
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
        "YYYY-MM-DD",
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

  // Calculate Totals
  // Calculate Totals encoded as H.MM
  const sumTime = (values: number[]) => {
    let totalMinutes = 0;
    values.forEach((val) => {
      const h = Math.floor(val);
      // Avoid floating point errors (e.g. 0.3 * 100 = 29.9999)
      const m = Math.round((val - h) * 100);
      totalMinutes += h * 60 + m;
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours + minutes / 100;
  };

  const total50 = sumTime(
    Object.values(overtimeData).map((curr) => Number(curr.hours50) || 0),
  );
  const total100 = sumTime(
    Object.values(overtimeData).map((curr) => Number(curr.hours100) || 0),
  );

  return (
    <>
      <NavBar></NavBar>
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
                <option value="01">Janeiro</option>
                <option value="02">Fevereiro</option>
                <option value="03">Março</option>
                <option value="04">Abril</option>
                <option value="05">Maio</option>
                <option value="06">Junho</option>
                <option value="07">Julho</option>
                <option value="08">Agosto</option>
                <option value="09">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
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
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Buscar
            </button>
            <button
              onClick={() => handlePrint && handlePrint()}
              disabled={!selectedEmployee}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
            >
              <AiOutlinePrinter /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Report Area */}
        <div
          className="bg-white p-1 shadow-lg mx-auto max-w-4xl print-container"
          ref={componentRef}
        >
          <div className="text-center border-b pb-1">
            <h2 className="text-xs font-bold uppercase">
              Folha de Ponto Mensal / Período: {month}/{year}
            </h2>
          </div>
          <div className="text-center text-xs mb-1 text-gray-600">
            <p>Empresa: WIP TELECOM MULTIMIDIA EIRELI - 20.843.290/0001-42</p>
          </div>

          {employeeData && (
            <div className="mb-2 grid grid-cols-3 gap-1 text-[11px]">
              <div>
                <strong>Nome:</strong> {employeeData.name}
              </div>
              <div>
                <strong>Cargo:</strong> {employeeData.role}
              </div>
              <div>
                <strong>CPF:</strong> {employeeData.cpf}
              </div>
            </div>
          )}

          <table className="w-[90%] mx-auto border-collapse border border-gray-300 text-[10px]">
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
                    new Date(b.timestamp).getTime(),
                );

                const currentOvertime = overtimeData[date] || {
                  hours50: "",
                  hours100: "",
                };

                return (
                  <tr key={date}>
                    <td className="border border-gray-300 p-1 text-center font-medium">
                      {date}
                    </td>
                    <td className="border border-gray-300">
                      <div className="flex flex-wrap gap-1">
                        {dayRecords.length > 0 ? (
                          dayRecords.map((r, idx) => (
                            <span
                              key={idx}
                              className="bg-gray-100  rounded text-[9px] border"
                            >
                              {moment(r.timestamp).format("HH:mm")} - {r.type}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-1.5 text-center">
                      <input
                        readOnly
                        type="number"
                        className="w-full text-center bg-transparent focus:outline-none"
                        value={currentOvertime.hours50}
                        placeholder="-"
                      />
                    </td>
                    <td className="border border-gray-300 p-1.5 text-center">
                      <input
                        readOnly
                        type="number"
                        className="w-full text-center bg-transparent focus:outline-none"
                        value={currentOvertime.hours100}
                        placeholder="-"
                      />
                    </td>
                    <td className="border border-gray-300 p-1.5 text-center">
                      <div className="flex gap-1 justify-center items-center h-full">
                        {dailySignatures[date] ? (
                          <img
                            src={dailySignatures[date]}
                            alt="Assinatura"
                            className="scale-[200%] h-4 w-20 object-contain cursor-pointer"
                            onClick={() => openSigModal(date)}
                          />
                        ) : (
                          <button
                            onClick={() => openSigModal(date)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-3 print:hidden rounded text-[9px] border border-gray-300 no-print"
                          >
                            Assinar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Totals Row */}
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

          <div className="mt-4 flex justify-evenly items-end text-[10px]">
            <div className="text-center w-64">
              <div className="border-t border-black pt-1">
                Assinatura do Empregador
              </div>
            </div>

            <div
              className={`text-center w-64 ${
                !selectedEmployee
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
              onClick={() => {
                if (selectedEmployee) setShowSigModal(true);
                else alert("Selecione um funcionário primeiro!");
              }}
            >
              {signature ? (
                <img
                  src={signature}
                  alt="Assinatura"
                  className="h-10 scale-[200%] mx-auto mb-1"
                />
              ) : (
                <div className="h-10 flex items-center justify-center text-gray-400 text-[9px] italic bg-gray-50 mb-1 border border-dashed hover:bg-gray-100">
                  <AiOutlineEdit className="mr-1" /> Clique para Assinar
                </div>
              )}
              <div className="border-t border-black pt-1 select-none">
                Assinatura do Funcionário
              </div>
            </div>
          </div>
        </div>

        {showSigModal && (
          <SignatureModal
            onSave={handleSaveSignature}
            onClose={() => {
              setShowSigModal(false);
              setSigningDate(null);
            }}
          />
        )}
      </div>
    </>
  );
};
