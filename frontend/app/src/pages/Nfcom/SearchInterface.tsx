import React, { useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { CiSearch } from "react-icons/ci";
import { BiCalendar, BiUser, BiReceipt } from "react-icons/bi";
import Error from "./Components/Error";
import Success from "./Components/Success";
import { useAuth } from "../../context/AuthContext";

interface NFComResult {
  // Dados primários
  id: number;
  fatura_id: number; // ID da fatura (corresponde a 'titulo' na sua interface anterior, mas é um número)

  // Dados da NFCom
  chave: string; // Chave de acesso da NFCom (Substitui 'chaveAcesso')
  nNF: string; // Número da NF (equivale a 'numero' anterior)
  serie: string;
  value: string;

  // Dados do Cliente/Serviço
  cliente_id: number;
  pppoe: string; // Identificador do assinante (equivale a 'pppoe' anterior)

  // Datas e Status
  data_emissao: string; // Data e hora da emissão no formato ISO 8601
  status: "autorizada" | "rejeitada" | "pendente" | string; // Status da NFCom

  // Informações de Consulta e Protocolo
  protocolo: string; // Número do protocolo de autorização (nProt)
  qrcodeLink: string; // Link direto para o QRCode (Substitui o 'valor' anterior, que não está presente)
  xml: string;
}

export default function SearchInterface() {
  const [pppoe, setPppoe] = useState<string>("");
  const [titulo, setTitulo] = useState<string>("");
  const [data, setData] = useState<string>("");
  const [nfcomList, setNfcomList] = useState<NFComResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { user } = useAuth();
  const token = user?.token;

  const createXmlDownloadUrl = (xmlContent: string): string => {
    const blob = new Blob([xmlContent], { type: "text/xml" });
    return URL.createObjectURL(blob);
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const searchParams: any = {};
      if (pppoe.trim()) searchParams.pppoe = pppoe.trim();
      if (titulo.trim()) searchParams.titulo = titulo.trim();
      if (data.trim()) searchParams.data = data.trim();

      console.log(searchParams);

      const resposta = await axios.post(
        `${process.env.REACT_APP_URL}/Nfcom/buscarNFCom`,
        { searchParams },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setNfcomList(resposta.data);
      setSuccess(
        `${resposta.data.length} NFCom(s) encontrada(s) e homologada(s).`
      );
      console.log(resposta.data);
    } catch (erro) {
      console.error("Erro ao buscar NFCom:", erro);
      if (axios.isAxiosError(erro) && erro.response) {
        setError(
          `Erro ao buscar NFCom: ${
            erro.response.data.erro || "Erro desconhecido."
          }`
        );
      } else {
        setError("Erro de rede. Verifique sua conexão e tente novamente.");
      }
      setNfcomList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPppoe("");
    setTitulo("");
    setData("");
    setNfcomList([]);
    setError("");
    setSuccess("");
  };

  return (
    <div>
      <NavBar />

      {/* Header Section */}
      <div className="min-h-full">
        <div className="sm:bg-blue-700 bg-blue-900 pb-32">
          <header className="py-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Buscar NFCom Geradas
              </h1>
              <p className="mt-2 text-sm text-blue-100">
                Busque notas fiscais NFCom já geradas e homologadas
              </p>
            </div>
          </header>
        </div>

        {/* Search Form */}
        <main className="-mt-32">
          <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <CiSearch className="text-gray-600 text-2xl mr-2" />
                <h2 className="text-xl font-semibold text-gray-800">
                  Busca Avançada
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Campo PPPOE */}
                <div className="relative">
                  <label
                    htmlFor="pppoe"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    PPPOE (Login)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiUser />
                    </span>
                    <input
                      id="pppoe"
                      type="text"
                      value={pppoe}
                      onChange={(e) => setPppoe(e.target.value)}
                      placeholder="Ex: cliente@pppoe"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Campo Número do Título */}
                <div className="relative">
                  <label
                    htmlFor="titulo"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Número do Título
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiReceipt />
                    </span>
                    <input
                      id="titulo"
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: 12345"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Campo Data */}
                <div className="relative">
                  <label
                    htmlFor="data"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Data Específica
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <BiCalendar />
                    </span>
                    <input
                      id="data"
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClear}
                  className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all font-medium"
                >
                  Limpar
                </button>
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all font-medium flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <CiSearch className="text-xl" />
                  {loading ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && <Error message={error} />}
          {success && <Success message={success} />}

          {/* Results Table */}
          {nfcomList.length > 0 && (
            <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
              <h2 className="text-center mt-4 mb-4 text-2xl font-semibold text-gray-900">
                Resultados: {nfcomList.length} NFCom(s)
              </h2>
              <div className="overflow-auto rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Número
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Série
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PPPOE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Emissão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chave
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nota Fiscal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download XML
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nfcomList.map((nfcom) => (
                      <tr key={nfcom.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {nfcom.nNF}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-500">
                          {nfcom.serie}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {nfcom.cliente_id}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-500">
                          {nfcom.pppoe}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-500">
                          {nfcom.data_emissao}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {nfcom.chave}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          <a
                            href={nfcom.qrcodeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Ver Nota Fiscal
                          </a>
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {nfcom.value}
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap text-sm text-gray-900">
                          {/* A tag <a> com 'download' é usada para baixar o arquivo */}
                          <a
                            // 1. O 'href' usa a função auxiliar para gerar a URL temporária do Blob
                            href={createXmlDownloadUrl(nfcom.xml)}
                            // 2. O atributo 'download' força o salvamento e define o nome do arquivo sugerido
                            download={`nfcom_${nfcom.nNF}_${nfcom.serie}.xml`}
                            // Estilização
                            className="text-indigo-600 hover:text-indigo-900 font-medium underline"
                            // Boa prática: Liberar o recurso após o download ser iniciado (embora o navegador geralmente gerencie isso)
                            onClick={(e) => {
                              // Obter a URL gerada (por motivos de performance e segurança,
                              // a URL deve ser revogada, idealmente após o download)
                              // Por ser um Blob URL de criação instantânea, é seguro usá-lo diretamente no href.
                            }}
                          >
                            Baixar XML ({nfcom.nNF})
                          </a>
                        </td>
                        <td className="px-6 py-4 text-left whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              nfcom.status === "Autorizada"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {nfcom.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && nfcomList.length === 0 && !error && (
            <p className="text-center mt-10 text-gray-500">
              Use os filtros acima para buscar NFCom geradas e homologadas
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
