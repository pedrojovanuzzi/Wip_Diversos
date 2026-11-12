import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNotification } from "../../context/NotificationContext";
import { Botao, campo, Cartao, Confirmacao, Interruptor } from "./ConfigUi";
import { mensagemDeErro } from "./api";
import { numeroTitulo } from "./mkauthEstilo";

interface Etapa {
  dias: number;
  hora: string;
}

interface ConfigLembretes {
  ativo: boolean;
  etapas: Etapa[];
  soMensalidades: boolean;
  anexarPdf: boolean;
  assunto: string;
  mensagem: string;
  intervaloSegundos: number;
}

interface ResumoEtapa {
  dias: number;
  vencimento: string;
  analisados: number;
  enviados: number;
  jaEnviados: number;
  semEmail: string[];
  pulados: { login: string; titulo: number; motivo: string }[];
  erros: { login: string; titulo: number; erro: string }[];
}

interface Resumo {
  inicio: string;
  fim: string;
  origem: string;
  usuario: string;
  etapas: ResumoEtapa[];
}

interface Envio {
  id: number;
  titulo_id: number;
  login_cliente: string;
  dias_antes: number;
  vencimento: string;
  email: string | null;
  situacao: string;
  com_pdf: number;
  erro: string | null;
  atualizado_em: string;
}

const base = () => `${process.env.REACT_APP_URL}/mensalidades/config/lembretes`;
const nomeEtapa = (d: number) =>
  d === 0 ? "no dia do vencimento" : d === 1 ? "1 dia antes" : `${d} dias antes`;
const dataBr = (iso: string) => String(iso).slice(0, 10).split("-").reverse().join("/");

