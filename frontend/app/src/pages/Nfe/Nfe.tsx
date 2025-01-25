import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";
import { CiCirclePlus } from "react-icons/ci";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";
import { BsFiletypeDoc } from "react-icons/bs";
import { IoArrowUpCircleOutline } from "react-icons/io5";
import PopUpButton from "./Components/PopUpButton";
import { PiPrinter } from "react-icons/pi";
import Error from "./Components/Error";
import Success from "./Components/Success";


export const Nfe = () => {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [aliquota, setAliquota] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
  }>({
    plano: [],
    vencimento: [],
    cli_ativado: [],
    nova_nfe: [],
  });
  const [showPopUp, setShowPopUp] = useState(false);
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
      const titulosValidos = clientes
        .filter((cliente) => cliente.fatura && cliente.fatura.titulo)
        .map((cliente) => cliente.fatura.titulo);
  
      setClientesSelecionados(titulosValidos);
    }
  };
  
  

  const emitirNFe = async () => {
    try {

      setError(''); // Limpa qualquer mensagem de erro anterior
      setSuccess('');

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfe/`,
        { password, clientesSelecionados, aliquota },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );


      setDadosNFe(resposta.data);
      setSuccess("NF-e emitida com sucesso.");     
      

    } catch (erro) {
      console.error("Erro ao emitir NF-e:", erro);
      // Verifica se a resposta do erro está disponível
    if (axios.isAxiosError(erro) && erro.response && erro.response.data && erro.response.data.erro) {
      setError(`Erro ao emitir NF-e: ${erro.response.data.erro}`);
    } else {
      setError("Erro desconhecido ao emitir NF-e.");
    }
    }
      finally {
        setShowPopUp(false);
      }
  };

  const enviarCertificado = async () => {
    if (!arquivo) {
      alert("Selecione um arquivo para enviar.");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
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
    } catch (erro) {
      console.error("Erro ao enviar o certificado:", erro);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");

    console.log("Buscando por:", searchCpfRegex, activeFilters);

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

      setError(''); // Limpa qualquer mensagem de erro anterior
      console.log("Clientes encontrados:", resposta.data);
      setClientes(resposta.data); // Armazena os clientes no estado
    } catch (erro) {
      console.error("Erro ao Buscar Clientes:", erro);
      if (axios.isAxiosError(erro) && erro.response && erro.response.status === 500) {
        setError('Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde.');
      } else if (axios.isAxiosError(erro) && erro.response) {
        // Outros erros baseados no status HTTP
        setError(`Erro: ${erro.response.data.error || 'Algo deu errado.'}`);
      } else {
        // Erros de rede ou outros tipos de erros
        setError('Erro de rede. Verifique sua conexão e tente novamente.');
      }
    }
  };

  return (
    <div>
      <NavBar />
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      <Filter setActiveFilters={setActiveFilters} setDate={setDateFilter} setArquivo={setArquivo} enviarCertificado={enviarCertificado}/>
      {error && <Error message={error}/>}
      {success && <Success message={success}/>}
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
                    Titulo
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
                    Tipo
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
                        checked={clientesSelecionados.includes(cliente.fatura.titulo)}
                        onChange={() => handleCheckboxChange(cliente.fatura.titulo)}
                      />
                    </td>
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

      <main className="flex justify-center mt-20">
      </main>
      <div className="relative">
        <span className="absolute translate-x-8 top-11 text-gray-200 -translate-y-1/2 text-4xl">
          <BsFiletypeDoc className="cursor-pointer" onClick={() => setShowPopUp(true)} />
        </span>
        <button
          className="bg-slate-500 ring-1 ring-black ring-opacity-5 text-gray-200 py-3 px-16 m-5 rounded hover:bg-slate-400 transition-all"
          onClick={() => setShowPopUp(true)}
        >
          Emitir NF-e
        </button>
        <input type="text" onChange={((e) => {
          setAliquota(e.target.value);
        })} placeholder="Exemplo 4,4249%" className="ring-2 ring-gray-500 p-2 rounded m-5" />
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
    </div>
  );
};
