import crypto from "crypto";
import fs from "fs";
import path from "path";
import EfiPay from "sdk-node-apis-efi";
import SftpClient from "ssh2-sftp-client";
import FormData from "form-data";
import axios from "axios";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import { Faturas as Record } from "../../../entities/Faturas";
import { ClientesEntities } from "../../../entities/ClientesEntities";
import {
  ClientesEntities as Sis_Cliente,
} from "../../../entities/ClientesEntities";
import MkauthDataSource from "../../../database/MkauthSource";
import { In, IsNull } from "typeorm";
import { efiPayOptions, chave_pix, urlMedia, token } from "../config";
import { writeLog } from "../utils/logging";
import {
  MensagensComuns,
  MensagensDeMidia,
} from "./messaging.service";

// Cria lançamento de instalação paga diretamente com status 'pago'.
// Usado quando o cliente já pagou via Pix antes de fazer o cadastro.
// O login ainda não existe em MKAuth — o lançamento fica pré-registrado
// para ser vinculado quando o staff criar o cliente.
export async function gerarLancamentoInstalacaoPaga(login: string, nome: string) {
  try {
    const valor = process.env.SERVIDOR_HOMOLOGACAO === "true" ? 1 : 350;
    const FaturasRepository = MkauthDataSource.getRepository(Record);
    const agora = new Date();

    const novoLancamento = await FaturasRepository.save({
      login,
      nome: nome || login,
      tipo: "servicos",
      valor: valor.toFixed(2),
      valorpag: valor.toFixed(2),
      datavenc: agora,
      datapag: agora,
      processamento: agora,
      status: "pago",
      formapag: "Pix",
      recibo: `SRV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      obs: "Serviço: Instalação Paga via Pix - Gerado automaticamente via WhatsApp Bot",
      valorger: "completo",
      aviso: "nao",
      imp: "nao",
      tipocob: "fat",
      cfop_lanc: "5307",
      referencia: moment().format("MM/YYYY"),
      uuid_lanc: uuidv4().slice(0, 16),
    });

    console.log(`✅ Lançamento de instalação paga criado! ID: ${novoLancamento.id}, Login: ${login}, Valor: R$ ${valor}`);
    return novoLancamento;
  } catch (error) {
    console.error("❌ Erro ao gerar lançamento de instalação paga no MKAuth:", error);
    return null;
  }
}

export async function gerarLancamentoServico(session: any, tipoServico: string) {
  try {
    const valoresServico: { [key: string]: number } = {
      instalacao: process.env.SERVIDOR_HOMOLOGACAO === "true" ? 1 : 350,
      mudanca_endereco: process.env.SERVIDOR_HOMOLOGACAO === "true" ? 1 : 200,
      mudanca_comodo: process.env.SERVIDOR_HOMOLOGACAO === "true" ? 1 : 200,
    };

    const valor = valoresServico[tipoServico];
    if (!valor) {
      console.error(`Tipo de serviço desconhecido para lançamento: ${tipoServico}`);
      return;
    }

    const cpf = session.cpf || session.dadosCompleto?.cpf;
    const loginSessao = session.login;

    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);

    let cliente;

    if (loginSessao) {
      cliente = await ClientesRepository.findOne({
        where: { login: loginSessao, cli_ativado: "s" },
      });
    }

    if (!cliente && cpf) {
      cliente = await ClientesRepository.findOne({
        where: { cpf_cnpj: cpf.trim().replace(/\s/g, ""), cli_ativado: "s" },
      });
    }

    if (!cliente) {
      console.error(
        `Cliente (Ativo) com Login "${loginSessao || ""}" ou CPF "${cpf || ""}" não encontrado no MKAuth para gerar lançamento.`,
      );
      return;
    }

    const login = cliente.login;
    const nomeServico =
      tipoServico === "instalacao"
        ? "Instalação"
        : tipoServico === "mudanca_endereco"
          ? "Mudança de Endereço"
          : "Mudança de Cômodo";

    const FaturasRepository = MkauthDataSource.getRepository(Record);
    const novoLancamento = await FaturasRepository.save({
      login: login,
      nome: cliente.nome || login,
      tipo: "servicos",
      valor: valor.toFixed(2),
      datavenc: new Date(),
      processamento: new Date(),
      status: "aberto",
      recibo: `SRV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      obs: `Serviço: ${nomeServico} - Gerado automaticamente via WhatsApp Bot`,
      valorger: "completo",
      aviso: "nao",
      imp: "nao",
      tipocob: "fat",
      cfop_lanc: "5307",
      referencia: moment().format("MM/YYYY"),
      uuid_lanc: uuidv4().slice(0, 16),
    });

    console.log(
      `✅ Lançamento de serviço criado com sucesso! ID: ${novoLancamento.id}, Login: ${login}, Valor: R$ ${valor}, Serviço: ${nomeServico}`,
    );
    return novoLancamento;
  } catch (error) {
    console.error("❌ Erro ao gerar lançamento de serviço no MKAuth:", error);
    return null;
  }
}

