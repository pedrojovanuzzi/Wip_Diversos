import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";

import { BsFiletypeDoc } from "react-icons/bs";
import PopUpButton from "./Components/PopUpButton";
import { useAuth } from "../../context/AuthContext";
import { BuscarNfeGerada } from "./BuscarNfeGerada";
import { Link } from "react-router-dom";
import { useNotification } from "../../context/NotificationContext";

export const Nfe = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);

  // Estados para controlar envio do certificado e senha
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");

  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [aliquota, setAliquota] = useState("");
  const [lastNfe, setLastNfe] = useState<string>("");
  const [service, setService] = useState("");
  const [loading, setLoading] = useState(false);
  const [ambiente, setAmbiente] = useState("homologacao");
  const [reducao, setReducao] = useState("");
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

  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>(""); // senha para emitir nf
  let [valueSome, setValueSome] = useState<number>(0);
  const { user } = useAuth();
  const token = user?.token;
  const { addJob, showError, showSuccess } = useNotification();

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
      const titulosValidos = clientes
        .filter((cliente) => cliente.fatura && cliente.fatura.titulo)
        .map((cliente) => cliente.fatura.titulo);
      setClientesSelecionados(titulosValidos);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const emitirNFe = async () => {
    try {
      setLoading(true);

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/`,
        {
          password,
          clientesSelecionados,
          aliquota,
          service,
          reducao,
          ambiente,
          lastNfe,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 480000,
        }
      );
      setDadosNFe(resposta.data);
      // setSuccess("NF-e emitida com sucesso.");

      console.log("Resposta da API:", resposta.data);
      if (resposta.data.job) {
        addJob(resposta.data.job, "emissao");
        showSuccess(
          "Solicitação de emissão enviada! Processando em segundo plano."
        );
      } else {
        showSuccess("NF-e emitida com sucesso.");
      }
    } catch (erro) {
      console.error("Erro ao emitir NF-e:", erro);
      if (
        axios.isAxiosError(erro) &&
        erro.response &&
        erro.response.data &&
        erro.response.data.erro
      ) {
        // setError(`Erro ao emitir NF-e: ${erro.response.data.erro}`);
        showError(`Erro ao emitir NF-e: ${erro.response.data.erro}`);
      } else {
        // setError("Erro desconhecido ao emitir NF-e.");
        showError("Erro desconhecido ao emitir NF-e.");
      }
    } finally {
      setShowPopUp(false);
      setLoading(false);
    }
  };

  // Função que abre o popup para senha do certificado
  const handleEnviarCertificado = () => {
    if (!arquivo) {
      alert("Selecione um arquivo para enviar.");
      return;
    }
    setShowCertPasswordPopUp(true);
  };

  // Envia o certificado + senha
  const enviarCertificado = async () => {
    if (!arquivo || !certPassword) {
      alert("É necessário arquivo e senha.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("password", certPassword);

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("Certificado enviado:", resposta.data);
      showSuccess("Certificado enviado com sucesso!");
      setShowCertPasswordPopUp(false);
      setCertPassword("");
    } catch (erro) {
      console.error("Erro ao enviar o certificado:", erro);
      showError("Não foi possível enviar o certificado.");
      setShowCertPasswordPopUp(false);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/BuscarClientes`,
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
      setClientes(resposta.data);
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
      if (
        axios.isAxiosError(erro) &&
        erro.response &&
        erro.response.status === 500
      ) {
        showError(
          "Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde."
        );
      } else if (axios.isAxiosError(erro) && erro.response) {
        showError(`Erro: ${erro.response.data.error || "Algo deu errado."}`);
      } else {
        showError("Erro de rede. Verifique sua conexão e tente novamente.");
      }
    }
  };

  const handleOpenPopup = () => {
    if (!lastNfe) {
      alert("Por favor, preencha o campo 'Ultima NF-e'.");
      return;
    }
    setShowPopUp(true);
  };

  return (
    <div>
      <NavBar />
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      <Link
        className="flex justify-center sm:justify-start"
        to="/BuscarNfeGerada"
      >
        <button
          className="bg-violet-700 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => setShowPopUp(true)}
        >
          NF-es Geradas
        </button>
      </Link>
      <Filter
        setActiveFilters={setActiveFilters}
        setDate={setDateFilter}
        setArquivo={setArquivo}
        enviarCertificado={handleEnviarCertificado}
      />
      {clientes.length > 0 && (
        <>
          <h1 className="text-center mt-2 self-center text-2xl font-semibold text-gray-900">
            Total de Resultados: {clientes.length}
          </h1>
          {loading && (
            <>
              <h1 className="text-center mt-2 self-center text-2xl text-gray-500">
                Carregando ...
              </h1>
            </>
          )}
        </>
      )}
      {clientes.length > 0 ? (
        <div className="mt-5 sm:mt-2">
          <div className="flex justify-center">
            <table className="block  overflow-auto sm:rounded-md ring-1 ring-black ring-opacity-30 h-[40vh] divide-y bg-gray-50 ">
              <thead className="bg-gray-50 w-full text-center">
                <tr>
                  <th className="">
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
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900" />
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Titulo
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Login
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-4 py-4">
                      <input
                        className="cursor-pointer"
                        type="checkbox"
                        checked={clientesSelecionados.includes(
                          cliente.fatura.titulo
                        )}
                        onChange={() =>
                          handleCheckboxChange(cliente.fatura.titulo)
                        }
                      />
                    </td>
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4">{cliente.fatura.titulo}</td>
                    <td className="px-6 py-4">{cliente.login}</td>
                    <td className="px-6 py-4">{cliente.fatura.datavenc}</td>
                    <td className="px-6 py-4">{cliente.fatura.tipo}</td>
                    <td className="px-6 py-4">{cliente.fatura.valor}</td>
                    <td className="px-6 py-4">
                      {cliente.cli_ativado === "s" ? "Ativo" : "Inativo"}
                    </td>
                    <td className="px-6 py-4 hidden">
                      {(valueSome += Number(cliente.fatura.valor))}
                    </td>
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

      <main className="flex justify-center mt-2" />
      <h1>
        Valores Somados das mensalidades:{" "}
        <span className="text-green-500">
          R${valueSome.toFixed(2).replace(".", ",")}
        </span>
      </h1>
      <div className="flex flex-col justify-center sm:flex-row">
        <div className="relative">
          <span className="absolute translate-x-8 top-11 text-gray-200 -translate-y-1/2 text-4xl">
            <BsFiletypeDoc
              className="cursor-pointer"
              onClick={handleOpenPopup}
            />
          </span>
          <button
            className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
            onClick={handleOpenPopup}
          >
            Emitir NF-e
          </button>
        </div>
        <select
          onChange={(e) => setAmbiente(e.target.value)}
          className="bg-slate-700 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-600 transition-all"
        >
          <option value="homologacao">Homologação</option>
          <option value="producao">Produção</option>
        </select>
        <input
          type="text"
          onChange={(e) => {
            setAliquota(e.target.value);
          }}
          placeholder="Exemplo 4,4249%"
          className="ring-2 ring-gray-500 p-2 rounded m-5"
        />
      </div>

      <div className="relative">
        <input
          type="text"
          onChange={(e) => {
            setService(
              e.target.value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9 ]/g, "")
            );
          }}
          placeholder="Servico de Manutencao"
          className="ring-2 ring-gray-500 p-2 rounded m-5"
        />
        <input
          type="text"
          onChange={(e) => {
            setReducao(
              e.target.value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9 ]/g, "")
            );
          }}
          placeholder="Redução Ex: 60%"
          className="ring-2 ring-gray-500 p-2 rounded m-5"
        />
        <input
          type="text"
          required
          onChange={(e) => {
            setLastNfe(
              e.target.value.normalize("NFD").replace(/[^a-zA-Z0-9 ]/g, "")
            );
          }}
          placeholder="Ultimo Numero NF-e"
          className="ring-2 ring-red-500 p-2 rounded m-5 placeholder:text-red-500"
        />
      </div>

      {arquivo && (
        <p className="text-sm text-gray-500 m-5">
          Arquivo selecionado:{" "}
          <span className="font-semibold">{arquivo.name}</span>
        </p>
      )}

      {showPopUp && (
        <PopUpButton
          setShowPopUp={setShowPopUp}
          showPopUp={showPopUp}
          setPassword={setPassword}
          password={password}
          emitirNFe={emitirNFe}
        />
      )}

      {/* Popup para senha do certificado */}
      {showCertPasswordPopUp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
          <div className="bg-white p-6 rounded-md shadow-lg">
            <h2 className="text-lg font-semibold">
              Digite a senha do Certificado:
            </h2>
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
              <button
                className="bg-indigo-500 text-white px-4 py-2 rounded"
                onClick={enviarCertificado}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
