import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNotification } from "../../context/NotificationContext";
import { CampoMk, inputMk, JanelaMk } from "./JanelaMk";
import { mensagemDeErro } from "./api";
import { numeroTitulo } from "./mkauthEstilo";

interface Config {
  gerarBoletos: boolean;
  diasAntecedencia: number;
  incluirVencidos: boolean;
  enviarEmail: boolean;
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
  emails: number;
  erros: { login: string; titulo: number; erro: string }[];
}

const base = () => `${process.env.REACT_APP_URL}/mensalidades/config`;

function Marcar({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-[15px] cursor-pointer mb-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function ResumoExecucao({ r }: { r: Resumo }) {
  const quando = new Date(r.inicio).toLocaleString("pt-BR");
  return (
    <div className="text-[14px]">
      <p className="mb-2">
        <b>{quando}</b> · {r.origem === "manual" ? `manual (${r.usuario})` : "agendamento"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {[
          ["Analisados", r.analisados],
          ["Gerados", r.gerados],
          ["Já tinham", r.jaTinham],
          ["Pulados", r.mesPago.length],
          ["E-mails", r.emails],
        ].map(([rotulo, n]) => (
          <div key={rotulo as string} className="border border-[#ededed] rounded px-2 py-1">
            <div className="text-[12px] text-[#7a7a7a]">{rotulo}</div>
            <div className="text-[18px] font-bold">{n}</div>
          </div>
        ))}
      </div>
      {r.mesPago.length > 0 && (
        <details className="mb-2">
          <summary className="cursor-pointer font-bold">
            Pulados ({r.mesPago.length}): títulos em aberto de um mês que o
            cliente já pagou, que já tem boleto em outro título ou cujo boleto
            foi cancelado na tela
          </summary>
          <ul className="list-disc pl-6 mt-1">
            {r.mesPago.map((m) => (
              <li key={m.titulo}>
                {m.login} · título {numeroTitulo(m.titulo)} · {m.competencia} ·{" "}
                {m.motivo === "cobrado"
                  ? "mês já tem boleto"
                  : m.motivo === "cancelado"
                    ? "boleto cancelado na tela"
                    : "mês já pago"}
              </li>
            ))}
          </ul>
        </details>
      )}
      {r.erros.length > 0 && (
        <details open>
          <summary className="cursor-pointer font-bold text-[#f14668]">
            Erros ({r.erros.length})
          </summary>
          <ul className="list-disc pl-6 mt-1">
            {r.erros.map((e, i) => (
              <li key={i}>
                {e.login} · título {numeroTitulo(e.titulo)}: {e.erro}
              </li>
            ))}
          </ul>
        </details>
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

  return (
    <JanelaMk titulo="Configurações" subtitulo="mensalidades" onFechar={onFechar}>
      {!cfg && <p className="py-4">Carregando...</p>}
      {cfg && (
        <>
          <form onSubmit={salvar}>
            <h3 className="font-bold text-[15px] mb-2 pb-2 border-b border-[#ededed]">
              Gerar boletos (bolix da Efí)
            </h3>
            <p className="text-[13px] text-[#7a7a7a] mb-3">
              A cada 10 minutos confere as mensalidades em aberto e gera o
              boleto com Pix das que ainda não têm, logo depois de o MK-Auth
              criar a mensalidade. Um mês que o cliente já pagou, ou que já tem
              boleto, nunca é cobrado de novo.
            </p>
            <Marcar
              checked={cfg.gerarBoletos}
              onChange={(v) => setCfg({ ...cfg, gerarBoletos: v })}
            >
              <b>Gerar boletos automaticamente</b>{" "}
              <span className="text-[13px] text-[#7a7a7a]">
                (confere a cada 10 minutos)
              </span>
            </Marcar>
            {verificadoEm && (
              <p className="text-[13px] text-[#7a7a7a] -mt-1 mb-2 ml-6">
                Última conferência: {new Date(verificadoEm).toLocaleString("pt-BR")}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-x-3 mt-2">
              <CampoMk rotulo="Dias antes do vencimento">
                <input
                  type="number"
                  min={0}
                  max={60}
                  className={inputMk}
                  value={cfg.diasAntecedencia}
                  onChange={(e) =>
                    setCfg({ ...cfg, diasAntecedencia: Number(e.target.value) })
                  }
                  required
                />
              </CampoMk>
            </div>
            <Marcar
              checked={cfg.incluirVencidos}
              onChange={(v) => setCfg({ ...cfg, incluirVencidos: v })}
            >
              Incluir mensalidades já vencidas{" "}
              <span className="text-[13px] text-[#7a7a7a]">
                (o boleto vence no dia, com multa e juros; se ele vencer sem
                pagamento, é refeito no dia seguinte)
              </span>
            </Marcar>
            <Marcar
              checked={cfg.enviarEmail}
              onChange={(v) => setCfg({ ...cfg, enviarEmail: v })}
            >
              Mandar o boleto por e-mail ao cliente quando for gerado
            </Marcar>
            <div className="text-[13px] mt-3 mb-1 space-y-1">
              <p>
                Efí: <b>{ambiente.sandbox ? "homologação (sandbox)" : "produção"}</b>
              </p>
              <p>
                Aviso de pagamento:{" "}
                {ambiente.notificacao ? (
                  <b className="text-[#48c774]">configurado</b>
                ) : (
                  <b className="text-[#f14668]">
                    sem EFI_BOLIX_NOTIFICACAO_URL no .env (a baixa só acontece
                    pelo "Verificar pagamento")
                  </b>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 mt-4">
              <button
                type="submit"
                disabled={salvando}
                className="h-[30px] px-3 rounded bg-[#3273dc] text-white disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                disabled={rodando}
                onClick={() => setConfirmarRodar(true)}
                className="h-[30px] px-3 rounded bg-[#48c774] text-white disabled:opacity-60"
              >
                {rodando
                  ? andamento.total
                    ? `Gerando... ${andamento.feitos} de ${andamento.total}`
                    : "Gerando..."
                  : "Rodar agora"}
              </button>
              <button
                type="button"
                onClick={onFechar}
                className="h-[30px] px-3 rounded bg-[#ffdd57] text-[rgba(0,0,0,.7)]"
              >
                Fechar
              </button>
            </div>
            {confirmarRodar && (
              <div className="mt-3 p-3 border border-[#ffdd57] bg-[#fffbeb] text-[14px]">
                <p className="mb-2">
                  Gera agora, na Efí{ambiente.sandbox ? " (sandbox)" : ""}, os
                  boletos que faltam com as configurações <b>salvas</b>
                  {cfg.enviarEmail ? " e manda os e-mails aos clientes" : ""}.
                  Continuar?
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={rodar}
                    className="h-[28px] px-3 rounded bg-[#48c774] text-white"
                  >
                    Gerar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarRodar(false)}
                    className="h-[28px] px-3 rounded bg-[#ffdd57]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </form>

          <h3 className="font-bold text-[15px] mt-6 mb-2 pb-2 border-b border-[#ededed]">
            Última execução
          </h3>
          {ultima ? (
            <ResumoExecucao r={ultima} />
          ) : (
            <p className="text-[14px]">Ainda não rodou.</p>
          )}
        </>
      )}
    </JanelaMk>
  );
}