export async function enviarMensagemVencimento(
  receivenumber: any,
  dia: any,
  linha_dig: any,
  pix: any,
  end: any,
  valor: any,
  pppoe: any,
  numero: any,
  boletoID: any,
) {
  try {
    await MensagensComuns(receivenumber, "🔎 *Só um Momento* 🕵️");
    let msg = `Aqui está a sua Mensalidade do dia *${dia}*\n\n`;
    msg += `*Endereço*: ${end}  Nº: ${numero}\n`;
    msg += `*Valor*: ${valor}\n`;

    await MensagensComuns(receivenumber, "*Pix* Acesse o Site 👇");
    await MensagensComuns(receivenumber, pix);

    await MensagensComuns(receivenumber, msg);
    if (linha_dig !== null) {
      await downloadPdfFromSftp(
        receivenumber,
        process.env.SFTP_HOST,
        process.env.SFTP_USER,
        process.env.SFTP_PASSWORD,
        `${process.env.PDF_PATH}${boletoID}.pdf`,
        path.join(__dirname, "..", "..", "..", "temp", `${boletoID}.pdf`),
      );
      await MensagensComuns(receivenumber, "Linha Digitavel 👇");
      await MensagensComuns(receivenumber, linha_dig);
    }
  } catch (e) {
    console.error(JSON.stringify(e));
  }
}

export async function downloadPdfFromSftp(
  receivenumber: any,
  host: any,
  username: any,
  password: any,
  remoteFilePath: any,
  localFilePath: any,
) {
  const client = new SftpClient();
  try {
    await client.connect({ host, port: 22, username, password });
    console.log(remoteFilePath);
    const fileExists = await client.exists(remoteFilePath);
    console.log("FILEEXISTS: " + fileExists);

    if (fileExists) {
      console.log(`Arquivo encontrado no servidor: ${remoteFilePath}`);
      await client.fastGet(remoteFilePath, localFilePath);
      await getMediaID(receivenumber, localFilePath, "whatsapp");
      console.log("PDF baixado com sucesso via SFTP");
    } else {
      console.error(`Arquivo não encontrado no servidor: ${remoteFilePath}`);
    }
  } catch (error) {
    console.error("Erro ao baixar o PDF via SFTP: ", error);
  } finally {
    client.end();
  }
}

export async function getMediaID(
  receivenumber: any,
  filePath: any,
  type: any,
  messaging_product: any = "whatsapp",
) {
  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));
  formData.append("type", type);
  formData.append("messaging_product", messaging_product);

  try {
    const response = await axios.post(urlMedia, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...formData.getHeaders(),
      },
    });

    console.log("Mídia enviada com sucesso:", response.data);
    const mediaId = response.data.id;
    console.log("MEDIA ID: " + mediaId);
    MensagensDeMidia(receivenumber, "document", mediaId, "Boleto");
  } catch (error: any) {
    console.error(
      "Erro ao enviar a mídia:",
      error.response?.data || error.message,
    );
  }
}

