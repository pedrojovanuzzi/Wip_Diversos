import React, { useEffect, useState } from "react";
import { useNotification } from "../../context/NotificationContext";
import { ApiMensalidades, Detalhe, mensagemDeErro, Titulo } from "./api";
import {
  BotoesMk,
  CampoMk,
  DinheiroMk,
  inputMk,
  JanelaMk,
  RadiosMk,
} from "./JanelaMk";
import {
  agoraLocal,
  dataCurta,
  dataIso,
  multaMora,
  numeroDe,
  numeroTitulo,
  reais,
  valorCampo,
} from "./mkauthEstilo";

const n3 = (id: number) => String(id).padStart(3, "0");

type Props = {
  api: ApiMensalidades;
  onFechar: () => void;
  onFeito: () => void;
};

function useEnvio(onFeito: () => void, onFechar: () => void) {
  const { showError, showSuccess } = useNotification();
  const [enviando, setEnviando] = useState(false);
  const executar = async (
    acao: () => Promise<any>,
    sucesso: string,
    erro: string,
  ) => {
    setEnviando(true);
    try {
      const r = await acao();
      showSuccess(r?.aviso ? `${sucesso} ${r.aviso}` : sucesso);
      onFeito();
      onFechar();
    } catch (e) {
      showError(mensagemDeErro(e, erro));
    } finally {
      setEnviando(false);
    }
  };
  return { enviando, executar };
}

// ---------------- Receber ----------------

export function ReceberTitulo({
  api,
  titulo,
  onFechar,
  onFeito,
}: Props & { titulo: Titulo }) {
  const { multa, mora } = multaMora(titulo);
  const [f, setF] = useState({
    data: agoraLocal(),
    formapag: "dinheiro",
    fcartaobandeira: "",
    fcartaonumero: "",
    fchequebanco: "",
    fchequenumero: "",
    fchequeagcc: "",
    acrescimo: "0,00",
    multa_mora: "0,00",
    insnext: "nao",
    desconto: "0,00",
    valor: valorCampo(titulo.valorTotal),
  });
  const { enviando, executar } = useEnvio(onFeito, onFechar);
  const muda = (k: keyof typeof f) => (v: string) =>
    setF((a) => {
      const b = { ...a, [k]: v };
      // Valor pago acompanha acréscimo, multa/mora e desconto.
      if (["acrescimo", "multa_mora", "desconto"].includes(k)) {
        const total =
          titulo.valorTotal +
          (numeroDe(b.acrescimo) || 0) +
          (numeroDe(b.multa_mora) || 0) -
          (numeroDe(b.desconto) || 0);
        b.valor = valorCampo(Math.max(0, total));
      }
      return b;
    });

  return (
    <JanelaMk titulo={`Receber titulo ${n3(titulo.id)}`} onFechar={onFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(
            () => api.receber(titulo.id, f),
            `Título ${numeroTitulo(titulo.id)} recebido.`,
            "Erro ao receber o título.",
          );
        }}
      >
        <CampoMk rotulo="Data pagamento">
          <input
            type="datetime-local"
            className={inputMk}
            value={f.data}
            onChange={(e) => muda("data")(e.target.value)}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Forma pagamento">
          <select
            className={inputMk}
            value={f.formapag}
            onChange={(e) => muda("formapag")(e.target.value)}
          >
            <option value="dinheiro">Dinheiro</option>
            <option value="cheque">Cheque</option>
            <option value="cartao">Cartao</option>
            <option value="vale">Vale</option>
            <option value="outros">Outros</option>
          </select>
        </CampoMk>
        {f.formapag === "cartao" && (
          <div className="grid sm:grid-cols-2 gap-x-3">
            <CampoMk rotulo="Bandeira">
              <input
                className={inputMk}
                value={f.fcartaobandeira}
                onChange={(e) => muda("fcartaobandeira")(e.target.value)}
              />
            </CampoMk>
            <CampoMk rotulo="Numero / autorizacao">
              <input
                className={inputMk}
                value={f.fcartaonumero}
                onChange={(e) => muda("fcartaonumero")(e.target.value)}
              />
            </CampoMk>
          </div>
        )}
        {f.formapag === "cheque" && (
          <div className="grid sm:grid-cols-3 gap-x-3">
            <CampoMk rotulo="Banco">
              <input
                className={inputMk}
                value={f.fchequebanco}
                onChange={(e) => muda("fchequebanco")(e.target.value)}
              />
            </CampoMk>
            <CampoMk rotulo="Numero">
              <input
                className={inputMk}
                value={f.fchequenumero}
                onChange={(e) => muda("fchequenumero")(e.target.value)}
              />
            </CampoMk>
            <CampoMk rotulo="Agencia / conta">
              <input
                className={inputMk}
                value={f.fchequeagcc}
                onChange={(e) => muda("fchequeagcc")(e.target.value)}
              />
            </CampoMk>
          </div>
        )}
        <CampoMk rotulo="Acrescimo">
          <DinheiroMk
            value={f.acrescimo}
            onChange={(e) => muda("acrescimo")(e.target.value)}
          />
        </CampoMk>
        <CampoMk
          rotulo={`Multa ( ${reais(multa).replace(" ", "")} ) e Mora ( ${reais(mora).replace(" ", "")} )`}
        >
          <DinheiroMk
            value={f.multa_mora}
            onChange={(e) => muda("multa_mora")(e.target.value)}
          />
        </CampoMk>
        <CampoMk rotulo="Incluir juros/mora em outra mensalidade">
          <RadiosMk
            nome="insnext"
            valor={f.insnext}
            onChange={muda("insnext")}
            opcoes={[
              { valor: "sim", rotulo: "Sim" },
              { valor: "nao", rotulo: "Não" },
              { valor: "nada", rotulo: "Perdoar" },
            ]}
          />
        </CampoMk>
        <CampoMk rotulo="Desconto">
          <DinheiroMk
            value={f.desconto}
            onChange={(e) => muda("desconto")(e.target.value)}
          />
        </CampoMk>
        <CampoMk rotulo="Valor pago">
          <DinheiroMk
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })}
            required
          />
        </CampoMk>
        <BotoesMk rotulo="Receber" enviando={enviando} onCancelar={onFechar} />
      </form>
    </JanelaMk>
  );
}

