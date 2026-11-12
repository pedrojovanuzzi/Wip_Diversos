import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNotification } from "../../context/NotificationContext";
import { JanelaMk } from "./JanelaMk";
import { mensagemDeErro } from "./api";
import { numeroTitulo } from "./mkauthEstilo";
import { LembretesEmail } from "./LembretesEmail";
import { Botao, Cartao, Confirmacao, Interruptor, Numero, Selo } from "./ConfigUi";

interface Config {
  gerarBoletos: boolean;
}

interface Resumo {
  inicio: string;
  fim: string;
  origem: string;
  usuario: string;
  analisados: number;
  gerados: number;
  jaTinham: number;
  mesPago: {
    login: string;
    titulo: number;
    competencia: string;
    motivo?: "pago" | "cobrado" | "cancelado";
  }[];
  erros: { login: string; titulo: number; erro: string }[];
  titulosCriados?: {
    login: string;
    titulo: number;
    competencia: string;
    vencimento: string;
    valor: number;
  }[];
  desligados?: number;
}

const base = () => `${process.env.REACT_APP_URL}/mensalidades/config`;
const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Lista dobrável do resumo (isentos criados, pulados, erros). */
function Lista({
  titulo,
  cor,
  aberta,
  children,
}: {
  titulo: React.ReactNode;
  cor?: string;
  aberta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={aberta} className="group rounded-md border border-[#eef0f2] mt-2">
      <summary
        className="cursor-pointer select-none px-3 py-2 font-semibold text-[13px] list-none flex items-center gap-2"
        style={{ color: cor }}
      >
        <span className="transition-transform group-open:rotate-90 text-[10px]">▶</span>
        {titulo}
      </summary>
      <ul className="border-t border-[#eef0f2] divide-y divide-[#f3f4f6] text-[13px]">
        {children}
      </ul>
    </details>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return <li className="px-3 py-1.5 break-words">{children}</li>;
}

function ResumoExecucao({ r }: { r: Resumo }) {
  const quando = new Date(r.inicio).toLocaleString("pt-BR");
  return (
    <div>
      <p className="text-[13px] text-[#7a7a7a] mb-3">
        <b className="text-[#4a4a4a]">{quando}</b> ·{" "}
        {r.origem === "manual" ? `manual (${r.usuario})` : "automática"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Numero rotulo="Analisados" valor={r.analisados} />
        <Numero rotulo="Boletos gerados" valor={r.gerados} destaque={r.gerados > 0} />
        <Numero rotulo="Já tinham" valor={r.jaTinham} />
        <Numero rotulo="Pulados" valor={r.mesPago.length} />
      </div>
      {!!r.desligados && (
        <p className="mt-2 text-[12px] text-[#7a7a7a]">
          {r.desligados} título(s) de clientes com o boleto automático desligado
          ficaram de fora.
        </p>
      )}
      {!!r.titulosCriados?.length && (
        <Lista titulo={`Mensalidades de isentos criadas (${r.titulosCriados.length})`} cor="#257942" aberta>
          {r.titulosCriados.map((c) => (
            <Linha key={c.titulo}>
              <b>{c.login}</b> · título {numeroTitulo(c.titulo)} · vence {dataBr(c.vencimento)} ·{" "}
              {reais(c.valor)}
            </Linha>
          ))}
        </Lista>
      )}
      {r.mesPago.length > 0 && (
        <Lista titulo={`Pulados (${r.mesPago.length})`}>
          {r.mesPago.map((m) => (
            <Linha key={m.titulo}>
              <b>{m.login}</b> · título {numeroTitulo(m.titulo)} · {m.competencia} ·{" "}
              <span className="text-[#7a7a7a]">
                {m.motivo === "cobrado"
                  ? "mês já tem boleto em outro título"
                  : m.motivo === "cancelado"
                    ? "boleto cancelado na tela"
                    : "mês já pago"}
              </span>
            </Linha>
          ))}
        </Lista>
      )}
      {r.erros.length > 0 && (
        <Lista titulo={`Erros (${r.erros.length})`} cor="#cc0f35" aberta>
          {r.erros.map((e, i) => (
            <Linha key={i}>
              <b>{e.login}</b> · título {numeroTitulo(e.titulo)}: {e.erro}
            </Linha>
          ))}
        </Lista>
      )}
    </div>
  );
}

/** A engrenagem da tela Mensalidades. */
export function ConfiguracoesMensalidades({
  token,
  onFechar,
}: {
  token?: string;
  onFechar: () => void;
}) {
  const { showError, showSuccess } = useNotification();
  const headers = { Authorization: `Bearer ${token}` };
  const [cfg, setCfg] = useState<Config | null>(null);
  const [salvo, setSalvo] = useState<Config | null>(null);
  const [ultima, setUltima] = useState<Resumo | null>(null);
  const [ambiente, setAmbiente] = useState({ sandbox: false, notificacao: false });
  const [salvando, setSalvando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [andamento, setAndamento] = useState({ total: 0, feitos: 0 });
  const [confirmarRodar, setConfirmarRodar] = useState(false);
  const [verificadoEm, setVerificadoEm] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(base(), { headers })
      .then(({ data }) => {
        setCfg(data.config);
        setSalvo(data.config);
        setUltima(data.ultima);
        setRodando(!!data.situacao?.rodando);
        setVerificadoEm(data.ultimaVerificacao || null);
        setAmbiente({ sandbox: data.sandbox, notificacao: data.notificacaoConfigurada });
      })
      .catch((e) => showError(mensagemDeErro(e, "Erro ao carregar as configurações.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg) return;
    setSalvando(true);
    try {
      const { data } = await axios.put(base(), cfg, { headers });
      setCfg(data.config);
      setSalvo(data.config);
      showSuccess("Configurações salvas.");
    } catch (err) {
      showError(mensagemDeErro(err, "Erro ao salvar."));
    } finally {
      setSalvando(false);
    }
  };

  // Enquanto gera (em segundo plano no servidor), consulta o andamento.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get(base(), { headers });
        setAndamento({
          total: data.situacao?.total || 0,
          feitos: data.situacao?.feitos || 0,
        });
        if (!data.situacao?.rodando) {
          setRodando(false);
          setUltima(data.ultima);
          setVerificadoEm(data.ultimaVerificacao || null);
          showSuccess(
            `Geração concluída: ${data.ultima?.gerados ?? 0} boleto(s) gerado(s).`,
          );
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  const rodar = async () => {
    setConfirmarRodar(false);
    try {
      await axios.post(`${base()}/rodar`, {}, { headers });
      setAndamento({ total: 0, feitos: 0 });
      setRodando(true);
    } catch (err) {
      showError(mensagemDeErro(err, "Erro ao começar a geração."));
    }
  };

  const mudou = !!cfg && !!salvo && cfg.gerarBoletos !== salvo.gerarBoletos;

  return (
    <JanelaMk
      titulo="Configurações"
      subtitulo="mensalidades"
      onFechar={onFechar}
      corpoClassName="p-3 sm:p-5 bg-[#f5f6f8] sm:rounded-b-lg space-y-4"
    >
      {!cfg && <p className="py-6 text-center text-[14px]">Carregando...</p>}
      {cfg && (
        <>
          <form onSubmit={salvar}>
            <Cartao
              icone="🧾"
              titulo="Boleto automático (Efí)"
              descricao="A cada minuto, gera o boleto com Pix das mensalidades a vencer que ainda não têm, dos clientes com o boleto automático ligado. Mês já pago, ou que já tem boleto, nunca é cobrado de novo."
              direita={
                <Interruptor
                  ligado={cfg.gerarBoletos}
                  onChange={(v) => setCfg({ ...cfg, gerarBoletos: v })}
                  title="Depois de mudar, clique em Salvar"
                />
              }
              rodape={
                <>
                  <Botao type="submit" variante="primario" disabled={salvando || !mudou}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </Botao>
                  <Botao
                    variante="contorno"
                    disabled={rodando}
                    onClick={() => setConfirmarRodar(true)}
                  >
                    {rodando
                      ? andamento.total
                        ? `Gerando... ${andamento.feitos} de ${andamento.total}`
                        : "Gerando..."
                      : "Rodar agora"}
                  </Botao>
                  {mudou && (
                    <span className="text-[12px] text-[#946c00] sm:ml-1">
                      Alteração ainda não salva.
                    </span>
                  )}
                </>
              }
            >
              <div className="flex flex-wrap gap-2">
                <Selo cor={ambiente.sandbox ? "amarelo" : "verde"}>
                  Efí: {ambiente.sandbox ? "homologação (sandbox)" : "produção"}
                </Selo>
                <Selo
                  cor={ambiente.notificacao ? "verde" : "vermelho"}
                  title={
                    ambiente.notificacao
                      ? "A Efí avisa o pagamento na hora."
                      : "Sem EFI_BOLIX_NOTIFICACAO_URL no .env: a baixa fica na conferência a cada 5 minutos."
                  }
                >
                  Aviso de pagamento: {ambiente.notificacao ? "configurado" : "não configurado"}
                </Selo>
                {verificadoEm && (
                  <Selo>Última conferência: {new Date(verificadoEm).toLocaleString("pt-BR")}</Selo>
                )}
              </div>
              {confirmarRodar && (
                <Confirmacao
                  confirmar="Gerar agora"
                  onConfirmar={rodar}
                  onCancelar={() => setConfirmarRodar(false)}
                >
                  Gera agora, na Efí{ambiente.sandbox ? " (sandbox)" : ""}, os boletos que
                  faltam, com as configurações <b>salvas</b>. Continuar?
                </Confirmacao>
              )}
            </Cartao>
          </form>

          <Cartao icone="📊" titulo="Última execução">
            {ultima ? (
              <ResumoExecucao r={ultima} />
            ) : (
              <p className="text-[14px] text-[#7a7a7a]">Ainda não rodou.</p>
            )}
          </Cartao>

          <LembretesEmail token={token} />
        </>
      )}
    </JanelaMk>
  );
}
