import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import Stacked from "./Components/Stacked";
import Filter from "./Components/Filter";
import { useNavigate } from "react-router-dom";

import { BsFiletypeDoc } from "react-icons/bs";
import { CiSearch } from "react-icons/ci";
import PopUpButton from "./Components/PopUpButton";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

const CAMPO =
  "mt-1 block w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const ROTULO = "text-xs font-medium text-gray-600";

/** Formata em real, para os totais e a coluna de valor. */
const moeda = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function Nfcom() {
  const [dadosNFe, setDadosNFe] = useState({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ambiente, setAmbiente] = useState("homologacao");

  // Estados para controlar envio do certificado e senha
  const [showCertPasswordPopUp, setShowCertPasswordPopUp] = useState(false);
  const [certPassword, setCertPassword] = useState<string>("");
  const [lastNfcomId, setLastNfcomId] = useState<string>("");
  const [searchCpf, setSearchCpf] = useState<string>("");
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reducao, setReducao] = useState("");
  const [isReducaoActive, setIsReducaoActive] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState<number[]>(
    [],
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
    SVA: string[];
    servicos: string[];
  }>({
    plano: [],
    vencimento: [],
    cli_ativado: [],
    nova_nfe: [],
    SVA: [],
    servicos: [],
  });

  const [showPopUp, setShowPopUp] = useState(false);
  const [password, setPassword] = useState<string>(""); // senha para emitir nf
  // Somas derivadas da lista. Antes o total era acumulado DURANTE a
  // renderização, mutando o estado dentro de uma <td> escondida.
  const valorTotal = useMemo(
    () => clientes.reduce((s, c) => s + Number(c.fatura?.valor || 0), 0),
    [clientes],
  );
  const valorSelecionado = useMemo(
    () =>
      clientes
        .filter((c) => clientesSelecionados.includes(c.fatura?.titulo))
        .reduce((s, c) => s + Number(c.fatura?.valor || 0), 0),
    [clientes, clientesSelecionados],
  );
  const { user } = useAuth();
  const token = user?.token;
  const permissions = user?.permission;
  const navigate = useNavigate();
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

  const emitirNFCom = async () => {
    try {
      setLoading(true);

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/emitirNFCom`,
        {
          password,
          clientesSelecionados,
          reducao: isReducaoActive ? reducao : "0.0",
          ambiente,
          lastNfcomId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 3600000,
        },
      );

      console.log("Resposta da API:", resposta.data);
      addJob(resposta.data.job, "emissao");
      showSuccess(
        "Solicitação de emissão enviada! Processando em segundo plano.",
      );
    } catch (erro) {
      console.error("Erro ao emitir NFCom:", erro);
      showError("Erro desconhecido ao emitir NFCom. " + erro);
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

      // NFCom, NFSE e NFE leem o MESMO arquivo (files/certificado.pfx), então o
      // upload é único. A rota /Nfe/upload nunca existiu — dava 404 e o
      // certificado jamais era gravado.
      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/nfse/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );
      console.log("Certificado enviado:", resposta.data);
      showSuccess("Certificado enviado com sucesso!");
      setShowCertPasswordPopUp(false);
      setCertPassword("");
    } catch (erro: any) {
      console.error("Erro ao enviar o certificado:", erro);
      // O backend valida o PFX com a senha e diz o que deu errado.
      showError(
        erro?.response?.data?.erro || "Não foi possível enviar o certificado.",
      );
      setShowCertPasswordPopUp(false);
    }
  };

  const handleSearch = async () => {
    const searchCpfRegex = searchCpf.replace(/\D/g, "");
    try {
      if (activeFilters.SVA[0] === "SVA") {
        setIsReducaoActive(true);
      } else {
        setIsReducaoActive(false);
      }

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
        },
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
          "Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde.",
        );
      } else if (axios.isAxiosError(erro) && erro.response) {
        showError(`Erro: ${erro.response.data.error || "Algo deu errado."}`);
      } else {
        showError("Erro de rede. Verifique sua conexão e tente novamente.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <h1 className="text-2xl font-bold text-gray-800">
          NFCom — Nota Fiscal de Telecomunicações
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Busque as mensalidades, selecione os títulos e emita as notas.
        </p>
      </div>
      <Stacked setSearchCpf={setSearchCpf} onSearch={handleSearch} />
      <div className="mx-auto flex max-w-6xl flex-wrap gap-3 px-4 pb-6">
        <button
          onClick={() => navigate("/Nfcom/Buscar")}
          className="bg-blue-600 text-white py-5 sm:py-4 px-6 rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md flex items-center gap-2"
        >
          <CiSearch className="text-xl" />
          Buscar NFCom Geradas e Homologadas
        </button>
        <button
          onClick={() => navigate("/Nfcom/DeclaracaoQuitacao")}
          className="bg-emerald-600 text-white py-5 sm:py-4 px-6 rounded-lg hover:bg-emerald-700 transition-all font-medium shadow-md flex items-center gap-2"
        >
          <BsFiletypeDoc className="text-xl" />
          Declaração de Quitação de Débitos
        </button>
      </div>
      <Filter
        setActiveFilters={setActiveFilters}
        setDate={setDateFilter}
        setArquivo={setArquivo}
        enviarCertificado={handleEnviarCertificado}
      />
      <div className="mx-auto max-w-6xl px-4">
        {loading && <p className="mb-2 text-sm text-gray-500">Carregando…</p>}

        {clientes.length === 0 ? (
          <p className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-md">
            Nenhum cliente encontrado. Use a busca ou os filtros acima.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="font-bold text-gray-800">
                  {clientes.length} título(s) encontrado(s)
                </h2>
                <p className="text-xs text-gray-500">
                  {clientesSelecionados.length} selecionado(s) · clique na linha
                  para marcar
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs text-gray-500">Total listado</p>
                  <p className="font-semibold text-gray-800">
                    {moeda(valorTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Selecionado</p>
                  <p className="font-semibold text-green-600">
                    {moeda(valorSelecionado)}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[45vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-10 px-3 py-2">
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
                    <th className="px-3 py-2 text-left">Título</th>
                    <th className="px-3 py-2 text-left">Login</th>
                    <th className="px-3 py-2 text-left">Vencimento</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => {
                    const marcado = clientesSelecionados.includes(
                      cliente.fatura.titulo,
                    );
                    return (
                      <tr
                        key={cliente.id}
                        onClick={() =>
                          handleCheckboxChange(cliente.fatura.titulo)
                        }
                        className={`cursor-pointer border-t border-gray-100 ${
                          marcado ? "bg-indigo-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            className="cursor-pointer"
                            type="checkbox"
                            checked={marcado}
                            onChange={() =>
                              handleCheckboxChange(cliente.fatura.titulo)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2">{cliente.fatura.titulo}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {cliente.login}
                        </td>
                        <td className="px-3 py-2">{cliente.fatura.datavenc}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {cliente.fatura.tipo}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {moeda(Number(cliente.fatura.valor))}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              cliente.cli_ativado === "s"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {cliente.cli_ativado === "s" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 mt-4">
        <div className="rounded-lg bg-white p-4 shadow-md">
          <h2 className="font-bold text-gray-800">Parâmetros da emissão</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={ROTULO}>Ambiente</label>
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value)}
                className={CAMPO}
              >
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
              {ambiente === "producao" && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Produção: as notas valem de verdade.
                </p>
              )}
            </div>

            <div>
              <label className={ROTULO}>
                Redução de base
                {!isReducaoActive && (
                  <span className="ml-1 font-normal text-gray-400">
                    (desativada para este filtro)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={reducao}
                onChange={(e) => {
                  setReducao(
                    e.target.value
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-zA-Z0-9,.]/g, ""),
                  );
                }}
                placeholder={
                  isReducaoActive ? "Ex: 40%" : "Redução Desativada: 1.0"
                }
                className={`${CAMPO} ${
                  !isReducaoActive ? "cursor-not-allowed bg-gray-100" : ""
                }`}
                disabled={!isReducaoActive}
              />
            </div>

            {permissions! >= 5 && (
              <div>
                <label className={ROTULO}>Último NFCom ID</label>
                <input
                  type="text"
                  value={lastNfcomId}
                  onChange={(e) => setLastNfcomId(e.target.value)}
                  placeholder="Somente administradores"
                  className={CAMPO}
                />
              </div>
            )}
          </div>

          {isReducaoActive &&
            (() => {
              const exemplo = 89.9;
              const reducaoNum = Number(
                reducao.replace(",", ".").replace("%", ""),
              );
              const fracao = Number.isFinite(reducaoNum) ? reducaoNum / 100 : 0;
              const valorFinal = exemplo * (1 - fracao);
              return (
                <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-gray-700">
                  Numa nota de <strong>R$ 89,90</strong>, com redução de{" "}
                  <strong>
                    {(fracao * 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                    %
                  </strong>
                  , sai por{" "}
                  <strong className="text-green-600">{moeda(valorFinal)}</strong>
                  .
                </div>
              );
            })()}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:bg-gray-400"
              onClick={() => setShowPopUp(true)}
              disabled={clientesSelecionados.length === 0}
            >
              <BsFiletypeDoc className="text-xl" />
              Emitir NFCom
              {clientesSelecionados.length > 0 &&
                ` (${clientesSelecionados.length})`}
            </button>
            {clientesSelecionados.length === 0 && (
              <span className="text-sm text-gray-500">
                Selecione ao menos um título na lista.
              </span>
            )}
          </div>
        </div>
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
