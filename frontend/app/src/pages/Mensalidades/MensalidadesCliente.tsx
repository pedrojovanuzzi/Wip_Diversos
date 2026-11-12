import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  FaEnvelope,
  FaFileExcel,
  FaMoneyBillAlt,
  FaPlus,
  FaPrint,
  FaTrashAlt,
} from "react-icons/fa";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { apiMensalidades, Detalhe, mensagemDeErro, Titulo } from "./api";
import {
  dataCurta,
  diasDoVencimento,
  numeroTitulo,
  paginaMk,
  reais,
} from "./mkauthEstilo";
import {
  AlterarTitulo,
  AtrelarTitulo,
  Confirmar,
  EnviarTitulos,
  InfoTitulo,
  NotasTitulo,
  NovoTitulo,
  ReceberTitulo,
} from "./FormulariosTitulo";
import { exportarCsv, imprimirRecibo } from "./impressao";
import { BolixTitulo } from "./BolixTitulo";
import { SeloWipDiversos } from "./SeloWipDiversos";
import { AutomaticoCliente } from "./AutomaticoCliente";
import { cabecalhoGrade, caixinha, Celula } from "./ConfigUi";

type Janela =
  | {
      tipo: "receber" | "alterar" | "atrelar" | "notas" | "boleto";
      titulo: Titulo;
    }
  | { tipo: "info"; id: number }
  | { tipo: "novo" }
  | { tipo: "enviar"; titulos: Titulo[] }
  | { tipo: "estornar"; titulo: Titulo }
  | { tipo: "excluir"; titulos: Titulo[] }
  | { tipo: "removerAtrelado"; titulo: Titulo; atrelado: number; descricao: string };

/** Ações de um título: botões pequenos (no MK-Auth eram links com "|"). */
function Acoes({
  itens,
}: {
  itens: (
    | { rotulo: string; onClick: () => void; destaque?: boolean; principal?: boolean }
    | false
  )[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.filter(Boolean).map((i) => {
        const it = i as {
          rotulo: string;
          onClick: () => void;
          destaque?: boolean;
          principal?: boolean;
        };
        return (
          <button
            key={it.rotulo}
            type="button"
            onClick={it.onClick}
            className={`h-[26px] px-2.5 rounded-full border text-[12px] font-semibold transition-colors ${
              it.principal
                ? "bg-[#3273dc] border-[#3273dc] text-white hover:bg-[#2763c4]"
                : it.destaque
                  ? "bg-[#ebfffc] border-[#9fe8dd] text-[#00947e] hover:border-[#00947e]"
                  : "bg-white border-[#dbdbdb] text-[#4a4a4a] hover:border-[#3273dc] hover:text-[#3273dc]"
            }`}
          >
            {it.rotulo}
          </button>
        );
      })}
    </div>
  );
}

function BotaoBarra({
  titulo,
  rotulo,
  cor,
  onClick,
  children,
}: {
  titulo: string;
  rotulo: string;
  cor: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className="h-[34px] px-3 inline-flex items-center gap-2 rounded-md text-white text-[13px] font-semibold hover:brightness-95"
      style={{ background: cor }}
    >
      {children}
      <span className="hidden sm:inline">{rotulo}</span>
    </button>
  );
}

/** "vence em 5 dias", "vence hoje", "venceu há 3 dias". */
function prazoDe(venc: string | null) {
  if (!venc) return { texto: "", atrasado: false };
  const v = new Date(venc);
  v.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = diasDoVencimento(venc);
  if (v.getTime() < hoje.getTime())
    return { texto: `há ${dias} dia${dias === 1 ? "" : "s"}`, atrasado: true };
  if (dias === 0) return { texto: "hoje", atrasado: false };
  return { texto: `em ${dias} dia${dias === 1 ? "" : "s"}`, atrasado: false };
}

function SeloStatus({ status }: { status: string }) {
  const cor =
    status === "vencido"
      ? "bg-[#feecf0] text-[#cc0f35] border-[#fbcbd6]"
      : status === "pago"
        ? "bg-[#effaf3] text-[#257942] border-[#c8eed6]"
        : "bg-[#eef3fc] text-[#2160c4] border-[#cddcf7]";
  return (
    <span
      className={`inline-block px-2 rounded-full border text-[11px] leading-[20px] font-bold ${cor}`}
    >
      {status}
    </span>
  );
}