// ---------------- Alterar ----------------

export function AlterarTitulo({
  api,
  titulo,
  onFechar,
  onFeito,
}: Props & { titulo: Titulo }) {
  const [f, setF] = useState({
    datavenc: dataIso(titulo.datavenc),
    tipo: titulo.tipo || "mensalidade",
    obs: titulo.obs || "",
    valor: valorCampo(titulo.valor),
    nota: "",
  });
  const { enviando, executar } = useEnvio(onFeito, onFechar);
  return (
    <JanelaMk titulo={`Alterar titulo ${n3(titulo.id)}`} onFechar={onFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(
            () => api.alterar(titulo.id, f),
            `Título ${numeroTitulo(titulo.id)} alterado.`,
            "Erro ao alterar o título.",
          );
        }}
      >
        <CampoMk rotulo="Vencimento">
          <input
            type="date"
            className={inputMk}
            value={f.datavenc}
            onChange={(e) => setF({ ...f, datavenc: e.target.value })}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Tipo">
          <select
            className={inputMk}
            value={f.tipo}
            onChange={(e) => setF({ ...f, tipo: e.target.value })}
          >
            <option value="mensalidade">mensalidade</option>
            <option value="servicos">serviços</option>
            <option value="outros">outros</option>
          </select>
        </CampoMk>
        <CampoMk rotulo="Descrição">
          <textarea
            className={`${inputMk} h-[56px] py-1`}
            value={f.obs}
            maxLength={255}
            onChange={(e) => setF({ ...f, obs: e.target.value })}
          />
        </CampoMk>
        <CampoMk rotulo="Valor">
          <DinheiroMk
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Nota">
          <textarea
            className={`${inputMk} h-[56px] py-1`}
            placeholder="# algum texto qualquer #"
            value={f.nota}
            onChange={(e) => setF({ ...f, nota: e.target.value })}
          />
        </CampoMk>
        <BotoesMk rotulo="Alterar" enviando={enviando} onCancelar={onFechar} />
      </form>
    </JanelaMk>
  );
}

