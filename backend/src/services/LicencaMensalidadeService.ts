import EfiPay from "sdk-node-apis-efi";
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";

import LocalDataSource from "../database/DataSource";
import { LicencaEntity } from "../entities/LicencaEntities";
import { LicencaMensalidade } from "../entities/LicencaMensalidade";
import { LicencaMensalidadeConfig } from "../entities/LicencaMensalidadeConfig";
import nfseController from "../controller/NFSE";
import { NFSE } from "../entities/NFSE";

dotenv.config();

const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

const options = {
  sandbox: isSandbox,
  client_id: isSandbox
    ? process.env.CLIENT_ID_HOMOLOGACAO!
    : process.env.CLIENT_ID!,
  client_secret: isSandbox
    ? process.env.CLIENT_SECRET_HOMOLOGACAO!
    : process.env.CLIENT_SECRET!,
  certificate: isSandbox
    ? path.resolve("src", "files", process.env.CERTIFICATE_SANDBOX!)
    : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};

/**
 * Marca que identifica, no próprio Pix, que a cobrança é de licença.
 *
 * O webhook do Pix é um só para a chave inteira, e ele baixa mensalidade de
 * internet quando encontra o par "ID"/"VALOR" nas informações adicionais. A
 * cobrança de licença não leva esse par: leva esta marca, e o webhook desvia
 * para cá antes de tocar no MKAuth.
 */
export const INFO_LICENCA = "LICENCA";

export interface ResumoGeracaoMensalidades {
  competencia: string;
  softwares: number;
  criadas: number;
  jaExistiam: number;
  semConfiguracao: string[];
}

