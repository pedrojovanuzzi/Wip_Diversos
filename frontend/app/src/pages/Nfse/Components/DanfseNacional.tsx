// DanfseNacional.tsx
import React from "react";
import { QRCodeSVG } from "qrcode.react";
import logo from "../../../assets/icon.png";

/**
 * DANFSe (Documento Auxiliar da NFS-e) montado a partir do XML da NFS-e
 * nacional devolvido pela API — o mesmo conteúdo do PDF do portal, sem
 * depender dele estar no ar.
 */

interface DanfseNacionalProps {
  xml: string;
  /** Nota no formato antigo: só para cidade/UF do tomador (resolvidas pelo IBGE). */
  dados?: any;
  cancelada?: boolean;
}

const URL_CONSULTA_PUBLICA =
  "https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=";

const TRIBUTACAO_ISSQN: Record<string, string> = {
  "1": "Operação tributável",
  "2": "Imunidade",
  "3": "Exportação de serviço",
  "4": "Não incidência",
};

const RETENCAO_ISSQN: Record<string, string> = {
  "1": "Não retido",
  "2": "Retido pelo tomador",
  "3": "Retido pelo intermediário",
};

const SIMPLES_NACIONAL: Record<string, string> = {
  "1": "Não optante",
  "2": "Optante - Microempreendedor Individual (MEI)",
  "3": "Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)",
};

const REGIME_APURACAO_SN: Record<string, string> = {
  "1": "Tributos federais e municipal pelo Simples Nacional",
  "2": "Federais pelo SN e ISSQN fora do Simples Nacional",
  "3": "Federais e municipal fora do Simples Nacional",
};

const REGIME_ESPECIAL: Record<string, string> = {
  "0": "Nenhum",
  "1": "Ato cooperado",
  "2": "Estimativa",
  "3": "Microempresa municipal",
  "4": "Notário ou registrador",
  "5": "Profissional autônomo",
  "6": "Sociedade de profissionais",
  "9": "Outros",
};

/** Filho direto pelo nome local (ignora namespace). */
function filho(pai: Element | null | undefined, nome: string): Element | null {
  if (!pai) return null;
  for (const c of Array.from(pai.children)) {
    if (c.localName === nome) return c;
  }
  return null;
}

/** Desce pelo caminho de filhos diretos e devolve o texto. */
function valor(pai: Element | null | undefined, ...caminho: string[]): string {
  let atual = pai ?? null;
  for (const nome of caminho) atual = filho(atual, nome);
  return atual?.textContent?.trim() || "";
}

/** Primeiro descendente com o nome (para trechos opcionais e aninhados). */
function achar(pai: Element | null | undefined, nome: string): Element | null {
  if (!pai) return null;
  return pai.getElementsByTagNameNS("*", nome)[0] ?? null;
}

function dinheiro(v: string): string {
  if (v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : v;
}

function percentual(v: string): string {
  if (v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n)
    ? `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`
    : v;
}

function documento(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v || "-";
}

function cep(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : v || "-";
}

function telefone(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 11)
    return d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (d.length === 10)
    return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return v || "-";
}

function data(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v || "-";
}

function dataHora(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : v || "-";
}