export async function enviarBoleto(
  pppoe: any,
  celular: any,
  end: any,
  cpf: any,
) {
  const cliente: any = await MkauthDataSource.getRepository(Record).findOne({
    where: {
      login: pppoe,
      status: In(["vencido", "aberto"]),
      datadel: IsNull(),
    },
    order: { datavenc: "ASC" },
  });

  const sis_cliente: any = await MkauthDataSource.getRepository(
    Sis_Cliente,
  ).findOne({
    where: { login: pppoe, cpf_cnpj: cpf, cli_ativado: "s" },
  });

  const desconto = sis_cliente.desconto;

  let valor: number | string = Number(cliente.valor);
  const dataVenc = cliente.datavenc;
  let id = cliente.id;

  let corpo = { tipoCob: "cob" as "cob" };

  const efipayLoc = new EfiPay(efiPayOptions);

  const loc: any = await efipayLoc
    .pixCreateLocation([], corpo)
    .catch((error: any) => {
      console.log(error);
    });

  if (!loc) {
    console.log("Erro ao criar Location");
    return;
  }

  const locID = loc.id;
  console.log(locID);

  const efipayLocLink = new EfiPay(efiPayOptions);

  const qrlink: any = await efipayLocLink
    .pixGenerateQRCode({ id: Number(locID) })
    .catch((error: any) => {
      console.log(error);
    });

  if (!qrlink) {
    console.log("Erro ao gerar QR Link");
    return;
  }

  const link = qrlink.linkVisualizacao;

  valor -= desconto;

  const dataHoje = new Date();

  function resetTime(date: any) {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  let dataVencSemHora = resetTime(new Date(dataVenc));
  let dataHojeSemHora = resetTime(new Date(dataHoje));

  if (dataVencSemHora > dataHojeSemHora) {
    console.log("Não está em atraso");
  } else if (dataVencSemHora < dataHojeSemHora) {
    console.log("está em atraso");

    const date1 = new Date(dataVenc);
    const date2 = new Date(dataHoje);

    function differenceInDays(date1: any, date2: any) {
      const oneDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.floor(Math.abs((date1 - date2) / oneDay));
      return diffDays;
    }

    const diffInDays = differenceInDays(date1, date2);

    const monthlyFine = 0.02;
    const dailyFine = 0.00033;

    let multaMensal = valor * monthlyFine;
    let multaDiaria = (valor as number) * ((diffInDays - 4) * dailyFine);

    let valorFinal = (valor as number) + multaMensal + multaDiaria;
    let valorFinalArredondado = Math.floor(valorFinal * 100) / 100;
    let valorFinalFormatado = valorFinalArredondado.toFixed(2);

    valor = valorFinalFormatado;
  } else if (dataVencSemHora === dataHojeSemHora) {
    console.log("Vence Hoje");
  }

  writeLog({
    tipo: "BOLETO/PIX BOT SOLICITADO",
    cpf: cpf,
    pppoe: pppoe,
    id: id,
    valor: valor,
    dataVenc: dataVenc,
    timestamp: new Date().toISOString(),
  });

  console.log(valor);

  if (typeof valor !== "string") {
    valor = valor.toFixed(2);
  } else {
    valor = Number(valor).toFixed(2);
  }

  const efipay = new EfiPay(efiPayOptions);
  console.log(id);

  let body;

  if (cpf.length === 11) {
    body = {
      calendario: { expiracao: 43200 },
      devedor: { cpf: cpf, nome: pppoe },
      valor: { original: valor },
      chave: chave_pix,
      solicitacaoPagador: "Mensalidade",
      infoAdicionais: [
        { nome: "ID", valor: String(id) },
        { nome: "VALOR", valor: String(valor) },
        { nome: "QR", valor: String(link) },
      ],
      loc: { id: locID },
    };
  } else {
    body = {
      calendario: { expiracao: 43200 },
      devedor: { cnpj: cpf, nome: pppoe },
      valor: { original: valor },
      chave: chave_pix,
      solicitacaoPagador: "Mensalidade",
      infoAdicionais: [
        { nome: "ID", valor: String(id) },
        { nome: "VALOR", valor: String(valor) },
        { nome: "QR", valor: String(link) },
      ],
      loc: { id: locID },
    };
  }

  let params = {
    txid: crypto.randomBytes(16).toString("hex"),
  };

  let pix: any = await efipay
    .pixCreateCharge(params, body)
    .catch((error: any) => {
      console.log(error);
    });

  console.log(pix);

  if (!pix) {
    console.log("Erro ao criar PIX");
    return;
  }

  let pix_code = pix.pixCopiaECola;

  const options2 = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  } as const;
  const formattedDate = new Intl.DateTimeFormat("pt-BR", options2).format(
    dataVenc,
  );
  

  await enviarMensagemVencimento(
    celular,
    formattedDate,
    cliente.linhadig,
    link,
    end,
    valor,
    pppoe,
    sis_cliente.numero,
    cliente.uuid_lanc,
  );
}