// ---------------- Atrelar ----------------

export function AtrelarTitulo({
  api,
  titulo,
  onFechar,
  onFeito,
}: Props & { titulo: Titulo }) {
  const [f, setF] = useState({ tipo: "servicos", valor: "", descricao: "" });
  const { enviando, executar } = useEnvio(onFeito, onFechar);
  return (
    <JanelaMk
      titulo="Atrelar titulo / desconto"
      subtitulo={`atrelar titulo/desconto a mensalidade ${numeroTitulo(titulo.id)}`}
      onFechar={onFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(
            () => api.atrelar(titulo.id, f),
            "Lançamento atrelado.",
            "Erro ao atrelar.",
          );
        }}
      >
        <CampoMk rotulo="Tipo">
          <select
            className={inputMk}
            value={f.tipo}
            onChange={(e) => setF({ ...f, tipo: e.target.value })}
          >
            <option value="servicos">serviços</option>
            <option value="outros">outros</option>
            <option value="desconto">desconto</option>
          </select>
        </CampoMk>
        <CampoMk rotulo="Valor">
          <DinheiroMk
            placeholder="0,00"
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Descrição">
          <textarea
            className={`${inputMk} h-[56px] py-1`}
            maxLength={255}
            value={f.descricao}
            onChange={(e) => setF({ ...f, descricao: e.target.value })}
          />
        </CampoMk>
        <BotoesMk rotulo="Inserir" enviando={enviando} onCancelar={onFechar} />
      </form>
    </JanelaMk>
  );
}

// ---------------- Novo título ----------------

export function NovoTitulo({
  api,
  login,
  onFechar,
  onFeito,
}: Props & { login: string }) {
  const [f, setF] = useState({
    parcelas: "1",
    tipo: "mensalidade",
    vencimento: "",
    desconto: "0,00",
    acrescimo: "0,00",
    valor: "",
    descricao: "",
  });
  const { enviando, executar } = useEnvio(onFeito, onFechar);
  const { showError } = useNotification();

  useEffect(() => {
    api
      .sugestaoNovo(login)
      .then((s) =>
        setF((a) => ({
          ...a,
          vencimento: a.vencimento || s.vencimento,
          valor: a.valor || valorCampo(s.valor),
        })),
      )
      .catch((e) => showError(mensagemDeErro(e, "Erro ao carregar o plano.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login]);

  return (
    <JanelaMk titulo="NOVO TITULO" onFechar={onFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(
            () => api.novoTitulo(login, f),
            Number(f.parcelas) > 1 ? "Títulos criados." : "Título criado.",
            "Erro ao criar o título.",
          );
        }}
      >
        <CampoMk rotulo="Titulos">
          <select
            className={inputMk}
            value={f.parcelas}
            onChange={(e) => setF({ ...f, parcelas: e.target.value })}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i + 1}>
                {String(i + 1).padStart(2, "0")}
              </option>
            ))}
          </select>
        </CampoMk>
        <CampoMk rotulo="Tipo">
          <select
            className={inputMk}
            value={f.tipo}
            onChange={(e) => setF({ ...f, tipo: e.target.value })}
          >
            <option value="mensalidade">mensalidade</option>
            <option value="servicos">serviços</option>
            <option value="outros">outros</option>
          </select>
        </CampoMk>
        <CampoMk rotulo="Vencimento">
          <input
            type="date"
            className={inputMk}
            value={f.vencimento}
            onChange={(e) => setF({ ...f, vencimento: e.target.value })}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Desconto">
          <DinheiroMk
            value={f.desconto}
            onChange={(e) => setF({ ...f, desconto: e.target.value })}
          />
        </CampoMk>
        <CampoMk rotulo="Acrescimo">
          <DinheiroMk
            value={f.acrescimo}
            onChange={(e) => setF({ ...f, acrescimo: e.target.value })}
          />
        </CampoMk>
        <CampoMk rotulo="Valor">
          <DinheiroMk
            value={f.valor}
            onChange={(e) => setF({ ...f, valor: e.target.value })}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Descrição">
          <textarea
            className={`${inputMk} h-[56px] py-1`}
            placeholder="* *"
            maxLength={255}
            value={f.descricao}
            onChange={(e) => setF({ ...f, descricao: e.target.value })}
          />
        </CampoMk>
        <BotoesMk rotulo="Inserir" enviando={enviando} onCancelar={onFechar} />
      </form>
    </JanelaMk>
  );
}

