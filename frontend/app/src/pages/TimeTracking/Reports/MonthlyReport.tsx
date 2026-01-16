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

  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/time-tracking/employee`
      );
      setEmployees(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRecords = async () => {
    if (!selectedEmployee) return;
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/time-tracking/records/${selectedEmployee}`
      );
      setRecords(res.data);
    } catch (error) {
      console.error(error);
    }
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
          className="bg-white p-10 shadow-lg mx-auto max-w-4xl"
          ref={componentRef}
        >
          <div className="text-center mb-8 border-b-2 pb-4">
            <h2 className="text-2xl font-bold uppercase">Folha de Ponto</h2>
            <p className="text-gray-600">
              Período: {month}/{year}
            </p>
          </div>

          {employeeData && (
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <strong>Nome:</strong> {employeeData.name}
              </div>
              <div>
                <strong>Cargo:</strong> {employeeData.role}
              </div>
              <div>
                <strong>CPF:</strong> {employeeData.cpf}
              </div>
              <div>
                <strong>ID:</strong> {employeeData.id}
              </div>
            </div>
          )}

          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2">Data</th>
                <th className="border border-gray-300 p-2">
                  Registros (Horário - Tipo)
                </th>
                <th className="border border-gray-300 p-2">Foto</th>
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

                return (
                  <tr key={date}>
                    <td className="border border-gray-300 p-2 text-center font-medium">
                      {date}
                    </td>
                    <td className="border border-gray-300 p-2">
                      <div className="flex flex-wrap gap-2">
                        {dayRecords.length > 0 ? (
                          dayRecords.map((r, idx) => (
                            <span
                              key={idx}
                              className="bg-gray-100 px-2 py-1 rounded text-xs border"
                            >
                              {moment(r.timestamp).format("HH:mm")} - {r.type}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {dayRecords.map((r, idx) =>
                          r.photo_url ? (
                            <img
                              key={idx}
                              src={`${
                                process.env.REACT_APP_API_URL
                              }/${r.photo_url.replace(/\\/g, "/")}`}
                              alt="ref"
                              className="w-8 h-8 object-cover rounded-full border border-gray-200"
                              title={r.type}
                            />
                          ) : null
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-12 flex justify-between items-end">
            <div className="text-center w-64">
              <div className="border-t border-black pt-2">
                Assinatura do Empregador
              </div>
            </div>

            <div
              className="text-center w-64 cursor-pointer"
              onClick={() => setShowSigModal(true)}
            >
              {signature ? (
                <img
                  src={signature}
                  alt="Assinatura"
                  className="h-16 mx-auto mb-2"
                />
              ) : (
                <div className="h-16 flex items-center justify-center text-gray-400 text-sm italic bg-gray-50 mb-2 border border-dashed hover:bg-gray-100">
                  <AiOutlineEdit className="mr-1" /> Clique para Assinar
                </div>
              )}
              <div className="border-t border-black pt-2 select-none">
                Assinatura do Funcionário
              </div>
            </div>
          </div>

          <div className="text-xs text-center text-gray-400 mt-10">
            Gerado automaticamente por Sistema de Ponto WIP.
          </div>
        </div>

        {showSigModal && (
          <SignatureModal
            onSave={setSignature}
            onClose={() => setShowSigModal(false)}
          />
        )}
      </div>
    </>
  );
};
