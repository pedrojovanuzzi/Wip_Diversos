import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";
import { useNavigate } from "react-router-dom";

import { BsFiletypeDoc } from "react-icons/bs";
import { CiSearch } from "react-icons/ci";
import PopUpButton from "./Components/PopUpButton";
import Error from "./Components/Error";
import Success from "./Components/Success";
import { useAuth } from "../../context/AuthContext";

export default function Nfcom() {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState("homologacao");

  // Estados para controlar envio do certificado e senha
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");

  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [service, setService] = useState("");
  const [loading, setLoading] = useState(false);
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

  const { user } = useAuth();
  const token = user?.token;
  const navigate = useNavigate();

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

  const emitirNFCom = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/emitirNFCom`,
        {
          password,
          clientesSelecionados,
          service,
          reducao,
          ambiente,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 480000,
        }
      );

      console.log("Resposta da API:", resposta.data);

      // Verificar se a resposta contém erros da SEFAZ
      if (Array.isArray(resposta.data) && resposta.data.length > 0) {
        const resultados = resposta.data;
        const erros = resultados.filter((r: any) => r.error === true);
        const sucessos = resultados.filter((r: any) => r.success === true);

        if (erros.length > 0) {
          // Montar mensagem de erro detalhada
          const mensagensErro = erros
            .map((erro: any, index: number) => {
              let msg = `NFCom ${index + 1}:\n`;

              if (erro.cStat) {
                msg += `Código: ${erro.cStat}\n`;
              }

              if (erro.message) {
                // Limpar mensagem removendo prefixos como "Rejeição:"
                const mensagemLimpa = erro.message.replace(
                  /^(Rejeição|Erro):\s*/i,
                  ""
                );
                msg += `${mensagemLimpa}\n`;
              }

              if (erro.id) {
                msg += `ID: ${erro.id}\n`;
              }

              return msg;
            })
            .join("\n");

          if (sucessos.length > 0) {
            // Parcialmente bem-sucedido
            setError(
              `${sucessos.length} NFCom(s) emitida(s) com sucesso, mas ${erros.length} falharam:\n\n${mensagensErro}`
            );
            setSuccess(
              `${sucessos.length} NFCom(s) processada(s) com sucesso!`
            );
          } else {
            // Todos falharam
            setError(`Falha ao emitir NFCom:\n\n${mensagensErro}`);
          }
        } else if (sucessos.length > 0) {
          // Todos bem-sucedidos
          setSuccess(`${sucessos.length} NFCom(s) emitida(s) com sucesso!`);
        } else {
          // Resposta inesperada
          setError("Resposta inesperada do servidor. Verifique os logs.");
        }

        setDadosNFe(resposta.data);
      } else {
        // Formato de resposta antigo ou diferente
        setDadosNFe(resposta.data);
        setSuccess("NFCom emitida com sucesso.");
      }
    } catch (erro) {
      console.error("Erro ao emitir NFCom:", erro);
      if (
        axios.isAxiosError(erro) &&
        erro.response &&
        erro.response.data &&
        erro.response.data.erro
      ) {
        setError(`Erro ao emitir NFCom: ${erro.response.data.erro}`);
      } else if (axios.isAxiosError(erro) && erro.response) {
        setError(`Erro ao emitir NFCom: ${JSON.stringify(erro.response.data)}`);
      } else {
        setError("Erro desconhecido ao emitir NFCom.");
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
    try {
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/buscarClientes`,
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
      setError("");
      console.log("Clientes encontrados:", resposta.data);
      setClientes(resposta.data);
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
      if (
        axios.isAxiosError(erro) &&
        erro.response &&
        erro.response.status === 500
      ) {
        setError(
          "Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde."
        );
      } else if (axios.isAxiosError(erro) && erro.response) {
        setError(`Erro: ${erro.response.data.error || "Algo deu errado."}`);
      } else {
        setError("Erro de rede. Verifique sua conexão e tente novamente.");
      }
    }
  };

  return (
    <div>
      <NavBar />
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      <div className="flex justify-center sm:justify-start sm:ml-2 px-4 pb-6 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/Nfcom/Buscar")}
          className="bg-blue-600 text-white py-5 sm:py-4 px-6 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md flex items-center gap-2"
        >
          <CiSearch className="text-xl" />
          Buscar NFCom Geradas e Homologadas
        </button>
      </div>
      <Filter
        setActiveFilters={setActiveFilters}
        setDate={setDateFilter}
        setArquivo={setArquivo}
        enviarCertificado={handleEnviarCertificado}
      />
      {error && <Error message={error} />}
      {success && <Success message={success} />}
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
                  <th className="px-6 py-3 text-sm font-semibold text-gray-900">
                    Cancelar
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

      <div className="flex flex-col justify-center sm:flex-row">
        <div className="relative">
          <span className="absolute translate-x-8 top-11 text-gray-200 -translate-y-1/2 text-4xl">
            <BsFiletypeDoc
              className="cursor-pointer"
              onClick={() => setShowPopUp(true)}
            />
          </span>
          <button
            className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
            onClick={() => setShowPopUp(true)}
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
          placeholder="Redução Ex: 40%"
          className="ring-2 ring-gray-500 p-2 rounded m-5"
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
          emitirNFe={emitirNFCom}
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
}