// ---------------- Notas ----------------

export function NotasTitulo({
  api,
  titulo,
  onFechar,
  onFeito,
}: Props & { titulo: Titulo }) {
  const [notas, setNotas] = useState<any[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { showError } = useNotification();

  const carregar = () =>
    api
      .notas(titulo.id)
      .then(setNotas)
      .catch((e) => showError(mensagemDeErro(e, "Erro ao carregar notas.")));
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo.id]);

  return (
    <JanelaMk
      titulo={`Notas do titulo ${n3(titulo.id)}`}
      subtitulo="ficam no Wip Diversos (as notas de dentro do MK-Auth não aparecem aqui)"
      onFechar={onFechar}
      largura={700}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setEnviando(true);
          try {
            await api.adicionarNota(titulo.id, texto);
            setTexto("");
            await carregar();
            onFeito();
          } catch (err) {
            showError(mensagemDeErro(err, "Erro ao salvar a nota."));
          } finally {
            setEnviando(false);
          }
        }}
      >
        <CampoMk rotulo="Nova nota">
          <textarea
            className={`${inputMk} h-[70px] py-1`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required
          />
        </CampoMk>
        <BotoesMk rotulo="Salvar" enviando={enviando} onCancelar={onFechar} />
      </form>
      <div className="mt-5">
        {notas === null && <p>Carregando...</p>}
        {notas?.length === 0 && <p className="text-[15px]">Nenhuma nota.</p>}
        {notas?.map((n) => (
          <div key={n.id} className="border-t border-[#ededed] py-2">
            <div className="text-[12px] font-bold text-[#7a7a7a]">
              {new Date(n.criado_em).toLocaleString("pt-BR")} · {n.usuario}
            </div>
            <div className="whitespace-pre-wrap text-[15px]">{n.texto}</div>
          </div>
        ))}
      </div>
    </JanelaMk>
  );
}

// ---------------- Informações ----------------

function LinhaInfo({ a, b, c, d }: { a: string; b: any; c?: string; d?: any }) {
  return (
    <tr className="border-b border-[#ededed]">
      <td className="px-2 py-2 font-bold w-[16%] align-top">{a}</td>
      <td className="px-2 py-2 w-[34%] align-top">{b}</td>
      <td className="px-2 py-2 font-bold w-[16%] align-top">{c}</td>
      <td className="px-2 py-2 align-top">{d}</td>
    </tr>
  );
}

function FaixaInfo({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <>
      <div className="bg-[#00d1b2] text-white font-bold px-2 py-2 mt-3 text-[14px]">
        {titulo}
      </div>
      <div className="px-2 py-2 text-[13px] border-b border-[#ededed] font-serif">
        {sub}
      </div>
    </>
  );
}

