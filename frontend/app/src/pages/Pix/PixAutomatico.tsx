import React, { useEffect, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { CiFilter, CiSettings } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import {
  FiltrosPix,
  ParametrosPixAutomaticoList,
  PixAuto,
  PixAutomaticoListOnePeople,
  PixAutomaticoListPeople,
} from "../../types";

export const PixAutomatico = () => {
  const [remover, setRemover] = useState(false);
  const [qr, setQrCode] = useState("");
  const navigate = useNavigate();
  const [cobrancas, setCobrancas] = useState<any>();
  const [people, setPeople] = useState<
    PixAutomaticoListPeople | PixAutomaticoListOnePeople
  >();
  const [status, setStatus] = useState<"CANCELADA">("CANCELADA");
  const [filtrosActive, setFiltrosActive] = useState(false);
  // Cria um estado "date" com valor inicial calculado dinamicamente
  const [date, setDate] = useState(() => {
    // 🔹 Pega a data atual
    const hoje = new Date();

    // 🔹 Avança para o próximo mês
    hoje.setMonth(hoje.getMonth() + 1);

    // 🔹 Define o dia como o primeiro (01)
    hoje.setDate(1);

    // 🔹 Formata no padrão brasileiro "DD/MM/AAAA"
    return hoje.toLocaleDateString("pt-BR");
  });

  useEffect(() => {
    setPixAutoData((prev) => ({ ...prev, data_inicial: date }));
  }, [date]);

  const [pixAutoData, setPixAutoData] = useState<PixAuto>({
    contrato: "",
    cpf: "",
    nome: "",
    servico: "",
    data_inicial: date,
    periodicidade: "MENSAL",
    valor: "",
    politica: "NAO_PERMITE",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [idRec, setIdRec] = useState("");
  const token = user?.token;
  const permission = user?.permission;
  const [filtros, setFiltros] = useState<FiltrosPix>({});

  async function criarPixAutomatico(e: React.FormEvent) {
    try {
      console.log(pixAutoData);

      e.preventDefault();
      setError("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarPixAutomatico`,
        { pixAutoData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
      setQrCode(response.data.dadosQR.pixCopiaECola);
    } catch (error: any) {
      const msg = extractErrorMessage(error.response.data);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function gerarCobranca(e: React.FormEvent) {
    try {
      setQrCode("");
      console.log(pixAutoData);
      e.preventDefault();
      setError("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/criarCobrancaPixAutomatico`,
        { pixAutoData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
    } catch (error: any) {
      const msg = extractErrorMessage(error.response.data);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  //    async function pagarCobrancaTest(e: React.FormEvent) {
  //     try {
  //       console.log(pixAutoData);

  //       e.preventDefault();
  //       setError("");
  //       setLoading(true);
  //       const response = await axios.post(
  //         `${process.env.REACT_APP_URL}/Pix/simularPagamento`,
  //         {
  //   "cobsr": [
  //     {
  //       "idRec": "RN0908935620251021580c6680ae7",
  //       "txid": "3136957d93134f2184b369e8f1c0729d",
  //       "status": "ATIVA",
  //       "atualizacao": [
  //         {
  //           "status": "ATIVA",
  //           "data": "2024-08-20T12:34:21.300Z"
  //         }
  //       ],
  //       "tentativas": [
  //         {
  //           "dataLiquidacao": "2024-20-08",
  //           "tipo": "AGND",
  //           "status": "SOLICITADA",
  //           "endToEndId": "E12345678202406201221abcdef12345"
  //         }
  //       ]
  //     }
  //   ]
  // },
  //         { headers: { Authorization: `Bearer ${token}` } }
  //       );
  //       console.log(response.data);
  //     } catch (error: any) {
  //       const msg = extractErrorMessage(error.response.data);
  //       setError(msg);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }

  async function getClientesPixAutomatico() {
    try {
      setLoading(true);
      setError("");
      if (!filtrosActive) {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoClients`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(response.data);
        setPeople(response.data);
        
      } else if (filtrosActive && filtros.idRec) {
        const client = await axios.post(
          `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoOneClient`,
          { filtros },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log(client.data.response);
        setPeople(client.data?.response ?? null);
       
        setQrCode(client.data.response.dadosQR.pixCopiaECola);
        setCobrancas(client.data.response2.cobsr);
      } else if (filtrosActive && !filtros.idRec) {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/Pix/getPixAutomaticoClients`,
          { filtros },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log(response.data);
        setPeople(response.data.response);
        
        setQrCode(response.data.response.dadosQR.pixCopiaECola);
        setCobrancas(response.data.response2.cobsr);
      }
    } catch (error: any) {
      // Se existir resposta HTTP, extrai a mensagem normalmente
      if (error.response && error.response.data) {
        const msg = extractErrorMessage(error.response.data);
        setError(msg);
      } else {
        // Caso contrário, trata como erro genérico ou de rede
        console.error("Erro inesperado:", error);
        setError(
          "Erro de conexão com o servidor. Verifique sua rede ou tente novamente."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function atualizarPixAutomatico(e: React.FormEvent) {
    try {
      e.preventDefault();
      setError("");
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Pix/atualizarPixAutomaticoClients`,
        { idRec, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(response.data);
    } catch (error: any) {
      const msg = extractErrorMessage(error.response.data);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function navegarCancelar() {
    navigate("/Pix/Cancelar/Cobranca");
  }

  // 🔧 Função que converte qualquer tipo de erro em string segura
  function stringifySafe(x: any): string {
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  }

  // 🔧 Função que captura qualquer tipo de erro (string, objeto, AxiosError, etc.)
  function extractErrorMessage(err: any): string {
    if (err && err.response) {
      const d = err.response.data;
      if (typeof d === "string") return d;
      if (d == null) return `HTTP ${err.response.status || ""}`;
      return stringifySafe(d);
    }
    if (err && err.request) {
      return "Falha de rede ou servidor indisponível.";
    }
    if (err instanceof Error && err.message) return err.message;
    return stringifySafe(err);
  }

  return (
    <div className="lg:p-5 bg-slate-800 min-h-screen text-gray-200">
      <NavBar />

      <div className="bg-gray-100 text-gray-900 relative p-10 rounded-md flex flex-col gap-4 items-center">
        {permission! >= 5 && (
          <CiSettings
            onClick={() => {
              navigate("/Pix/automaticoAdmin");
            }}
            className="text-6xl sm:text-4xl sm:absolute sm:right-10 cursor-pointer"
          />
        )}

        <h1 className="text-2xl font-bold">Pix Automático</h1>
        <p className="text-gray-700">
          Gerencie e adicione clientes ao Pix Automático
        </p>

        {/* Toggle estilizado */}
        <label className="group relative inline-flex w-11 shrink-0 cursor-pointer rounded-full bg-gray-200 p-0.5 outline-offset-2 outline-indigo-600 ring-1 ring-inset ring-gray-900/5 transition-colors duration-200 ease-in-out has-[:checked]:bg-indigo-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
          <span className="relative size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-[:checked]:translate-x-5">
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-100 transition-opacity duration-200 ease-in group-has-[:checked]:opacity-0 group-has-[:checked]:duration-100 group-has-[:checked]:ease-out"
            >
              {/* Ícone X (desativado) */}
              <svg
                fill="none"
                viewBox="0 0 12 12"
                className="size-3 text-red-400"
              >
                <path
                  d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-0 flex size-full items-center justify-center opacity-0 transition-opacity duration-100 ease-out group-has-[:checked]:opacity-100 group-has-[:checked]:duration-200 group-has-[:checked]:ease-in"
            >
              {/* Ícone ✓ (ativado) */}
              <svg
                fill="currentColor"
                viewBox="0 0 12 12"
                className="size-3 text-indigo-600"
              >
                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
              </svg>
            </span>
          </span>
          <input
            name="setting"
            type="checkbox"
            onChange={() => setRemover((prev) => !prev)}
            checked={!remover}
            aria-label="Use setting"
            className="absolute inset-0 appearance-none focus:outline-none"
          />
        </label>

        {/* Texto dinâmico */}
        <div className="mt-3 text-lg font-semibold">
          {remover ? (
            <>
              <span className="text-red-600">Desativar Cliente</span>
              <form className="flex flex-col" onSubmit={atualizarPixAutomatico}>
                <input
                  className="my-2 ring-1 rounded-sm p-2"
                  type="text"
                  placeholder="IdRec"
                  onChange={(e) => setIdRec(e.target.value)}
                />
                <select
                  className="my-2 ring-1 rounded-sm p-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "CANCELADA")}
                >
                  <option value="CANCELADA">CANCELADA</option>
                </select>

                <button className="rounded-md ring-1 p-2 bg-slate-800 text-white w-full sm:w-60">
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <span className="text-green-600">Adicionar cliente</span>
          )}
        </div>
        {!remover && (
          <>
            <div>
              <form
                onSubmit={criarPixAutomatico}
                className="flex flex-col gap-3"
              >
                <div className="[&>*:nth-child(odd)]:bg-gray-100 flex flex-col gap-3">
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Contrato"
                    value={pixAutoData.contrato}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        contrato: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="CPF"
                    value={pixAutoData.cpf}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        cpf: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="PPPOE"
                    value={pixAutoData.nome}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        nome: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Serviço"
                    value={pixAutoData.servico}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        servico: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Data Inicial"
                    onChange={(e) => setDate(e.target.value)}
                    value={date}
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Periodicidade"
                    value={pixAutoData.periodicidade}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        periodicidade: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="Valor"
                    value={pixAutoData.valor}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        valor: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="ring-1 rounded-sm p-2"
                    type="text"
                    placeholder="PoliticaRetentativa"
                    value={pixAutoData.politica}
                    onChange={(e) =>
                      setPixAutoData((prev) => ({
                        ...prev,
                        politica: e.target.value,
                      }))
                    }
                  />
                </div>

                <button className="rounded-md ring-1 p-2 bg-slate-800 text-white w-full sm:w-60">
                  Enviar
                </button>
              </form>
            </div>
          </>
        )}
        {remover && <></>}
        {loading && <p>Carregando ....</p>}
        {error && <p className="text-red-500">{error}</p>}
        <div>
          <h1 className="text-xl my-2">Cancelar Cobrança</h1>
          <button
            className="rounded-md ring-1 my-2 p-2 bg-cyan-600 text-white w-full sm:w-60"
            onClick={navegarCancelar}
          >
            Cancelar
          </button>
          <h1 className="text-xl my-2">Buscar Clientes Já Cadastrados</h1>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2 items-center">
              <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 outline-offset-2 outline-indigo-600 ring-1 ring-inset ring-gray-900/5 transition-colors duration-200 ease-in-out has-[:checked]:bg-indigo-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
                <span className="size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-[:checked]:translate-x-5" />
                <input
                  name="setting"
                  type="checkbox"
                  onChange={() => setFiltrosActive((prev) => !prev)}
                  aria-label="Use setting"
                  className="absolute inset-0 appearance-none focus:outline-none"
                />
              </div>
              <h1>Filtros</h1> <CiFilter />
            </div>
            {filtrosActive && (
              <>
                <div className="flex items-center">
                  <p>Filtros</p>
                </div>
                <label htmlFor="Status">Status</label>
                <select
                  className="ring-1 rounded-sm p-2 w-32"
                  value={filtros.status}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      status: e.target.value as
                        | "CRIADA"
                        | "CANCELADA"
                        | "APROVADA"
                        | "TODOS",
                    }))
                  }
                >
                  <option value="CRIADA">ATIVO</option>
                  <option value="CANCELADA">CANCELADO</option>
                  <option value="APROVADA">APROVADA</option>
                  <option value="TODOS">TODOS</option>
                </select>
                {/* <label htmlFor="Status">Periodicidade</label>
                <select
                  className="ring-1 rounded-sm p-2 w-32"
                  value={filtros.periodicidade}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      periodicidade: e.target.value as
                        | "SEMANAL"
                        | "MENSAL"
                        | "ANUAL"
                        | "TODOS",
                    }))
                  }
                >
                  <option value="SEMANAL">Semanal</option>
                  <option value="MENSAL">Mensal</option>
                  <option value="ANUAL">Anual</option>
                  <option value="ANUAL">Todos</option>
                </select> */}
                <h1>IdRec</h1>
                <input
                  onChange={(e) => {
                    setFiltros((prev) => ({ ...prev, idRec: e.target.value }));
                  }}
                  className="ring-1 rounded-sm p-2 w-32"
                  placeholder="RN09089356202510176a86b02579f"
                  type="text"
                />
              </>
            )}
            <button
              className="rounded-md ring-1 p-2 bg-cyan-800 text-white w-full sm:w-60"
              onClick={getClientesPixAutomatico}
            >
              Buscar
            </button>
            {permission! >= 5 && <>
            <button
              className="rounded-md ring-1 p-2 bg-red-600 text-white w-full sm:w-60"
              onClick={gerarCobranca}
            >
              Gerar Cobrança (Teste)
            </button>
            </>}
            {qr && (
              <div className="flex gap-5 flex-col my-2 justify-center">
                <QRCodeCanvas
                  className="self-center"
                  value={qr} // texto Pix Copia e Cola
                  size={256} // tamanho do QR
                />
                <p>Pix Copia e Cola: </p>
                <p
                  className="cursor-pointer break-all text-blue-600 hover:underline select-text"
                  onClick={() => navigator.clipboard.writeText(qr)}
                >
                  {qr}
                </p>
              </div>
            )}
            {/* <button
              className="rounded-md ring-1 p-2 bg-cyan-600 text-white w-full sm:w-60"
              onClick={pagarCobrancaTest}
            >
              Teste de Pagamento
            </button> */}
          </div>
          {people && (
            <div className="flex flex-col  justify-center mt-6">
              <div className="self-center flex justify-center w-full sm:w-11/12 md:w-3/4 lg:w-2/3">
                <div className="w-3/4 sm:w-full scrollbar-track-transparent  scrollbar-thumb-blue-400 scrollbar-corner-blue-400 scrollbar overflow-scroll  sm:overflow-auto">
                  {/* CASO SEJA UMA LISTA */}
                  {Array.isArray((people as PixAutomaticoListPeople)?.recs) &&
                  (people as PixAutomaticoListPeople).recs.length > 0 ? (
                    <div className="p-2 flex flex-col justify-center w-[40vw] sm:w-full sm:p-0">
                      <table className="min-w-full border-separate border-spacing-0 text-left my-4 bg-white rounded-md shadow-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              IdRec
                            </th>
                            <th className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              Contrato
                            </th>
                            <th className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              Devedor
                            </th>
                            <th className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              Valor
                            </th>
                            <th className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              Periodicidade
                            </th>
                            <th className="py-3 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              Status
                            </th>
                            <th className="py-3 px-4"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(people as PixAutomaticoListPeople).recs.map(
                            (person) => (
                              <tr
                                key={person.idRec}
                                className="hover:bg-gray-50"
                              >
                                <td className="py-3 px-4 text-sm text-gray-900">
                                  {person.idRec}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-900">
                                  {person.vinculo.contrato}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {person.vinculo.devedor?.nome}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  R${" "}
                                  {parseFloat(person.valor.valorRec).toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                  {person.calendario.periodicidade}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      person.status === "CRIADA"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : person.status === "APROVADA"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-gray-700"
                                    }`}
                                  >
                                    {person.status}
                                  </span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // CASO SEJA UM ÚNICO REGISTRO
                    (people as PixAutomaticoListOnePeople)?.idRec && (
  <div className="p-2 flex flex-col justify-center w-[70vw] sm:min-w-full sm:p-0 overflow-auto">
    <table className="text-left bg-white rounded-md shadow-sm border">
      <tbody>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">ID Recorrência</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).idRec}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Contrato</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).vinculo?.contrato ?? "-"}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Nome do Devedor</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).vinculo?.devedor?.nome ?? "-"}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">CPF</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).vinculo?.devedor?.cpf ?? "-"}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Valor Recorrente</th>
          <td className="py-2 px-4">R$ {Number((people as PixAutomaticoListOnePeople).valor?.valorRec ?? 0).toFixed(2)}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Periodicidade</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).calendario?.periodicidade ?? "-"}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Data Inicial</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).calendario?.dataInicial ?? "-"}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Política de Retentativa</th>
          <td className="py-2 px-4">{(people as PixAutomaticoListOnePeople).politicaRetentativa ?? "-"}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Status</th>
          <td className="py-2 px-4">
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                (people as PixAutomaticoListOnePeople).status === "CRIADA"
                  ? "bg-yellow-100 text-yellow-800"
                  : (people as PixAutomaticoListOnePeople).status === "APROVADA"
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-gray-700"
              }`}
            >
              {(people as PixAutomaticoListOnePeople).status ?? "-"}
            </span>
          </td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Recebedor</th>
          <td className="py-2 px-4">
            {(people as PixAutomaticoListOnePeople).recebedor?.nome ?? "-"} ({(people as PixAutomaticoListOnePeople).recebedor?.cnpj ?? "-"})
          </td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Atualização Recorrencia</th>
          <td className="py-2 px-4">
            {(people as PixAutomaticoListOnePeople).atualizacao?.map((f, idx) => (
              <div key={idx} className="flex gap-2">
                <p className="text-blue-500">{f?.data ?? "-"}</p>
                <p className="text-green-600">{f?.status ?? "-"}</p>
              </div>
            )) ?? null}
          </td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Cobranças</th>
          <td className="py-2 px-4">{(cobrancas ?? []).length}</td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Atualização Cobranças</th>
          <td className="py-2 px-4">
            {(cobrancas ?? []).map((c: any, i: number) => (
              <div key={i}>
                {(c?.atualizacao ?? []).map((f: any, j: number) => (
                  <div key={j} className="flex gap-2">
                    <p>Cobrança {i + 1}</p>
                    <p>{f?.status ?? "-"}</p>
                    <p>{f?.data ?? "-"}</p>
                  </div>
                ))}
              </div>
            ))}
          </td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">TxId Cobranças</th>
          <td className="py-2 px-4">
            {(cobrancas ?? []).map((c: any, i: number) => (
              <div key={i}>
                <p>Cobrança {i + 1} {c?.txid ?? "-"}</p>
              </div>
            ))}
          </td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Datas de Vencimento</th>
          <td className="py-2 px-4">
            {(cobrancas ?? []).map((c: any, i: number) => (
              <div key={i}>
                <p>Cobrança {i + 1} {c?.calendario?.dataDeVencimento ?? "-"}</p>
              </div>
            ))}
          </td>
        </tr>
        <tr className="border-b">
          <th className="py-2 px-4 text-gray-700">Tentativas</th>
          <td className="py-2 px-4">
            {(cobrancas ?? []).map((c: any, i: number) => (
              <div key={i}>
                {(c?.tentativas ?? []).map((t: any, j: number) =>
                  (t?.atualizacao ?? []).map((a: any, k: number) => (
                    <div key={`${i}-${j}-${k}`} className="my-2">
                      <p>Cobrança {i + 1}</p>
                      <p>{a?.status ?? "-"}</p>
                      <p>{a?.data ?? "-"}</p>
                    </div>
                  ))
                )}
              </div>
            ))}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
)

                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
