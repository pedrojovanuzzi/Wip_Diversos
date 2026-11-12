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
  cabecalhoTabela,
  dataCurta,
  diasDoVencimento,
  linhaZebra,
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
import { exportarCsv, imprimirRecibo, imprimirTitulos } from "./impressao";
import { BolixTitulo } from "./BolixTitulo";
import { SeloWipDiversos } from "./SeloWipDiversos";

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

/** Links pequenos em negrito separados por "|", como no MK-Auth. */
function Acoes({
  itens,
}: {
  itens: ({ rotulo: string; onClick: () => void; destaque?: boolean } | false)[];
}) {
  return (
    <div className="text-[12px] font-bold text-[#46484a]">
      {itens.filter(Boolean).map((i) => {
        const it = i as { rotulo: string; onClick: () => void; destaque?: boolean };
        return (
          <React.Fragment key={it.rotulo}>
            <button
              type="button"
              onClick={it.onClick}
              className={`hover:underline ${it.destaque ? "text-[#00d1b2]" : ""}`}
            >
              {it.rotulo}
            </button>
            <span className="mx-1">|</span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function BotaoBarra({
  titulo,
  cor,
  onClick,
  children,
}: {
  titulo: string;
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
      className="w-[25px] h-[25px] flex items-center justify-center rounded-[3px] text-white text-[14px]"
      style={{ background: cor }}
    >
      {children}
    </button>
  );
}

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


  return (
    <div style={paginaMk}>
      <NavBar />
      <div className="px-3 sm:px-4 pb-10">
        {/* "CLIENTES • DETALHES • NOME" */}
        <div className="text-center my-6 text-[15px] uppercase">
          <SeloWipDiversos />
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[#3273dc] uppercase hover:underline"
          >
            Clientes
          </button>
          <span className="mx-2">•</span>
          <Link
            to={`/mensalidades/${encodeURIComponent(login)}`}
            className="text-[#3273dc] hover:underline"
          >
            Detalhes
          </Link>
          <span className="mx-2">•</span>
          {dados?.cliente.nome || login}
        </div>

        {/* Só a aba Financeiro: Eventos e Suporte ficam no próprio MK-Auth. */}
        <div className="flex border-b border-[#dbdbdb] mb-4">
          <span className="flex items-center gap-2 px-4 sm:px-16 py-2 text-[#3273dc] border border-[#dbdbdb] border-b-white -mb-px rounded-t bg-white">
            <FaMoneyBillAlt /> Financeiro
          </span>
        </div>

        {(
          <>
            {erro && <p className="text-center py-6">{erro}</p>}
            {!dados && !erro && <p className="text-center py-6">Carregando...</p>}

            {dados && (
              <>
                <h2 className="font-bold text-[15px] mb-2 pb-2 border-b border-[#ededed]">
                  Titulos do cliente
                </h2>
                {dados.abertos.length === 0 ? (
                  <p className="text-center font-bold py-2 mb-8">
                    Não existem lançamentos para o cliente
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-[#ededed] mb-8">
                    <table className="w-full border-separate border-spacing-0 min-w-[700px]">
                      <thead>
                        <tr className={cabecalhoTabela}>
                          <th className="px-1 py-0.5">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={todosMarcados}
                                onChange={() =>
                                  setSelecionados(
                                    todosMarcados
                                      ? new Set()
                                      : new Set(dados.abertos.map((t) => t.id)),
                                  )
                                }
                              />
                              Titulo
                            </label>
                          </th>
                          <th className="px-1 py-0.5">Tipo</th>
                          <th className="px-1 py-0.5">Status</th>
                          <th className="px-1 py-0.5">Vencimento</th>
                          <th className="px-1 py-0.5">Nossonumero</th>
                          <th className="px-1 py-0.5">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.abertos.map((t, i) => {
                          const temItens = t.atrelados.length > 0;
                          const aberto = abertosMais.has(t.id);
                          return (
                            <React.Fragment key={t.id}>
                              <tr
                                className={`${linhaZebra(i)} ${
                                  // O MK-Auth pinta de vermelho o título vencido.
                                  t.status === "vencido" ? "text-[#f14668] font-bold" : ""
                                }`}
                              >
                                <td className="px-1 pt-0.5 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    className="mr-1 align-middle"
                                    checked={selecionados.has(t.id)}
                                    onChange={() =>
                                      setSelecionados((s) => alternar(s, t.id))
                                    }
                                    aria-label={`Selecionar título ${numeroTitulo(t.id)}`}
                                  />
                                  <button
                                    type="button"
                                    disabled={!temItens}
                                    onClick={() =>
                                      setAbertosMais((s) => alternar(s, t.id))
                                    }
                                    className={`mr-1 w-3 ${temItens ? "text-[#4a4a4a]" : "invisible"}`}
                                    aria-label="Ver lançamentos atrelados"
                                  >
                                    {aberto ? "−" : "+"}
                                  </button>
                                  {numeroTitulo(t.id)}
                                </td>
                                <td className="px-1 pt-0.5">{t.tipo}</td>
                                <td className="px-1 pt-0.5">{t.status}</td>
                                <td className="px-1 pt-0.5">
                                  {dataCurta(t.datavenc)} [ {diasDoVencimento(t.datavenc)} ]
                                </td>
                                <td className="px-1 pt-0.5">{t.nossonum}</td>
                                <td className="px-1 pt-0.5">{reais(t.valorTotal)}</td>
                              </tr>
                              <tr className={linhaZebra(i)}>
                                <td colSpan={6} className="px-1 pb-0.5">
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
                                </td>
                              </tr>
                              {aberto && temItens && (
                                <tr>
                                  <td colSpan={6} className="p-0">
                                    <table className="w-full border-separate border-spacing-0">
                                      <thead>
                                        <tr className="bg-[#ff3860] text-white font-bold uppercase text-left text-[15px]">
                                          <th className="px-1 py-0.5 pl-6">Descrição</th>
                                          <th className="px-1 py-0.5 w-[8%]">Tipo</th>
                                          <th className="px-1 py-0.5 w-[8%]">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {t.atrelados.map((a) => (
                                          <tr key={a.id}>
                                            <td className="px-1 py-0.5">
                                              {admin ? (
                                                <button
                                                  type="button"
                                                  title="Remover lançamento"
                                                  onClick={() =>
                                                    setJanela({
                                                      tipo: "removerAtrelado",
                                                      titulo: t,
                                                      atrelado: a.id,
                                                      descricao: a.descricao || a.tipo,
                                                    })
                                                  }
                                                  className="text-[#f14668] mr-1 align-middle"
                                                >
                                                  <FaTrashAlt />
                                                </button>
                                              ) : (
                                                <span className="inline-block w-[18px]" />
                                              )}
                                              {a.descricao}
                                            </td>
                                            <td className="px-1 py-0.5">{a.tipo}</td>
                                            <td className="px-1 py-0.5">{reais(a.valor)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        <tr>
                          <td colSpan={5} />
                          <td className="px-1 pt-3 pb-1 font-bold">
                            {reais(dados.totalAberto)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Barra de ícones */}
                <div className="flex gap-1 mb-8">
                  <BotaoBarra
                    titulo="Adicionar titulos"
                    cor="#48c774"
                    onClick={() => setJanela({ tipo: "novo" })}
                  >
                    <FaPlus />
                  </BotaoBarra>
                  {dados.abertos.length > 0 && (
                    <>
                      {admin && (
                        <BotaoBarra
                          titulo="Deletar titulos"
                          cor="#f14668"
                          onClick={exigirSelecao((t) =>
                            setJanela({ tipo: "excluir", titulos: t }),
                          )}
                        >
                          <FaTrashAlt />
                        </BotaoBarra>
                      )}
                      <BotaoBarra
                        titulo="Imprimir titulos"
                        cor="#3e8ed0"
                        onClick={exigirSelecao((t) => {
                          if (!imprimirTitulos(dados, t))
                            showError("O navegador bloqueou a janela de impressão.");
                        })}
                      >
                        <FaPrint />
                      </BotaoBarra>
                      <BotaoBarra
                        titulo="Exportar para excel"
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
                      <BotaoBarra
                        titulo="Enviar mensagem"
                        cor="#3273dc"
                        onClick={exigirSelecao((t) =>
                          setJanela({ tipo: "enviar", titulos: t }),
                        )}
                      >
                        <FaEnvelope />
                      </BotaoBarra>
                    </>
                  )}
                </div>

                <h2 className="font-bold text-[15px] mb-2 pb-2 border-b border-[#ededed]">
                  Pagos anteriormente
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 min-w-[760px]">
                    <thead>
                      <tr className={cabecalhoTabela}>
                        <th className="px-1 py-0.5">Titulo</th>
                        <th className="px-1 py-0.5">Vencimento</th>
                        <th className="px-1 py-0.5">Coletor</th>
                        <th className="px-1 py-0.5">Forma</th>
                        <th className="px-1 py-0.5">Retornos</th>
                        <th className="px-1 py-0.5">Pagamento</th>
                        <th className="px-1 py-0.5">Valor</th>
                        <th className="px-1 py-0.5">Valor pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.pagos.map((t, i) => (
                        <React.Fragment key={t.id}>
                          <tr className={linhaZebra(i)}>
                            <td className="px-1 pt-0.5">{numeroTitulo(t.id)}</td>
                            <td className="px-1 pt-0.5">{dataCurta(t.datavenc)}</td>
                            <td className="px-1 pt-0.5">{t.coletor}</td>
                            <td className="px-1 pt-0.5">{t.formapag}</td>
                            <td className="px-1 pt-0.5">
                              {String(t.num_retornos ?? 0).padStart(3, "0")}
                            </td>
                            <td className="px-1 pt-0.5">{dataCurta(t.datapag)}</td>
                            <td className="px-1 pt-0.5">{reais(t.valorTotal)}</td>
                            <td className="px-1 pt-0.5">{reais(t.valorpag)}</td>
                          </tr>
                          <tr className={linhaZebra(i)}>
                            <td colSpan={8} className="px-1 pb-0.5">
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
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                      {dados.pagos.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-1 py-2 text-[15px]">
                            Nenhum título pago.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