const CARTAO =
  "bg-white rounded-lg border border-[#e3e6ea] shadow-[0_1px_2px_rgba(0,0,0,.04)] overflow-hidden";
const GRADE_ABERTOS =
  "md:grid-cols-[28px_minmax(0,.9fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.9fr)]";
const GRADE_PAGOS =
  "md:grid-cols-[minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";

export function MensalidadesCliente() {
  const { login = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const api = useMemo(() => apiMensalidades(user?.token), [user?.token]);

  const [dados, setDados] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [abertosMais, setAbertosMais] = useState<Set<number>>(new Set());
  const [janela, setJanela] = useState<Janela | null>(null);
  const [imprimindo, setImprimindo] = useState(false);

  const carregar = useCallback(() => {
    setErro("");
    return api
      .faturas(login)
      .then((d) => {
        setDados(d);
        // Some da seleção o que já não está em aberto.
        setSelecionados(
          (s) => new Set(d.abertos.map((t) => t.id).filter((id) => s.has(id))),
        );
      })
      .catch((e) => setErro(mensagemDeErro(e, "Erro ao carregar faturas.")));
  }, [api, login]);

  useEffect(() => {
    setDados(null);
    setSelecionados(new Set());
    carregar();
  }, [carregar]);

  const admin = (dados?.nivel ?? 0) >= 5;
  const fechar = useCallback(() => setJanela(null), []);
  const selecionadosLista = (dados?.abertos || []).filter((t) =>
    selecionados.has(t.id),
  );
  const todosMarcados =
    !!dados?.abertos.length && selecionados.size === dados.abertos.length;

  const alternar = (set: Set<number>, id: number) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  };

  const exigirSelecao = (acao: (t: Titulo[]) => void) => () => {
    if (!selecionadosLista.length) {
      showError("Marque os títulos na caixinha ao lado do número.");
      return;
    }
    acao(selecionadosLista);
  };

  // Imprimir: abre a aba já no clique (senão o navegador bloqueia) e põe
  // nela o PDF com os boletos da Efí quando o backend terminar.
  const imprimirBoletos = async (titulos: Titulo[]) => {
    if (imprimindo) return;
    const aba = window.open("", "_blank");
    aba?.document.write(
      `<title>Boletos</title><p style="font-family:sans-serif;padding:24px">Gerando os boletos de ${titulos.length} título(s)...</p>`,
    );
    setImprimindo(true);
    try {
      const { pdf, faltaram } = await api.pdfBoletos(titulos.map((t) => t.id));
      const url = URL.createObjectURL(pdf);
      if (aba) aba.location.href = url;
      else if (!window.open(url, "_blank"))
        showError("O navegador bloqueou a janela de impressão.");
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
      if (faltaram) showError(`Ficaram de fora: ${faltaram}`);
      carregar();
    } catch (e) {
      aba?.close();
      showError(mensagemDeErro(e, "Erro ao gerar o PDF dos boletos."));
    } finally {
      setImprimindo(false);
    }
  };

  const cli = dados?.cliente;

  return (
    <div style={paginaMk}>
      <NavBar />
      <div className="max-w-[1500px] mx-auto px-3 sm:px-6 pt-5 pb-10">
        {/* Cabeçalho do cliente */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#7a7a7a] mb-1">
            <SeloWipDiversos />
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-[#3273dc] font-semibold hover:underline"
            >
              ‹ Clientes
            </button>
            <span>/</span>
            <Link
              to={`/mensalidades/${encodeURIComponent(login)}`}
              className="text-[#3273dc] hover:underline"
            >
              Detalhes
            </Link>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold text-[#363636] leading-tight break-words">
                {cli?.nome || login}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[13px] text-[#7a7a7a]">
                <span className="font-mono">{cli?.login || login}</span>
                {cli?.plano && <span>{cli.plano}</span>}
                {cli?.venc && <span>vence dia {cli.venc}</span>}
                {cli?.bloqueado === "sim" && (
                  <span className="px-2 rounded-full bg-[#feecf0] text-[#cc0f35] border border-[#fbcbd6] text-[11px] leading-[20px] font-bold">
                    bloqueado
                  </span>
                )}
                {cli?.status_corte === "down" && (
                  <span
                    title="Em redução de velocidade (down)"
                    className="px-2 rounded-full bg-[#fff3c4] text-[#8a7000] border border-[#ffe08a] text-[11px] leading-[20px] font-bold"
                  >
                    down
                  </span>
                )}
                {cli?.cli_ativado === "n" && (
                  <span className="px-2 rounded-full bg-[#f5f6f8] text-[#7a7a7a] border border-[#e3e6ea] text-[11px] leading-[20px] font-bold">
                    desativado
                  </span>
                )}
              </div>
            </div>
            {dados?.automatico && (
              <AutomaticoCliente
                api={api}
                login={login}
                isento={dados.cliente.isento === "sim"}
                estado={dados.automatico}
                podeMudar={admin}
                onMudou={(automatico) => setDados({ ...dados, automatico })}
              />
            )}
          </div>
        </div>

        {erro && <p className={`${CARTAO} text-center py-10`}>{erro}</p>}
        {!dados && !erro && (
          <p className={`${CARTAO} text-center py-10 text-[#7a7a7a]`}>Carregando...</p>
        )}

        {dados && (
          <>
            {/* Títulos em aberto */}
            <section className={`${CARTAO} mb-5`}>
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-3 border-b border-[#e3e6ea]">
                <h2 className="font-bold text-[16px] text-[#363636] flex items-center gap-2">
                  <FaMoneyBillAlt className="text-[#3273dc]" /> Títulos do cliente
                </h2>
                {dados.abertos.length > 0 && (
                  <span className="text-[13px] text-[#7a7a7a]">
                    {dados.abertos.length} em aberto ·{" "}
                    <b className="text-[#363636]">{reais(dados.totalAberto)}</b>
                  </span>
                )}
                {/* Barra de ações */}
                <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                  <BotaoBarra
                    titulo="Adicionar titulos"
                    rotulo="Novo título"
                    cor="#48c774"
                    onClick={() => setJanela({ tipo: "novo" })}
                  >
                    <FaPlus />
                  </BotaoBarra>
                  {dados.abertos.length > 0 && (
                    <>
                      <BotaoBarra
                        titulo="Enviar mensagem"
                        rotulo="Enviar"
                        cor="#3273dc"
                        onClick={exigirSelecao((t) =>
                          setJanela({ tipo: "enviar", titulos: t }),
                        )}
                      >
                        <FaEnvelope />
                      </BotaoBarra>
                      <BotaoBarra
                        titulo="Imprimir os boletos (PDF da Efí) dos títulos marcados"
                        rotulo={imprimindo ? "Gerando..." : "Imprimir"}
                        cor="#3e8ed0"
                        onClick={exigirSelecao(imprimirBoletos)}
                      >
                        <FaPrint />
                      </BotaoBarra>
                      <BotaoBarra
                        titulo="Exportar para excel"
                        rotulo="Excel"
                        cor="#00c4a7"
                        onClick={() =>
                          exportarCsv(
                            dados,
                            selecionadosLista.length ? selecionadosLista : dados.abertos,
                          )
                        }
                      >
                        <FaFileExcel />
                      </BotaoBarra>
                      {admin && (
                        <BotaoBarra
                          titulo="Deletar titulos"
                          rotulo="Deletar"
                          cor="#f14668"
                          onClick={exigirSelecao((t) =>
                            setJanela({ tipo: "excluir", titulos: t }),
                          )}
                        >
                          <FaTrashAlt />
                        </BotaoBarra>
                      )}
                    </>
                  )}
                </div>
              </header>

              {dados.abertos.length === 0 ? (
                <p className="text-center py-10 text-[15px] text-[#7a7a7a]">
                  Não existem lançamentos para o cliente
                </p>
              ) : (
                <>
                  <div className={`${cabecalhoGrade} ${GRADE_ABERTOS}`}>
                    <input
                      type="checkbox"
                      className={caixinha}
                      checked={todosMarcados}
                      aria-label="Marcar todos os títulos"
                      onChange={() =>
                        setSelecionados(
                          todosMarcados
                            ? new Set()
                            : new Set(dados.abertos.map((t) => t.id)),
                        )
                      }
                    />
                    <span>Título</span>
                    <span>Tipo</span>
                    <span>Status</span>
                    <span>Vencimento</span>
                    <span>Nosso número</span>
                    <span className="text-right">Valor</span>
                  </div>
                  {/* No celular não há cabeçalho: "marcar todos" fica aqui. */}
                  <label className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-[#eef0f2] text-[13px] font-semibold">
                    <input
                      type="checkbox"
                      className={caixinha}
                      checked={todosMarcados}
                      onChange={() =>
                        setSelecionados(
                          todosMarcados
                            ? new Set()
                            : new Set(dados.abertos.map((t) => t.id)),
                        )
                      }
                    />
                    Marcar todos
                  </label>

                  {dados.abertos.map((t) => {
                    const temItens = t.atrelados.length > 0;
                    const aberto = abertosMais.has(t.id);
                    const vencido = t.status === "vencido";
                    const prazo = prazoDe(t.datavenc);
                    const marcado = selecionados.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className={`border-b border-[#eef0f2] last:border-b-0 border-l-4 ${
                          vencido ? "border-l-[#f14668]" : "border-l-transparent"
                        } ${marcado ? "bg-[#f3f7fe]" : ""}`}
                      >
                        <div
                          className={`grid grid-cols-[28px_minmax(0,1fr)] ${GRADE_ABERTOS} items-start md:items-center gap-x-3 px-3 sm:px-4 pt-2.5 text-[14px] ${
                            // O MK-Auth pinta de vermelho o título vencido.
                            vencido ? "text-[#cc0f35] font-bold" : ""
                          }`}
                        >
                          <div className="pt-0.5 md:pt-0">
                            <input
                              type="checkbox"
                              className={caixinha}
                              checked={marcado}
                              onChange={() => setSelecionados((s) => alternar(s, t.id))}
                              aria-label={`Selecionar título ${numeroTitulo(t.id)}`}
                            />
                          </div>
                          <div className="min-w-0 flex flex-col gap-0.5 md:contents">
                            <Celula rotulo="Título" className="font-mono font-bold">
                              {numeroTitulo(t.id)}
                              {temItens && (
                                <button
                                  type="button"
                                  onClick={() => setAbertosMais((s) => alternar(s, t.id))}
                                  className="ml-2 px-1.5 rounded-full border border-[#dbdbdb] bg-white text-[11px] leading-[18px] font-sans font-semibold text-[#4a4a4a] hover:border-[#3273dc]"
                                  aria-label="Ver lançamentos atrelados"
                                  title="Ver lançamentos atrelados"
                                >
                                  {aberto ? "−" : "+"} {t.atrelados.length}
                                </button>
                              )}
                            </Celula>
                            <Celula rotulo="Tipo">{t.tipo}</Celula>
                            <Celula rotulo="Status">
                              <SeloStatus status={t.status} />
                            </Celula>
                            <Celula rotulo="Vencimento">
                              {dataCurta(t.datavenc)}{" "}
                              <span
                                className={`text-[12px] font-normal ${
                                  prazo.atrasado ? "text-[#cc0f35]" : "text-[#7a7a7a]"
                                }`}
                                title="Dias até o vencimento (ou de atraso)"
                              >
                                · {prazo.texto}
                              </span>
                            </Celula>
                            <Celula rotulo="Nosso nº" className={`truncate text-[#7a7a7a] font-normal ${t.nossonum ? "" : "max-md:hidden"}`}>
                              {t.nossonum}
                            </Celula>
                            <Celula rotulo="Valor" className="md:text-right font-bold">
                              {reais(t.valorTotal)}
                            </Celula>
                          </div>
                        </div>
                        <div className="px-3 sm:px-4 pt-2 pb-2.5 pl-[43px] sm:pl-[47px]">
                          <Acoes
                            itens={[
                              {
                                rotulo: "Boleto",
                                destaque: !!t.bolix,
                                onClick: () => setJanela({ tipo: "boleto", titulo: t }),
                              },
                              {
                                rotulo: "Receber",
                                onClick: () => setJanela({ tipo: "receber", titulo: t }),
                              },
                              {
                                rotulo: "Alterar",
                                onClick: () => setJanela({ tipo: "alterar", titulo: t }),
                              },
                              {
                                rotulo: "Enviar",
                                onClick: () => setJanela({ tipo: "enviar", titulos: [t] }),
                              },
                              {
                                rotulo: "Informações",
                                onClick: () => setJanela({ tipo: "info", id: t.id }),
                              },
                              {
                                rotulo: "Notas",
                                destaque: t.notas > 0,
                                onClick: () => setJanela({ tipo: "notas", titulo: t }),
                              },
                              t.tipo === "mensalidade" && {
                                rotulo: "Atrelar",
                                onClick: () => setJanela({ tipo: "atrelar", titulo: t }),
                              },
                            ]}
                          />
                        </div>
                        {aberto && temItens && (
                          <div className="mx-3 sm:mx-4 mb-3 ml-[43px] sm:ml-[47px] rounded-md border border-[#fbcbd6] overflow-hidden text-[13px]">
                            <div className="grid grid-cols-[minmax(0,1fr)_90px_100px] gap-x-3 px-3 py-1.5 bg-[#feecf0] text-[#cc0f35] text-[11px] font-bold uppercase tracking-wide">
                              <span>Descrição</span>
                              <span>Tipo</span>
                              <span className="text-right">Valor</span>
                            </div>
                            {t.atrelados.map((a) => (
                              <div
                                key={a.id}
                                className="grid grid-cols-[minmax(0,1fr)_90px_100px] gap-x-3 px-3 py-1.5 border-t border-[#fde3e9] items-center"
                              >
                                <span className="min-w-0 break-words">
                                  {admin && (
                                    <button
                                      type="button"
                                      title="Remover lançamento"
                                      aria-label="Remover lançamento"
                                      onClick={() =>
                                        setJanela({
                                          tipo: "removerAtrelado",
                                          titulo: t,
                                          atrelado: a.id,
                                          descricao: a.descricao || a.tipo,
                                        })
                                      }
                                      className="text-[#f14668] mr-2 align-middle hover:text-[#cc0f35]"
                                    >
                                      <FaTrashAlt />
                                    </button>
                                  )}
                                  {a.descricao}
                                </span>
                                <span>{a.tipo}</span>
                                <span className="text-right">{reais(a.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex justify-end items-baseline gap-3 px-3 sm:px-4 py-3 bg-[#fafbfc] border-t border-[#e3e6ea]">
                    <span className="text-[12px] uppercase tracking-wide text-[#7a7a7a]">
                      Total em aberto
                    </span>
                    <span className="text-[18px] font-bold text-[#363636]">
                      {reais(dados.totalAberto)}
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* Pagos */}
            <section className={CARTAO}>
              <header className="flex flex-wrap items-center gap-3 px-3 sm:px-4 py-3 border-b border-[#e3e6ea]">
                <h2 className="font-bold text-[16px] text-[#363636]">Pagos anteriormente</h2>
                {dados.pagos.length > 0 && (
                  <span className="text-[13px] text-[#7a7a7a]">{dados.pagos.length} título(s)</span>
                )}
              </header>
              {dados.pagos.length === 0 ? (
                <p className="text-center py-8 text-[15px] text-[#7a7a7a]">Nenhum título pago.</p>
              ) : (
                <>
                  <div className={`${cabecalhoGrade} ${GRADE_PAGOS}`}>
                    <span>Título</span>
                    <span>Vencimento</span>
                    <span>Coletor</span>
                    <span>Forma</span>
                    <span>Retornos</span>
                    <span>Pagamento</span>
                    <span className="text-right">Valor</span>
                    <span className="text-right">Valor pago</span>
                  </div>
                  {dados.pagos.map((t) => (
                    <div key={t.id} className="border-b border-[#eef0f2] last:border-b-0">
                      <div
                        className={`flex flex-col gap-0.5 md:grid ${GRADE_PAGOS} md:items-center md:gap-x-3 px-3 sm:px-4 pt-2.5 text-[14px]`}
                      >
                        <Celula rotulo="Título" className="font-mono font-bold">
                          {numeroTitulo(t.id)}
                        </Celula>
                        <Celula rotulo="Vencimento">{dataCurta(t.datavenc)}</Celula>
                        <Celula rotulo="Coletor" className={`truncate ${t.coletor ? "" : "max-md:hidden"}`}>
                          {t.coletor}
                        </Celula>
                        <Celula rotulo="Forma">{t.formapag}</Celula>
                        <Celula rotulo="Retornos">
                          {String(t.num_retornos ?? 0).padStart(3, "0")}
                        </Celula>
                        <Celula rotulo="Pagamento">{dataCurta(t.datapag)}</Celula>
                        <Celula rotulo="Valor" className="md:text-right">
                          {reais(t.valorTotal)}
                        </Celula>
                        <Celula rotulo="Valor pago" className="md:text-right font-bold text-[#257942]">
                          {reais(t.valorpag)}
                        </Celula>
                      </div>
                      <div className="px-3 sm:px-4 pt-2 pb-2.5">
                        <Acoes
                          itens={[
                            {
                              rotulo: "Informações",
                              onClick: () => setJanela({ tipo: "info", id: t.id }),
                            },
                            {
                              rotulo: "Recibo",
                              onClick: () => {
                                if (!imprimirRecibo(dados, t))
                                  showError("O navegador bloqueou a janela do recibo.");
                              },
                            },
                            admin && {
                              rotulo: "Estornar",
                              onClick: () => setJanela({ tipo: "estornar", titulo: t }),
                            },
                            {
                              rotulo: "Notas",
                              destaque: t.notas > 0,
                              onClick: () => setJanela({ tipo: "notas", titulo: t }),
                            },
                            {
                              rotulo: "Enviar",
                              onClick: () => setJanela({ tipo: "enviar", titulos: [t] }),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {/* Janelas das ações */}
      {janela && dados && (() => {
        const comuns = { api, onFechar: fechar, onFeito: carregar };
        switch (janela.tipo) {
          case "receber":
            return <ReceberTitulo {...comuns} titulo={janela.titulo} />;
          case "alterar":
            return <AlterarTitulo {...comuns} titulo={janela.titulo} />;
          case "atrelar":
            return <AtrelarTitulo {...comuns} titulo={janela.titulo} />;
          case "notas":
            return <NotasTitulo {...comuns} titulo={janela.titulo} />;
          case "boleto":
            return <BolixTitulo {...comuns} titulo={janela.titulo} />;
          case "novo":
            return <NovoTitulo {...comuns} login={login} />;
          case "info":
            return <InfoTitulo api={api} tituloId={janela.id} onFechar={fechar} />;
          case "enviar":
            return (
              <EnviarTitulos
                api={api}
                detalhe={dados}
                titulos={janela.titulos}
                onFechar={fechar}
              />
            );
          case "estornar":
            return (
              <Confirmar
                titulo={`Estornar titulo ${numeroTitulo(janela.titulo.id)}`}
                texto={
                  <>
                    O título volta para <b>aberto</b> e a saída de{" "}
                    <b>{reais(janela.titulo.valorpag)}</b> é lançada no caixa do
                    MK-Auth.
                  </>
                }
                rotulo="Estornar"
                onFechar={fechar}
                onConfirmar={async () => {
                  try {
                    await api.estornar(janela.titulo.id);
                    showSuccess(`Título ${numeroTitulo(janela.titulo.id)} estornado.`);
                    fechar();
                    carregar();
                  } catch (e) {
                    showError(mensagemDeErro(e, "Erro ao estornar."));
                  }
                }}
              />
            );
          case "excluir":
            return (
              <Confirmar
                titulo="Deletar titulos"
                texto={
                  <>
                    Excluir{" "}
                    {janela.titulos.map((t) => numeroTitulo(t.id)).join(", ")}? Eles
                    somem da lista do cliente (o MK-Auth guarda como excluídos).
                  </>
                }
                rotulo="Deletar"
                onFechar={fechar}
                onConfirmar={async () => {
                  try {
                    await api.excluir(
                      login,
                      janela.titulos.map((t) => t.id),
                    );
                    showSuccess("Títulos excluídos.");
                    fechar();
                    carregar();
                  } catch (e) {
                    showError(mensagemDeErro(e, "Erro ao excluir."));
                  }
                }}
              />
            );
          case "removerAtrelado":
            return (
              <Confirmar
                titulo="Remover lançamento"
                texto={
                  <>
                    Remover "{janela.descricao}" do título{" "}
                    {numeroTitulo(janela.titulo.id)}?
                  </>
                }
                rotulo="Remover"
                onFechar={fechar}
                onConfirmar={async () => {
                  try {
                    await api.removerAtrelado(janela.titulo.id, janela.atrelado);
                    showSuccess("Lançamento removido.");
                    fechar();
                    carregar();
                  } catch (e) {
                    showError(mensagemDeErro(e, "Erro ao remover."));
                  }
                }}
              />
            );
        }
        return null;
      })()}
    </div>
  );
}

export default MensalidadesCliente;