/** Chave em blocos de 4, como no DANFSe, para conferir a olho. */
function chaveEmBlocos(chave: string): string {
  return chave.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function endereco(e: Element | null | undefined): string {
  if (!e) return "-";
  const partes = [
    valor(e, "xLgr"),
    valor(e, "nro"),
    valor(e, "xCpl"),
    valor(e, "xBairro"),
  ].filter(Boolean);
  return partes.join(", ") || "-";
}

const Campo = ({
  rotulo,
  children,
  className = "",
}: {
  rotulo: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`px-1.5 py-0.5 ${className}`}>
    <div className="text-[7px] font-semibold uppercase leading-tight text-gray-600">
      {rotulo}
    </div>
    <div className="break-words text-[9px] leading-tight text-black">
      {children || "-"}
    </div>
  </div>
);

const Secao = ({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) => (
  <div className="border-t border-black">
    <div className="bg-gray-200 px-1.5 py-0.5 text-[8px] font-bold uppercase">
      {titulo}
    </div>
    {children}
  </div>
);

export default function DanfseNacional({
  xml,
  dados,
  cancelada,
}: DanfseNacionalProps) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const nfse = doc.documentElement;
  const inf = filho(nfse, "infNFSe");
  const infDps = filho(filho(inf, "DPS"), "infDPS");

  if (!inf || !infDps) {
    return (
      <div className="p-4 text-sm text-red-700">
        Não foi possível ler o XML da NFS-e.
      </div>
    );
  }

  const chave = (inf.getAttribute("Id") || "").replace(/^NFS/, "");
  const homologacao = valor(infDps, "tpAmb") === "2";

  // Emitente (dados da nota) e prestador (dados declarados na DPS).
  const emit = filho(inf, "emit");
  const enderEmit = filho(emit, "enderNac");
  const prest = filho(infDps, "prest");
  const regTrib = filho(prest, "regTrib");

  const toma = filho(infDps, "toma");
  const endToma = filho(toma, "end");
  const tomadorCidade =
    dados?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico
      ?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco;

  const serv = filho(infDps, "serv");
  const cServ = filho(serv, "cServ");

  const valoresDps = filho(infDps, "valores");
  const valoresNota = filho(inf, "valores");
  const tribMun = achar(valoresDps, "tribMun");
  const tribFed = achar(valoresDps, "tribFed");
  const totTrib = achar(valoresDps, "totTrib");
  const descontos = achar(valoresDps, "vDescCondIncond");

  const vServ = valor(filho(valoresDps, "vServPrest"), "vServ");
  const retido =
    valor(tribMun, "tpRetISSQN") !== "1" && !!valor(tribMun, "tpRetISSQN");

  const totaisAproximados = (() => {
    const sn = valor(totTrib, "pTotTribSN");
    if (sn) return `${percentual(sn)} (Simples Nacional)`;
    const pTot = filho(totTrib, "pTotTrib");
    if (pTot) {
      return [
        `Federal ${percentual(valor(pTot, "pTotTribFed"))}`,
        `Estadual ${percentual(valor(pTot, "pTotTribEst"))}`,
        `Municipal ${percentual(valor(pTot, "pTotTribMun"))}`,
      ].join(" · ");
    }
    return "-";
  })();

  return (
    <div className="danfse relative mx-auto w-full max-w-[200mm] break-after-page border border-black bg-white font-sans text-black">
      {(cancelada || homologacao) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            style={{ transform: "rotate(-30deg)" }}
            className="select-none text-center text-5xl font-extrabold uppercase text-red-600/25"
          >
            {cancelada ? "NFS-e cancelada" : "Sem validade jurídica"}
          </span>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center gap-2 p-1.5">
        <img src={logo} alt="" className="h-12 w-auto" />
        <div className="flex-1 text-center">
          <div className="text-sm font-bold">DANFSe v1.0</div>
          <div className="text-[9px]">Documento Auxiliar da NFS-e</div>
          <div className="text-[9px] font-semibold">
            {valor(inf, "xLocEmi") || "-"}
            {homologacao && " · Ambiente de homologação"}
          </div>
        </div>
        {chave && (
          <div className="flex flex-col items-center">
            <QRCodeSVG value={URL_CONSULTA_PUBLICA + chave} size={64} />
            <span className="mt-0.5 max-w-[90px] text-center text-[6px] leading-tight">
              Consulte a autenticidade em nfse.gov.br
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 border-t border-black">
        <Campo
          rotulo="Chave de acesso da NFS-e"
          className="col-span-4 font-mono"
        >
          {chaveEmBlocos(chave)}
        </Campo>
      </div>
      <div className="grid grid-cols-4 border-t border-black">
        <Campo rotulo="Número da NFS-e">{valor(inf, "nNFSe")}</Campo>
        <Campo rotulo="Competência da NFS-e">
          {data(valor(infDps, "dCompet"))}
        </Campo>
        <Campo rotulo="Data e hora da emissão da NFS-e" className="col-span-2">
          {dataHora(valor(inf, "dhProc"))}
        </Campo>
        <Campo rotulo="Número da DPS">{valor(infDps, "nDPS")}</Campo>
        <Campo rotulo="Série da DPS">{valor(infDps, "serie")}</Campo>
        <Campo rotulo="Data e hora da emissão da DPS" className="col-span-2">
          {dataHora(valor(infDps, "dhEmi"))}
        </Campo>
      </div>

      <Secao titulo="Emitente da NFS-e · Prestador do serviço">
        <div className="grid grid-cols-4">
          <Campo rotulo="CNPJ / CPF">
            {documento(valor(emit, "CNPJ") || valor(emit, "CPF"))}
          </Campo>
          <Campo rotulo="Inscrição municipal">
            {valor(emit, "IM") || valor(prest, "IM")}
          </Campo>
          <Campo rotulo="Telefone">
            {telefone(valor(emit, "fone") || valor(prest, "fone"))}
          </Campo>
          <Campo rotulo="E-mail">
            {valor(emit, "email") || valor(prest, "email")}
          </Campo>
          <Campo rotulo="Nome / Nome empresarial" className="col-span-2">
            {valor(emit, "xNome")}
          </Campo>
          <Campo rotulo="Endereço" className="col-span-2">
            {endereco(enderEmit)}
          </Campo>
          <Campo rotulo="Município">
            {[valor(inf, "xLocEmi"), valor(enderEmit, "UF")]
              .filter(Boolean)
              .join(" - ")}
          </Campo>
          <Campo rotulo="CEP">{cep(valor(enderEmit, "CEP"))}</Campo>
          <Campo
            rotulo="Simples Nacional na data de competência"
            className="col-span-2"
          >
            {SIMPLES_NACIONAL[valor(regTrib, "opSimpNac")] ||
              valor(regTrib, "opSimpNac")}
          </Campo>
          <Campo
            rotulo="Regime de apuração tributária pelo SN"
            className="col-span-4"
          >
            {REGIME_APURACAO_SN[valor(regTrib, "regApTribSN")] ||
              valor(regTrib, "regApTribSN")}
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Tomador do serviço">
        <div className="grid grid-cols-4">
          <Campo rotulo="CNPJ / CPF">
            {documento(valor(toma, "CNPJ") || valor(toma, "CPF"))}
          </Campo>
          <Campo rotulo="Inscrição municipal">{valor(toma, "IM")}</Campo>
          <Campo rotulo="Telefone">{telefone(valor(toma, "fone"))}</Campo>
          <Campo rotulo="E-mail">{valor(toma, "email")}</Campo>
          <Campo rotulo="Nome / Nome empresarial" className="col-span-2">
            {valor(toma, "xNome")}
          </Campo>
          <Campo rotulo="Endereço" className="col-span-2">
            {endereco(endToma)}
          </Campo>
          <Campo rotulo="Município">
            {[tomadorCidade?.Cidade, tomadorCidade?.Uf]
              .filter(Boolean)
              .join(" - ") || valor(filho(endToma, "endNac"), "cMun")}
          </Campo>
          <Campo rotulo="CEP">
            {cep(valor(filho(endToma, "endNac"), "CEP"))}
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Intermediário do serviço">
        <div className="px-1.5 py-0.5 text-[9px]">
          {filho(infDps, "interm")
            ? documento(
                valor(filho(infDps, "interm"), "CNPJ") ||
                  valor(filho(infDps, "interm"), "CPF"),
              )
            : "NÃO IDENTIFICADO NA NFS-e"}
        </div>
      </Secao>

      <Secao titulo="Serviço prestado">
        <div className="grid grid-cols-4">
          <Campo rotulo="Código de tributação nacional" className="col-span-2">
            {[valor(cServ, "cTribNac"), valor(inf, "xTribNac")]
              .filter(Boolean)
              .join(" - ")}
          </Campo>
          <Campo rotulo="Código de tributação municipal">
            {[valor(cServ, "cTribMun"), valor(inf, "xTribMun")]
              .filter(Boolean)
              .join(" - ")}
          </Campo>
          <Campo rotulo="Local da prestação">
            {valor(inf, "xLocPrestacao")}
          </Campo>
          <Campo
            rotulo="Descrição do serviço"
            className="col-span-4 min-h-[48px] whitespace-pre-wrap"
          >
            {valor(cServ, "xDescServ")}
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Tributação municipal">
        <div className="grid grid-cols-4">
          <Campo rotulo="Tributação do ISSQN">
            {TRIBUTACAO_ISSQN[valor(tribMun, "tribISSQN")] ||
              valor(tribMun, "tribISSQN")}
          </Campo>
          <Campo rotulo="Município de incidência do ISSQN">
            {valor(inf, "xLocIncid")}
          </Campo>
          <Campo rotulo="Regime especial de tributação">
            {REGIME_ESPECIAL[valor(regTrib, "regEspTrib")] ||
              valor(regTrib, "regEspTrib")}
          </Campo>
          <Campo rotulo="Retenção do ISSQN">
            {RETENCAO_ISSQN[valor(tribMun, "tpRetISSQN")] ||
              valor(tribMun, "tpRetISSQN")}
          </Campo>
          <Campo rotulo="Valor do serviço">{dinheiro(vServ)}</Campo>
          <Campo rotulo="Desconto incondicionado">
            {dinheiro(valor(descontos, "vDescIncond") || "0")}
          </Campo>
          <Campo rotulo="Total deduções/reduções">
            {dinheiro(valor(valoresNota, "vCalcDR") || "0")}
          </Campo>
          <Campo rotulo="Base de cálculo">
            {dinheiro(valor(valoresNota, "vBC"))}
          </Campo>
          <Campo rotulo="Alíquota aplicada">
            {percentual(valor(valoresNota, "pAliqAplic"))}
          </Campo>
          <Campo rotulo="ISSQN apurado">
            {dinheiro(valor(valoresNota, "vISSQN"))}
          </Campo>
          <Campo rotulo="ISSQN retido">
            {dinheiro(retido ? valor(valoresNota, "vISSQN") : "0")}
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Tributação federal">
        <div className="grid grid-cols-5">
          <Campo rotulo="IRRF">
            {dinheiro(valor(tribFed, "vRetIRRF") || "0")}
          </Campo>
          <Campo rotulo="Contribuição previdenciária">
            {dinheiro(valor(tribFed, "vRetCP") || "0")}
          </Campo>
          <Campo rotulo="CSLL">
            {dinheiro(valor(tribFed, "vRetCSLL") || "0")}
          </Campo>
          <Campo rotulo="PIS">
            {dinheiro(valor(achar(tribFed, "piscofins"), "vPis") || "0")}
          </Campo>
          <Campo rotulo="COFINS">
            {dinheiro(valor(achar(tribFed, "piscofins"), "vCofins") || "0")}
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Valor total da NFS-e">
        <div className="grid grid-cols-4">
          <Campo rotulo="Valor do serviço">{dinheiro(vServ)}</Campo>
          <Campo rotulo="Desconto condicionado">
            {dinheiro(valor(descontos, "vDescCond") || "0")}
          </Campo>
          <Campo rotulo="Total das retenções">
            {dinheiro(valor(valoresNota, "vTotalRet") || "0")}
          </Campo>
          <Campo rotulo="Valor líquido da NFS-e" className="font-bold">
            <span className="text-[11px] font-bold">
              {dinheiro(valor(valoresNota, "vLiq"))}
            </span>
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Totais aproximados dos tributos">
        <div className="px-1.5 py-0.5 text-[9px]">{totaisAproximados}</div>
      </Secao>

      <Secao titulo="Informações complementares">
        <div className="min-h-[24px] whitespace-pre-wrap px-1.5 py-0.5 text-[9px]">
          {[
            valor(achar(serv, "infoCompl"), "xInfComp"),
            valor(cServ, "cNBS") && `NBS: ${valor(cServ, "cNBS")}`,
          ]
            .filter(Boolean)
            .join("\n") || "-"}
        </div>
      </Secao>
    </div>
  );
}