/** Competência (AAAA-MM) de uma data. */
function competenciaDe(data = new Date()): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${data.getFullYear()}-${mes}`;
}

/** Data de vencimento da competência, respeitando meses mais curtos. */
function vencimentoDaCompetencia(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaFinal = Math.min(Math.max(Number(dia) || 1, 1), ultimoDia);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

/**
 * Mensalidades das licenças de software.
 *
 * Tudo aqui é separado do MKAuth de propósito: mensalidade de internet é do
 * MKAuth, mensalidade de licença é deste sistema. O único ponto de contato é o
 * webhook do Pix, e ele decide pelo lado certo olhando a marca da cobrança.
 */
class LicencaMensalidadeService {
  private licencaRepo = LocalDataSource.getRepository(LicencaEntity);
  private mensalidadeRepo = LocalDataSource.getRepository(LicencaMensalidade);
  private configRepo = LocalDataSource.getRepository(LicencaMensalidadeConfig);

  // ---------------------------------------------------------------------
  // Configuração por software
  // ---------------------------------------------------------------------

  /** Configurações salvas, junto dos softwares que ainda não têm regra. */
  async listarConfiguracoes() {
    const configs = await this.configRepo.find({ order: { software: "ASC" } });

    const softwaresEmUso: { software: string; total: string }[] =
      await this.licencaRepo
        .createQueryBuilder("l")
        .select("l.software", "software")
        .addSelect("COUNT(*)", "total")
        .where("l.software IS NOT NULL AND l.software <> ''")
        .groupBy("l.software")
        .getRawMany();

    const configurados = new Set(configs.map((c) => c.software));

    return {
      configuracoes: configs,
      softwaresSemConfiguracao: softwaresEmUso
        .filter((s) => !configurados.has(s.software))
        .map((s) => ({ software: s.software, licencas: Number(s.total) })),
    };
  }

  /** Cria ou atualiza a regra de um software. */
  async salvarConfiguracao(dados: {
    software: string;
    diaVencimento: number;
    gerarTodoMes: boolean;
    valor: number | string;
    ativo?: boolean;
    observacao?: string | null;
  }) {
    const software = String(dados.software || "").trim();
    if (!software) throw new Error("Informe o software.");

    const dia = Number(dados.diaVencimento);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      throw new Error("O dia do vencimento precisa ser entre 1 e 31.");
    }

    const valor = Number(String(dados.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error("Valor da mensalidade inválido.");
    }

    let config = await this.configRepo.findOne({ where: { software } });
    if (!config) config = this.configRepo.create({ software });

    config.diaVencimento = dia;
    config.gerarTodoMes = !!dados.gerarTodoMes;
    config.valor = valor.toFixed(2);
    config.ativo = dados.ativo === undefined ? true : !!dados.ativo;
    config.observacao = dados.observacao ?? null;

    return this.configRepo.save(config);
  }

  async removerConfiguracao(id: number) {
    await this.configRepo.delete(id);
  }

  // ---------------------------------------------------------------------
  // Geração das mensalidades
  // ---------------------------------------------------------------------

  /**
   * Gera as mensalidades do mês para cada licença ativa cujo software tem
   * regra com "gerar todo mês".
   *
   * Pode rodar quantas vezes quiser: a mensalidade é única por licença e
   * competência, então repetir não duplica.
   */
  async gerarMensalidades(
    competencia = competenciaDe(),
  ): Promise<ResumoGeracaoMensalidades> {
    const resumo: ResumoGeracaoMensalidades = {
      competencia,
      softwares: 0,
      criadas: 0,
      jaExistiam: 0,
      semConfiguracao: [],
    };

    let configs: LicencaMensalidadeConfig[] = [];
    try {
      configs = await this.configRepo.find({
        where: { ativo: true, gerarTodoMes: true },
      });
    } catch (erro: any) {
      // Tabela ainda não criada: avisa em uma linha em vez de derrubar o boot.
      if (erro?.code === "ER_NO_SUCH_TABLE" || erro?.errno === 1146) {
        console.warn(
          "⚠️ Mensalidades de licença: tabelas ainda não existem. Rode 'npm run migration:run'.",
        );
        return resumo;
      }
      throw erro;
    }
    resumo.softwares = configs.length;

    for (const config of configs) {
      const licencas = await this.licencaRepo.find({
        where: { software: config.software, status: "ativo" },
      });

      const vencimento = vencimentoDaCompetencia(
        competencia,
        config.diaVencimento,
      );

      for (const licenca of licencas) {
        const existente = await this.mensalidadeRepo.findOne({
          where: { licencaId: licenca.id, competencia },
        });
        if (existente) {
          resumo.jaExistiam++;
          continue;
        }

        const mensalidade = this.mensalidadeRepo.create({
          licencaId: licenca.id,
          software: licenca.software,
          clienteNome: licenca.cliente_nome,
          competencia,
          vencimento,
          valor: config.valor,
          status: "aberta",
        });
        await this.mensalidadeRepo.save(mensalidade);
        resumo.criadas++;
      }
    }

    // Softwares com licença ativa e sem regra nenhuma: ficam de fora, e é bom
    // isso aparecer na tela em vez de sumir em silêncio.
    const { softwaresSemConfiguracao } = await this.listarConfiguracoes();
    resumo.semConfiguracao = softwaresSemConfiguracao.map((s) => s.software);

    console.log("📋 Mensalidades de licença:", resumo);
    return resumo;
  }

  /** Mensalidades com filtro opcional de competência, status e software. */
  async listarMensalidades(filtros: {
    competencia?: string;
    status?: string;
    software?: string;
    licencaId?: number;
  }) {
    const query = this.mensalidadeRepo
      .createQueryBuilder("m")
      .orderBy("m.vencimento", "DESC")
      .addOrderBy("m.id", "DESC");

    if (filtros.competencia)
      query.andWhere("m.competencia = :competencia", {
        competencia: filtros.competencia,
      });
    if (filtros.status && filtros.status !== "todos")
      query.andWhere("m.status = :status", { status: filtros.status });
    if (filtros.software)
      query.andWhere("m.software = :software", { software: filtros.software });
    if (filtros.licencaId)
      query.andWhere("m.licenca_id = :licencaId", {
        licencaId: filtros.licencaId,
      });

    return query.getMany();
  }

  // ---------------------------------------------------------------------
  // Pix
  // ---------------------------------------------------------------------

  /**
   * Cobrança Pix de uma mensalidade de licença.
   *
   * Vai sem o par "ID"/"VALOR" nas informações adicionais — é justamente esse
   * par que o webhook usa para baixar mensalidade de internet no MKAuth.
   */
  async gerarPix(mensalidadeId: number) {
    const mensalidade = await this.mensalidadeRepo.findOne({
      where: { id: mensalidadeId },
    });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");
    if (mensalidade.status === "paga")
      throw new Error("Esta mensalidade já está paga.");

    const efipay = new EfiPay(options);
    const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });
    const qr = await efipay.pixGenerateQRCode({ id: loc.id });

    const params = { txid: crypto.randomBytes(16).toString("hex") };
    const body = {
      calendario: { expiracao: 86400 },
      chave: String(process.env.CHAVE_PIX),
      valor: { original: Number(mensalidade.valor).toFixed(2) },
      solicitacaoPagador:
        `Licenca ${mensalidade.software ?? ""} ${mensalidade.competencia}`.trim(),
      infoAdicionais: [
        { nome: INFO_LICENCA, valor: String(mensalidade.id) },
        { nome: "QR", valor: String(qr.linkVisualizacao) },
      ],
      loc: { id: loc.id },
    };

    await efipay.pixCreateCharge(params, body);

    mensalidade.txid = params.txid;
    mensalidade.pixCopiaCola = qr.qrcode ?? null;
    mensalidade.pixLink = qr.linkVisualizacao ?? null;
    await this.mensalidadeRepo.save(mensalidade);

    return mensalidade;
  }

  /**
   * Baixa vinda do webhook do Pix. Recebe o id da mensalidade que estava na
   * marca da cobrança, então não há como confundir com fatura de internet.
   */
  async baixarPorPix(dados: {
    mensalidadeId: number;
    txid?: string;
    valorPago?: string | number;
    endToEndId?: string;
    horario?: Date;
  }) {
    const mensalidade = await this.mensalidadeRepo.findOne({
      where: { id: Number(dados.mensalidadeId) },
    });
    if (!mensalidade) return null;

    // Pix repetido não mexe em nada que já foi baixado.
    if (mensalidade.status === "paga") return mensalidade;

    mensalidade.status = "paga";
    mensalidade.formaPagamento = "pix";
    mensalidade.valorPago =
      dados.valorPago !== undefined
        ? Number(String(dados.valorPago).replace(",", ".")).toFixed(2)
        : mensalidade.valor;
    mensalidade.pagoEm = dados.horario ?? new Date();
    mensalidade.endToEndId = dados.endToEndId ?? mensalidade.endToEndId;
    if (dados.txid) mensalidade.txid = dados.txid;

    await this.mensalidadeRepo.save(mensalidade);
    console.log(
      `✅ Licença: mensalidade ${mensalidade.id} (${mensalidade.software}) baixada por Pix.`,
    );
    return mensalidade;
  }

  /**
   * NFS-e da mensalidade, emitida na mão.
   *
   * Licenciamento de uso de software é serviço (item 01.05 da LC 116/2003),
   * então é NFS-e e não NF-e. O tomador vem da própria licença, porque esse
   * cliente não existe no MKAuth.
   */
  async emitirNfse(
    mensalidadeId: number,
    dados: {
      password: string;
      ambiente: string;
      ultimoRps: string | number;
      aliquota?: string | number;
      servico?: string;
      descricao?: string;
    },
  ) {
    const mensalidade = await this.mensalidadeRepo.findOne({
      where: { id: mensalidadeId },
    });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");
    if (mensalidade.nfseNumero)
      throw new Error(
        `Esta mensalidade já tem a NFS-e ${mensalidade.nfseNumero}.`,
      );

    const licenca = await this.licencaRepo.findOne({
      where: { id: mensalidade.licencaId },
    });
    if (!licenca) throw new Error("Licença não encontrada.");

    const faltando: string[] = [];
    if (!licenca.documento) faltando.push("CPF/CNPJ");
    if (!licenca.endereco) faltando.push("endereço");
    if (!licenca.bairro) faltando.push("bairro");
    if (!licenca.cep) faltando.push("CEP");
    if (!licenca.cidade && !licenca.codigo_municipio) faltando.push("cidade");
    if (faltando.length) {
      throw new Error(
        `Complete os dados fiscais da licença antes de emitir: ${faltando.join(", ")}.`,
      );
    }

    // O RPS é digitado: informa-se o último usado e a nota sai com o seguinte.
    const ultimo = String(dados.ultimoRps ?? "").trim();
    if (!/^\d+$/.test(ultimo))
      throw new Error("Informe o último número de RPS usado.");
    const numeroRps = Number(ultimo) + 1;

    const resultado = await nfseController.emitirNfseParaTomador({
      referencia: `LICENCA-${licenca.id}`,
      valor: Number(mensalidade.valor),
      // 010501: licenciamento ou cessão de direito de uso de software.
      servico: dados.servico || "010501",
      descricao:
        dados.descricao ||
        `Licenciamento de uso do software ${mensalidade.software ?? ""} - competencia ${mensalidade.competencia}`,
      password: dados.password,
      ambiente: dados.ambiente || "homologacao",
      aliquota: String(dados.aliquota ?? "5.0000"),
      numeroRps,
      tomador: {
        cpfCnpj: licenca.documento!,
        nome: licenca.razao_social || licenca.cliente_nome,
        logradouro: licenca.endereco,
        numero: licenca.numero,
        complemento: licenca.complemento,
        bairro: licenca.bairro,
        codigoMunicipio: licenca.codigo_municipio,
        cidade: licenca.cidade,
        uf: licenca.uf,
        cep: licenca.cep,
        telefone: licenca.telefone,
        email: licenca.email,
      },
    });

    if (!resultado.ok) {
      let erro = String(resultado.error || "A prefeitura recusou a nota.");

      // Recusa por número repetido: o texto da prefeitura não diz o que fazer.
      if (/E0014|já existe/i.test(erro)) {
        const conhecido = await this.ultimoRpsConhecido(
          dados.ambiente || "homologacao",
        );
        erro += conhecido.ultimoRps
          ? ` — O RPS ${numeroRps} já foi usado. O último gravado aqui é ${conhecido.ultimoRps}; tente informando esse número.`
          : ` — O RPS ${numeroRps} já foi usado. Informe o último número realmente emitido.`;
      }

      mensalidade.nfseErro = erro.slice(0, 2000);
      await this.mensalidadeRepo.save(mensalidade);
      throw new Error(erro);
    }

    mensalidade.nfseId = resultado.nfseId ?? null;
    mensalidade.nfseNumero = resultado.numero ?? null;
    mensalidade.nfseChave = resultado.chave ?? null;
    mensalidade.nfseEmitidaEm = new Date();
    // O aviso fica registrado, mas a nota conta como emitida: é o que impede
    // alguém de emitir a mesma nota duas vezes na prefeitura.
    mensalidade.nfseErro = resultado.aviso ?? null;
    await this.mensalidadeRepo.save(mensalidade);

    return mensalidade;
  }

  /**
   * Registra uma nota que já foi emitida na prefeitura mas não ficou gravada
   * aqui. Não emite nada: só amarra o número à mensalidade, para ninguém
   * emitir a segunda via da mesma nota.
   */
  async vincularNfse(
    mensalidadeId: number,
    dados: { numero: string; chave?: string; emitidaEm?: string },
  ) {
    const mensalidade = await this.mensalidadeRepo.findOne({
      where: { id: mensalidadeId },
    });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");

    const numero = String(dados.numero || "").trim();
    if (!numero) throw new Error("Informe o número da nota.");

    mensalidade.nfseNumero = numero;
    mensalidade.nfseChave = dados.chave?.trim() || mensalidade.nfseChave;
    mensalidade.nfseEmitidaEm = dados.emitidaEm
      ? new Date(dados.emitidaEm)
      : new Date();
    mensalidade.nfseErro = null;

    return this.mensalidadeRepo.save(mensalidade);
  }

  /**
   * Último RPS já usado no ambiente, lido das notas gravadas.
   *
   * Serve para o campo vir preenchido em vez de depender de memória: repetir
   * um número que já saiu faz a prefeitura recusar com N-E0014.
   */
  async ultimoRpsConhecido(ambiente: string) {
    const repo = LocalDataSource.getRepository(NFSE);
    const ultima = await repo.findOne({
      where: { ambiente },
      order: { numeroRps: "DESC" },
    });

    return {
      ambiente,
      ultimoRps: ultima?.numeroRps ?? null,
      serie: ultima?.serieRps ?? null,
      emitidaEm: ultima?.timestamp ?? null,
    };
  }

  /**
   * Cancela a NFS-e na prefeitura (evento 101101) e guarda a data do
   * cancelamento. A nota continua registrada aqui, cancelada — apagar o
   * registro é outra ação.
   */
  async cancelarNfse(
    mensalidadeId: number,
    dados: { password: string; ambiente: string },
  ) {
    const mensalidade = await this.mensalidadeRepo.findOne({
      where: { id: mensalidadeId },
    });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");
    if (!mensalidade.nfseNumero)
      throw new Error("Esta mensalidade não tem nota emitida.");
    if (mensalidade.nfseCanceladaEm)
      throw new Error("Esta nota já está cancelada.");
    if (!mensalidade.nfseChave)
      throw new Error(
        "Chave da NFS-e não registrada. Informe a chave pelo botão 'Já emitida' antes de cancelar.",
      );
    if (!dados?.password) throw new Error("Informe a senha do certificado.");

    const resultado = await nfseController.cancelarNfsePorChave(
      mensalidade.nfseChave,
      dados.password,
      dados.ambiente || "homologacao",
    );

    if (!resultado.ok) {
      mensalidade.nfseErro = String(
        resultado.error || "Prefeitura rejeitou o cancelamento",
      ).slice(0, 2000);
      await this.mensalidadeRepo.save(mensalidade);
      throw new Error(mensalidade.nfseErro);
    }

    mensalidade.nfseCanceladaEm = new Date();
    mensalidade.nfseErro = null;
    return this.mensalidadeRepo.save(mensalidade);
  }

  /**
   * Tira a nota desta mensalidade só aqui dentro.
   *
   * Não cancela nada na prefeitura: se a nota estiver válida lá, ela continua
   * valendo, e a mensalidade volta a permitir emissão — ou seja, dá para
   * emitir uma segunda nota para o mesmo mês sem querer.
   */
  async desvincularNfse(mensalidadeId: number) {
    const mensalidade = await this.mensalidadeRepo.findOne({
      where: { id: mensalidadeId },
    });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");

    mensalidade.nfseId = null;
    mensalidade.nfseNumero = null;
    mensalidade.nfseChave = null;
    mensalidade.nfseEmitidaEm = null;
    mensalidade.nfseCanceladaEm = null;
    mensalidade.nfseErro = null;

    return this.mensalidadeRepo.save(mensalidade);
  }

  /** Baixa manual, para pagamento fora do Pix. */
  async baixarManual(id: number, valorPago?: string | number) {
    const mensalidade = await this.mensalidadeRepo.findOne({ where: { id } });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");

    mensalidade.status = "paga";
    mensalidade.formaPagamento = "manual";
    mensalidade.valorPago =
      valorPago !== undefined
        ? Number(String(valorPago).replace(",", ".")).toFixed(2)
        : mensalidade.valor;
    mensalidade.pagoEm = new Date();

    return this.mensalidadeRepo.save(mensalidade);
  }

  /** Reabre uma mensalidade baixada por engano. */
  async reabrir(id: number) {
    const mensalidade = await this.mensalidadeRepo.findOne({ where: { id } });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");

    mensalidade.status = "aberta";
    mensalidade.formaPagamento = null;
    mensalidade.valorPago = null;
    mensalidade.pagoEm = null;

    return this.mensalidadeRepo.save(mensalidade);
  }

  async cancelar(id: number) {
    const mensalidade = await this.mensalidadeRepo.findOne({ where: { id } });
    if (!mensalidade) throw new Error("Mensalidade não encontrada.");
    mensalidade.status = "cancelada";
    return this.mensalidadeRepo.save(mensalidade);
  }

  async remover(id: number) {
    await this.mensalidadeRepo.delete(id);
  }
}

export default new LicencaMensalidadeService();
export { competenciaDe, vencimentoDaCompetencia };
