import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";
import { CiCirclePlus, CiNoWaitingSign } from "react-icons/ci";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";
import { BsFiletypeDoc } from "react-icons/bs";
import { IoArrowUpCircleOutline } from "react-icons/io5";
import PopUpButton from "./Components/PopUpButton";
import { PiPrinter } from "react-icons/pi";
import Stacked2 from "./Components/Stacked2";
import PopUpCancelNFSE from "./Components/PopUpCancelNFSE";
import PDFNFSE from "./Components/PDFNFSE";
import { useReactToPrint } from "react-to-print";
import Success from "./Components/Success";
import Error from "./Components/Error";
import SetPassword from "./Components/SetPassword";

export const BuscarNfeGerada = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [pdfDados, setPdfDados] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const componentRef = React.useRef(null);
  const reactToPrintContent = () => {
    return componentRef.current;
  };

  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>(
    []
  );
  const [dateFilter, setDateFilter] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    plano: string[];
    vencimento: string[];
    cli_ativado: string[];
    nova_nfe: string[];
    servicos: string[];
  }>({
    plano: [],
    vencimento: [],
    cli_ativado: [],
    nova_nfe: [],
    servicos: [],
  });
  const [showCancelPopUp, setShowCancelPopUp] = useState(false);
  const [showPasswordPopUp, setShowPasswordPopUp] = useState(false);
  const [password, setPassword] = useState<string>("");
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const user = useTypedSelector((state: RootState) => state.auth.user);
  const token = user.token;

  const handleCheckboxChange = (clienteId: number) => {
    setClientesSelecionados((prevSelecionados) => {
      if (prevSelecionados.includes(clienteId)) {
        return prevSelecionados.filter((id) => id !== clienteId);
      } else {
        return [...prevSelecionados, clienteId];
      }
    });
  };

  const handleSelectAll = () => {
    if (clientesSelecionados.length === clientes.length) {
      setClientesSelecionados([]);
    } else {
      const numeroRpsValidos = clientes
        .filter((cliente) => cliente.nfse && cliente.nfse.numero_rps)
        .map((cliente) => cliente.nfse.numero_rps);

      setClientesSelecionados(numeroRpsValidos);
    }
  };

  const imprimir = async (reactToPrintContent: any) => {
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/imprimirNFSE`,
        {
          rpsNumber: clientesSelecionados,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Notas Canceladas:", resposta.data);

      const dados = resposta.data;
      setPdfDados(dados);

      setTimeout(() => {
        handlePrint && handlePrint(reactToPrintContent);
      }, 0);

      setClientesSelecionados([]);
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
    }
  };

  const handlePrint = useReactToPrint({
    documentTitle: "NFSE",
  });

  const setSessionPassword = async () => {
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/cancelarNfse`,
        {
          password: password,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setSuccess("Senha atualizada");
      window.location.reload();
    } catch (erro) {
      console.error(erro);
    } finally {
      setShowCancelPopUp(false);
    }
  };

  const cancelNFSE = async () => {
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/cancelarNfse`,
        {
          rpsNumber: clientesSelecionados,
          password: password,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setSuccess("Notas Canceladas com Sucesso!");
      window.location.reload();
      console.log("Notas Canceladas:", resposta.data);
    } catch (erro) {
      setError("Erro ao Cancelar Notas!");
      console.error("Erro ao Buscar Clientes:", erro);
    } finally {
      setShowCancelPopUp(false);
    }
  };

  const handleEnviarCertificado = () => {
    if (!arquivo) {
      alert("Selecione um arquivo para enviar.");
      return;
    }
    setShowCertPasswordPopUp(true);
  };

  const enviarCertificado = async () => {
    if (!arquivo || !certPassword) {
      alert("É necessário arquivo e senha.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("certificado", arquivo);
      formData.append("password", certPassword);

      const resposta = await axios.post(`${process.env.REACT_APP_URL}/Nfe/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Certificado enviado:", resposta.data);
      setSuccess("Certificado enviado com sucesso!");
      setShowCertPasswordPopUp(false);
      setCertPassword("");
    } catch (erro) {
      console.error("Erro ao enviar o certificado:", erro);
      setError("Não foi possível enviar o certificado.");
      setShowCertPasswordPopUp(false);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");

    console.log("Buscando por:", searchCpfRegex, activeFilters);

    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/BuscarNSFE`,
        {
          cpf: searchCpfRegex,
          filters: activeFilters,
          dateFilter: dateFilter,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Clientes encontrados:", resposta.data);
      setClientes(resposta.data); // Armazena os clientes no estado
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div>
      <NavBar />

      <Stacked2 setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      <Filter
        setActiveFilters={setActiveFilters}
        setDate={setDateFilter}
        setArquivo={setArquivo}
        enviarCertificado={handleEnviarCertificado}
        BuscarNfe={false}
      />
      {error && <Error message={error} />}
      {success && <Success message={success} />}
      {clientes.length > 0 && (
        <h1 className="text-center mt-5 self-center text-2xl font-semibold text-gray-900">
          Total de Resultados: {clientes.length}
        </h1>
      )}
      {clientes.length > 0 ? (
        <div className="mt-10 px-4 sm:px-6 lg:px-8">
          <div className="overflow-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y bg-gray-50 divide-gray-300 ">
              <thead className="bg-gray-50 w-full text-center">
                <th className="px-4 py-4">
                  <input
                    className="cursor-pointer"
                    type="checkbox"
                    checked={
                      clientesSelecionados.length > 0 &&
                      clientesSelecionados.length === clientes.length
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  ></th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Nº NFSE
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Login
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Vencimento
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Aliquota
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Valor
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    Status NFSE
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {clientes.filter((cliente) => cliente.nfse.status !== "Cancelada").map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-4 py-4">
                      <input
                        className="cursor-pointer"
                        type="checkbox"
                        checked={clientesSelecionados.includes(
                          cliente.nfse.numero_rps
                        )}
                        onChange={() =>
                          handleCheckboxChange(cliente.nfse.numero_rps)
                        }
                      />
                    </td>
                    <td className="px-6 py-4">{cliente.nfse.numeroNfse}</td>
                    <td className="px-6 py-4">{cliente.login}</td>
                    <td className="px-6 py-4">{cliente.nfse.competencia}</td>
                    <td className="px-6 py-4">{cliente.nfse.aliquota}</td>
                    <td className="px-6 py-4">{cliente.nfse.valor_servico}</td>
                    <td className="px-6 py-4">{cliente.nfse.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-center mt-10 text-gray-500">
          Nenhum cliente encontrado
        </p>
      )}

      <main className="flex justify-center mt-20"></main>
      <div className="relative flex flex-col sm:block">
        <span className="absolute translate-x-8 top-1/4 sm:top-1/2 text-gray-200 -translate-y-1/2 text-4xl">
          <BsFiletypeDoc
            className="cursor-pointer"
            onClick={() => {
              imprimir(reactToPrintContent);
            }}
          />
        </span>
        <button
          className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => {
            imprimir(reactToPrintContent);
          }}
        >
          Imprimir Nota
        </button>
        <span className="absolute translate-x-8 bottom-1/4 sm:top-1/2 sm:bottom-0 text-gray-200 translate-y-1/2 sm:-translate-y-1/2 text-4xl">
          <CiNoWaitingSign
            className="cursor-pointer"
            onClick={() => setShowCancelPopUp(true)}
          />
        </span>
        <button
          className="bg-red-600 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-red-400 transition-all"
          onClick={() => setShowCancelPopUp(true)}
        >
          Cancelar Nota
        </button>
        <button
          className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => setShowPasswordPopUp(true)}
        >
          Senha Certificado
        </button>
      </div>
      {arquivo && (
        <p className="text-sm text-gray-500 m-5">
          Arquivo selecionado:{" "}
          <span className="font-semibold">{arquivo.name}</span>
        </p>
      )}
      {showCancelPopUp && (
        <PopUpCancelNFSE
          setShowPopUp={setShowCancelPopUp}
          showPopUp={showCancelPopUp}
          setPassword={setPassword}
          password={password}
          cancelNFSE={cancelNFSE}
        />
      )}

      {showPasswordPopUp && (
        <SetPassword
          setShowPopUp={setShowPasswordPopUp}
          showPopUp={showPasswordPopUp}
          setPassword={setPassword}
          password={password}
          setSessionPassword={setSessionPassword}
        />
      )}
            {showCertPasswordPopUp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-white p-6 rounded-md shadow-lg">
            <h2 className="text-lg font-semibold">Digite a senha do Certificado:</h2>
            <input
              type="password"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              className="block w-full border p-2 my-4 rounded"
              placeholder="Senha do PFX"
            />
            <div className="flex justify-end mt-4">
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded mr-2"
                onClick={() => {
                  setShowCertPasswordPopUp(false);
                  setCertPassword("");
                }}
              >
                Cancelar
              </button>
              <button className="bg-indigo-500 text-white px-4 py-2 rounded" onClick={enviarCertificado}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <PDFNFSE ref={componentRef} dados={pdfDados} />
      </div>
    </div>
  );
};