function ResumoLembretes({ r }: { r: Resumo }) {
  return (
    <div className="text-[14px]">
      <p className="mb-2">
        <b>{new Date(r.inicio).toLocaleString("pt-BR")}</b> ·{" "}
        {r.origem === "manual" ? `manual (${r.usuario})` : "agendamento"}
        {!r.fim && " · rodando..."}
      </p>
      {r.etapas.map((e) => (
        <div key={e.dias} className="mb-2">
          <p>
            <b>{nomeEtapa(e.dias)}</b>
            {e.vencimento && ` (vencimento ${dataBr(e.vencimento)})`}: {e.analisados}{" "}
            título(s), <b>{e.enviados}</b> enviado(s), {e.jaEnviados} já tinham
            {e.semEmail.length > 0 && `, ${e.semEmail.length} sem e-mail`}
            {e.pulados.length > 0 && `, ${e.pulados.length} pulado(s)`}
            {e.erros.length > 0 && (
              <span className="text-[#f14668]">, {e.erros.length} erro(s)</span>
            )}
          </p>
          {(e.erros.length > 0 || e.pulados.length > 0 || e.semEmail.length > 0) && (
            <details>
              <summary className="cursor-pointer text-[13px] text-[#7a7a7a]">
                detalhes
              </summary>
              <ul className="list-disc pl-6 text-[13px]">
                {e.erros.map((x, i) => (
                  <li key={`e${i}`} className="text-[#f14668]">
                    {x.login} · título {numeroTitulo(x.titulo)}: {x.erro}
                  </li>
                ))}
                {e.pulados.map((x, i) => (
                  <li key={`p${i}`}>
                    {x.login} · título {numeroTitulo(x.titulo)}: {x.motivo}
                  </li>
                ))}
                {e.semEmail.length > 0 && <li>Sem e-mail: {e.semEmail.join(", ")}</li>}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Seção "Enviar boletos por e-mail" da engrenagem: lembretes antes do
 * vencimento com o bolix da Efí e o PDF anexado (no lugar do envio do projeto
 * MensagensWhatsapp, que anexava o PDF do MK-Auth).
 */
export function LembretesEmail({ token }: { token?: string }) {
  const { showError, showSuccess } = useNotification();
  const headers = { Authorization: `Bearer ${token}` };
  const [cfg, setCfg] = useState<ConfigLembretes | null>(null);
  const [variaveis, setVariaveis] = useState<[string, string][]>([]);
  const [ultima, setUltima] = useState<Resumo | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [rodando, setRodando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [teste, setTeste] = useState({ para: "", titulo: "" });
  const [testando, setTestando] = useState(false);
  const mensagemRef = useRef<HTMLTextAreaElement>(null);
  const assuntoRef = useRef<HTMLInputElement>(null);
  const ultimoCampo = useRef<"assunto" | "mensagem">("mensagem");

  const carregar = async () => {
    const { data } = await axios.get(base(), { headers });
    setCfg(data.config);
    setVariaveis(data.variaveis || []);
    setUltima(data.ultima);
    setEnvios(data.envios || []);
    setRodando(!!data.rodando);
    return data;
  };

  useEffect(() => {
    carregar().catch((e) => showError(mensagemDeErro(e, "Erro ao carregar os e-mails.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquanto envia (pausa entre e-mails), atualiza a cada 5 s.
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(async () => {
      try {
        const data = await carregar();
        if (!data.rodando) showSuccess("Envio de e-mails concluído.");
      } catch {
        // tenta no próximo ciclo
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  if (!cfg) return <p className="text-[14px] py-4 text-center">Carregando...</p>;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data } = await axios.put(base(), cfg, { headers });
      setCfg(data.config);
      showSuccess("Envio por e-mail salvo.");
    } catch (err) {
      showError(mensagemDeErro(err, "Erro ao salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const rodar = async () => {
    setConfirmar(false);
    try {
      await axios.post(`${base()}/rodar`, {}, { headers });
      setRodando(true);
    } catch (err) {
      showError(mensagemDeErro(err, "Erro ao começar o envio."));
    }
  };

  const testar = async () => {
    setTestando(true);
    try {
      const { data } = await axios.post(
        `${base()}/teste`,
        { para: teste.para, titulo: Number(teste.titulo) },
        { headers },
      );
      showSuccess(
        `Teste enviado para ${data.para}${data.comPdf ? " com o PDF" : " (sem PDF)"}.`,
      );
    } catch (err) {
      showError(mensagemDeErro(err, "Erro ao enviar o teste."));
    } finally {
      setTestando(false);
    }
  };

  const mudarEtapa = (i: number, campo: keyof Etapa, valor: string) =>
    setCfg({
      ...cfg,
      etapas: cfg.etapas.map((e, j) =>
        j === i ? { ...e, [campo]: campo === "dias" ? Number(valor) : valor } : e,
      ),
    });

  // Insere a variável onde está o cursor (no assunto ou na mensagem).
  const inserir = (v: string) => {
    const campo = ultimoCampo.current;
    const alvo = campo === "assunto" ? assuntoRef.current : mensagemRef.current;
    const atual = cfg[campo];
    const ini = alvo?.selectionStart ?? atual.length;
    const fim = alvo?.selectionEnd ?? atual.length;
    setCfg({ ...cfg, [campo]: atual.slice(0, ini) + v + atual.slice(fim) });
    requestAnimationFrame(() => {
      alvo?.focus();
      alvo?.setSelectionRange(ini + v.length, ini + v.length);
    });
  };

  const etapasOrdenadas = [...cfg.etapas].sort((a, b) => b.dias - a.dias);

  return (
    <form onSubmit={salvar} className="space-y-4 text-[14px]">
      <Cartao
        icone="✉️"
        titulo="Enviar boletos por e-mail"
        descricao="Lembrete ao cliente antes do vencimento, com o boleto da Efí em PDF, a linha digitável e o Pix."
        direita={
          <Interruptor
            ligado={cfg.ativo}
            onChange={(v) => setCfg({ ...cfg, ativo: v })}
            title="Depois de mudar, clique em Salvar"
          />
        }
        rodape={
          <>
            <Botao type="submit" variante="primario" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Botao>
            <Botao variante="contorno" disabled={rodando} onClick={() => setConfirmar(true)}>
              {rodando ? "Enviando..." : "Enviar agora"}
            </Botao>
            <span className="text-[12px] text-[#7a7a7a] sm:ml-1 sm:flex-1">
              Desligue o envio de boletos do projeto MensagensWhatsapp para o
              cliente não receber dois e-mails.
            </span>
          </>
        }
      >
        {/* 1. Quando */}
        <Passo numero={1} titulo="Quando enviar">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            {cfg.etapas.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-[#dbdbdb] bg-[#fafbfc] pl-2 pr-1 py-1"
              >
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={e.dias}
                  onChange={(ev) => mudarEtapa(i, "dias", ev.target.value)}
                  aria-label="Dias antes do vencimento"
                  className="w-[52px] h-[30px] border border-[#dbdbdb] rounded px-1 text-center bg-white"
                />
                <span className="text-[13px] whitespace-nowrap">
                  {e.dias === 0 ? "no dia, às" : "dias antes, às"}
                </span>
                <input
                  type="time"
                  value={e.hora}
                  onChange={(ev) => mudarEtapa(i, "hora", ev.target.value)}
                  aria-label="Horário"
                  className="h-[30px] border border-[#dbdbdb] rounded px-1 bg-white"
                />
                <button
                  type="button"
                  title="Tirar este dia"
                  aria-label="Tirar este dia"
                  onClick={() =>
                    setCfg({ ...cfg, etapas: cfg.etapas.filter((_, j) => j !== i) })
                  }
                  className="ml-auto sm:ml-0 w-[30px] h-[30px] rounded-full text-[#7a7a7a] hover:bg-[#feecf0] hover:text-[#cc0f35]"
                >
                  ×
                </button>
              </div>
            ))}
            {cfg.etapas.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  setCfg({ ...cfg, etapas: [...cfg.etapas, { dias: 3, hora: "09:00" }] })
                }
                className="h-[40px] rounded-md border border-dashed border-[#3273dc] text-[#3273dc] px-3 hover:bg-[#eef3fc]"
              >
                + adicionar dia
              </button>
            )}
          </div>
          <p className="text-[12px] text-[#7a7a7a] mt-2">
            {etapasOrdenadas.length
              ? `Cada título recebe ${etapasOrdenadas.length} e-mail(s): ${etapasOrdenadas
                  .map((e) => `${nomeEtapa(e.dias)} às ${e.hora}`)
                  .join(", ")}.`
              : "Nenhum dia escolhido: nada será enviado."}
          </p>
        </Passo>

        {/* 2. O quê */}
        <Passo numero={2} titulo="O que enviar">
          <label className="block mb-3">
            <span className="block font-semibold text-[13px] mb-1">Assunto</span>
            <input
              ref={assuntoRef}
              onFocus={() => (ultimoCampo.current = "assunto")}
              className={campo}
              value={cfg.assunto}
              onChange={(e) => setCfg({ ...cfg, assunto: e.target.value })}
              required
            />
          </label>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="block font-semibold text-[13px] mb-1">Mensagem</span>
              <textarea
                ref={mensagemRef}
                onFocus={() => (ultimoCampo.current = "mensagem")}
                className="w-full h-[220px] lg:h-[320px] border border-[#dbdbdb] rounded-md px-3 py-2 text-[13px] leading-[1.45] bg-white focus:outline-none focus:border-[#3273dc] focus:ring-2 focus:ring-[#3273dc]/15 resize-y"
                value={cfg.mensagem}
                onChange={(e) => setCfg({ ...cfg, mensagem: e.target.value })}
                required
              />
            </label>
            <div className="min-w-0">
              <span className="block font-semibold text-[13px] mb-1">
                Como o cliente vê{" "}
                <span className="font-normal text-[12px] text-[#7a7a7a]">(exemplo)</span>
              </span>
              <div className="h-[220px] lg:h-[320px] overflow-auto rounded-md border border-[#e3e6ea] bg-white shadow-inner">
                <p className="sticky top-0 bg-[#fafbfc] font-bold px-3 py-2 border-b border-[#eef0f2] break-words">
                  {exemplo(cfg.assunto)}
                </p>
                <div className="px-3 py-2 text-[13px] leading-[1.45] whitespace-pre-wrap break-words">
                  {exemplo(cfg.mensagem)}
                </div>
                {cfg.anexarPdf && (
                  <p className="mx-3 mb-3 inline-block rounded border border-[#dbdbdb] bg-[#fafbfc] px-2 py-0.5 text-[12px]">
                    📎 boleto-20-11-2026-00123.pdf
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <span className="block text-[12px] text-[#7a7a7a] mb-1">
              Inserir no texto (clique onde quer e escolha):
            </span>
            <div className="flex flex-wrap gap-1">
              {variaveis.map(([v, d]) => (
                <button
                  key={v}
                  type="button"
                  title={v}
                  onClick={() => inserir(v)}
                  className="text-[12px] rounded-full border border-[#dbdbdb] bg-white px-2.5 py-1 hover:border-[#3273dc] hover:text-[#3273dc]"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 mt-4">
            <label className="flex items-center gap-2 cursor-pointer rounded-md border border-[#eef0f2] px-3 py-2">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={cfg.anexarPdf}
                onChange={(e) => setCfg({ ...cfg, anexarPdf: e.target.checked })}
              />
              Anexar o PDF do boleto
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-md border border-[#eef0f2] px-3 py-2">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={cfg.soMensalidades}
                onChange={(e) => setCfg({ ...cfg, soMensalidades: e.target.checked })}
              />
              Só mensalidades (ignora serviços e avulsos)
            </label>
            <label className="flex flex-wrap items-center gap-2 rounded-md border border-[#eef0f2] px-3 py-2 sm:col-span-2">
              Esperar
              <input
                type="number"
                min={0}
                max={600}
                value={cfg.intervaloSegundos}
                onChange={(e) => setCfg({ ...cfg, intervaloSegundos: Number(e.target.value) })}
                className="w-[70px] h-[30px] border border-[#dbdbdb] rounded px-1 text-center"
                required
              />
              segundos entre um e-mail e outro
            </label>
          </div>
        </Passo>

        {confirmar && (
          <Confirmacao
            confirmar="Enviar agora"
            onConfirmar={rodar}
            onCancelar={() => setConfirmar(false)}
          >
            Manda agora, com o que está <b>salvo</b>, os e-mails de hoje (
            {etapasOrdenadas.map((e) => nomeEtapa(e.dias)).join(", ")}) a quem ainda
            não recebeu. Continuar?
          </Confirmacao>
        )}
      </Cartao>

      {/* 3. Teste */}
      <Cartao
        icone="🧪"
        titulo="Testar antes de ligar"
        descricao="Manda o e-mail de um título em aberto para você, não para o cliente (usa o que está salvo). O título precisa já ter boleto: o teste não cria cobrança na Efí."
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="seu e-mail"
            className={`${campo} sm:flex-1`}
            value={teste.para}
            onChange={(e) => setTeste({ ...teste, para: e.target.value })}
          />
          <input
            type="number"
            placeholder="nº do título"
            className={`${campo} sm:!w-[150px]`}
            value={teste.titulo}
            onChange={(e) => setTeste({ ...teste, titulo: e.target.value })}
          />
          <Botao
            variante="escuro"
            disabled={testando || !teste.para || !teste.titulo}
            onClick={testar}
          >
            {testando ? "Enviando..." : "Enviar teste"}
          </Botao>
        </div>
      </Cartao>

      {/* Histórico */}
      <Cartao icone="🕘" titulo="Último envio de e-mails">
        {ultima ? (
          <ResumoLembretes r={ultima} />
        ) : (
          <p className="text-[#7a7a7a]">Nenhum e-mail enviado ainda.</p>
        )}
        {envios.length > 0 && (
          <details className="group mt-3 rounded-md border border-[#eef0f2]">
            <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-[13px] list-none flex items-center gap-2">
              <span className="transition-transform group-open:rotate-90 text-[10px]">▶</span>
              Últimos e-mails ({envios.length})
            </summary>
            <ul className="border-t border-[#eef0f2] divide-y divide-[#f3f4f6] text-[13px]">
              {envios.map((e) => (
                <li key={e.id} className="px-3 py-1.5 break-words">
                  <span className="text-[#7a7a7a]">
                    {new Date(e.atualizado_em).toLocaleString("pt-BR")}
                  </span>{" "}
                  · <b>{e.login_cliente}</b> · título {numeroTitulo(e.titulo_id)} ·{" "}
                  {nomeEtapa(e.dias_antes)} · {e.email} ·{" "}
                  {e.situacao === "enviado" ? (
                    <span className="text-[#257942]">
                      enviado{e.com_pdf ? " com PDF" : " sem PDF"}
                    </span>
                  ) : (
                    <span className="text-[#cc0f35]">erro: {e.erro}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Cartao>
    </form>
  );
}

function Passo({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-4 first:pt-1 mt-4 first:mt-0 border-t first:border-t-0 border-[#eef0f2]">
      <h4 className="flex items-center gap-2 font-bold text-[14px] mb-3 text-[#363636]">
        <span className="w-[22px] h-[22px] rounded-full bg-[#3273dc] text-white text-[12px] flex items-center justify-center shrink-0">
          {numero}
        </span>
        {titulo}
      </h4>
      <div className="sm:pl-[30px]">{children}</div>
    </div>
  );
}

// Valores de exemplo para a prévia.
const EXEMPLO: Record<string, string> = {
  nome: "Maria da Silva",
  login: "MARIASILVA",
  vencimento: "20/11/2026",
  prazo: "vence em 5 dias",
  valor: "R$ 99,90",
  titulo: "00123",
  boleto: "https://download.sejaefi.com.br/...",
  linhadig: "36490.00019 00006.009104 00000.942771 3 00000000009990",
  pix: "00020101021226940014BR.GOV.BCB.PIX2572qrcodespix.sejaefi.com.br/v2/...",
  endereco: "RUA DAS FLORES Nº 123",
  provedor: "WIP TELECOM",
};
const exemplo = (s: string) =>
  s.replace(/%(\w+)%/g, (m, k) => EXEMPLO[k.toLowerCase()] ?? m);