export function InfoTitulo({
  api,
  tituloId,
  onFechar,
}: {
  api: ApiMensalidades;
  tituloId: number;
  onFechar: () => void;
}) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    api
      .info(tituloId)
      .then(setD)
      .catch((e) => setErro(mensagemDeErro(e, "Erro ao carregar.")));
  }, [api, tituloId]);
  const t = d?.titulo;
  const c = d?.cliente;
  const z = (n: number) => String(n).padStart(5, "0");
  return (
    <JanelaMk titulo={`Titulo ${n3(tituloId)}`} onFechar={onFechar} largura={1100}>
      {erro && <p>{erro}</p>}
      {!d && !erro && <p>Carregando...</p>}
      {t && (
        <div className="text-[14px] overflow-x-auto">
          <FaixaInfo titulo="Dados do titulo" sub="informações do titulo" />
          <table className="w-full">
            <tbody>
              <LinhaInfo a="ID Universal:" b={t.uuid_lanc} />
              <LinhaInfo
                a="Processamento:"
                b={dataCurta(t.processamento)}
                c="Vencimento:"
                d={`${dataCurta(t.datavenc)} - ${t.referencia || ""}`}
              />
              <LinhaInfo
                a="Pagamento:"
                b={dataCurta(t.datapag)}
                c="Nosso:"
                d={t.nossonum}
              />
              <LinhaInfo
                a="Valor:"
                b={reais(t.valor)}
                c="Valor pago:"
                d={t.valorpag ? reais(t.valorpag) : "R$"}
              />
              <LinhaInfo a="Tipo:" b={t.tipo} c="Gerou:" d={t.usergerou} />
              <LinhaInfo a="Coletor:" b={t.coletor} c="Observação:" d={t.obs} />
              <LinhaInfo a="Linha digitavel:" b={t.linhadig} />
            </tbody>
          </table>
          {c && (
            <>
              <FaixaInfo
                titulo="Dados pessoais do cliente"
                sub="informações pessoais do cliente"
              />
              <table className="w-full">
                <tbody>
                  <LinhaInfo
                    a="Nome:"
                    b={c.nome}
                    c="Endereco:"
                    d={`${c.endereco || ""} ${c.numero || ""}`}
                  />
                  <LinhaInfo
                    a="Codigo:"
                    b={c.codigo}
                    c="Complemento:"
                    d={c.complemento}
                  />
                  <LinhaInfo
                    a="CPF:"
                    b={c.cpf_cnpj ?? "(só administrador)"}
                    c="Bairro:"
                    d={c.bairro}
                  />
                  <LinhaInfo
                    a="E-Mail:"
                    b={c.email}
                    c="Cidade:"
                    d={`${c.cidade || ""} - ${c.estado || ""}`}
                  />
                  <LinhaInfo a="Telefone:" b={c.fone} />
                  <LinhaInfo
                    a="Celular:"
                    b={[c.celular, c.opcelular, c.celular2].filter(Boolean).join(" / ")}
                  />
                  <LinhaInfo a="Cadastro:" b={c.cadastro} c="Grupo:" d={c.grupo} />
                  <LinhaInfo a="SSID:" b={c.ssid} c="Equipamento:" d={c.equipamento} />
                </tbody>
              </table>
            </>
          )}
          <FaixaInfo
            titulo="Dados financeiros do cliente"
            sub="informações de titulos do cliente"
          />
          <table className="w-full">
            <tbody>
              <LinhaInfo
                a="Total:"
                b={z(d.resumo.total)}
                c="Pagos:"
                d={z(d.resumo.pagos)}
              />
              <LinhaInfo
                a="Em dia:"
                b={z(d.resumo.emDia)}
                c="Vencidos:"
                d={z(d.resumo.vencidos)}
              />
            </tbody>
          </table>
        </div>
      )}
    </JanelaMk>
  );
}

// ---------------- Enviar ----------------

export function EnviarTitulos({
  api,
  detalhe,
  titulos,
  onFechar,
}: {
  api: ApiMensalidades;
  detalhe: Detalhe;
  titulos: Titulo[];
  onFechar: () => void;
}) {
  const { cliente, provedor } = detalhe;
  const { showError } = useNotification();
  const [f, setF] = useState({
    assunto: `${provedor?.nome || "Wip Telecom"} - ${titulos.length > 1 ? "seus títulos" : `título ${numeroTitulo(titulos[0]?.id || 0)}`}`,
    mensagem: "",
  });
  const [anexarPdf, setAnexarPdf] = useState(true);
  const emAberto = titulos.filter((t) => t.status !== "pago").map((t) => t.id);
  const [preparando, setPreparando] = useState(true);
  const { enviando, executar } = useEnvio(() => {}, onFechar);

  // Títulos em aberto vão com o bolix da Efí (gera se ainda não existir).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const blocos: string[] = [];
      for (const t of titulos) {
        const pago = t.status === "pago";
        const partes = [
          `Título ${numeroTitulo(t.id)} - ${t.tipo || ""} - vencimento ${dataCurta(t.datavenc)} - ${reais(pago ? t.valorpag : t.valorTotal)}${pago ? ` (pago em ${dataCurta(t.datapag)})` : ""}`,
        ];
        if (!pago) {
          try {
            const b = await api.bolix(t.id);
            if (b.link) partes.push(`Boleto: ${b.link}`);
            if (b.linha_digitavel)
              partes.push(`Linha digitável: ${b.linha_digitavel}`);
            if (b.pix_copia_cola)
              partes.push(`Pix copia e cola: ${b.pix_copia_cola}`);
          } catch (e) {
            showError(
              mensagemDeErro(e, `Boleto do título ${numeroTitulo(t.id)} não gerado.`),
            );
          }
        }
        blocos.push(partes.join("\n"));
      }
      if (cancelado) return;
      setF((a) => ({
        ...a,
        mensagem: `Olá, ${cliente.nome}.\n\n${blocos.join("\n\n")}\n\nQualquer dúvida, estamos à disposição.\n${provedor?.nome || ""}`,
      }));
      setPreparando(false);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (preparando)
    return (
      <JanelaMk titulo="Enviar mensagem" onFechar={onFechar}>
        <p className="py-4">Gerando os boletos na Efí...</p>
      </JanelaMk>
    );
  return (
    <JanelaMk
      titulo="Enviar mensagem"
      subtitulo={`${String(titulos.length).padStart(3, "0")} Titulos · por e-mail para ${cliente.email || "(cliente sem e-mail)"}`}
      onFechar={onFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          executar(
            () =>
              api.enviar(cliente.login, {
                ...f,
                anexarPdf: anexarPdf && emAberto.length > 0,
                titulos: emAberto,
              }),
            "E-mail enviado.",
            "Erro ao enviar.",
          );
        }}
      >
        <CampoMk rotulo="Tipo de mensagem">
          <select className={inputMk} disabled value="email">
            <option value="email">E-mail</option>
          </select>
        </CampoMk>
        <CampoMk rotulo="Assunto">
          <input
            className={inputMk}
            value={f.assunto}
            onChange={(e) => setF({ ...f, assunto: e.target.value })}
            required
          />
        </CampoMk>
        <CampoMk rotulo="Mensagem">
          <textarea
            className={`${inputMk} h-[260px] py-1`}
            value={f.mensagem}
            onChange={(e) => setF({ ...f, mensagem: e.target.value })}
            required
          />
        </CampoMk>
        {emAberto.length > 0 && (
          <label className="flex items-center gap-2 text-[15px] cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={anexarPdf}
              onChange={(e) => setAnexarPdf(e.target.checked)}
            />
            Anexar o PDF {emAberto.length > 1 ? "dos boletos" : "do boleto"} no e-mail
          </label>
        )}
        <BotoesMk rotulo="Enviar" enviando={enviando} onCancelar={onFechar} />
      </form>
    </JanelaMk>
  );
}

// ---------------- Confirmar ----------------

export function Confirmar({
  titulo,
  texto,
  rotulo,
  onConfirmar,
  onFechar,
}: {
  titulo: string;
  texto: React.ReactNode;
  rotulo: string;
  onConfirmar: () => Promise<void>;
  onFechar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  return (
    <JanelaMk titulo={titulo} onFechar={onFechar} largura={560}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setEnviando(true);
          try {
            await onConfirmar();
          } finally {
            setEnviando(false);
          }
        }}
      >
        <div className="text-[15px] py-2">{texto}</div>
        <BotoesMk
          rotulo={rotulo}
          enviando={enviando}
          onCancelar={onFechar}
          perigo
        />
      </form>
    </JanelaMk>
  );
}
