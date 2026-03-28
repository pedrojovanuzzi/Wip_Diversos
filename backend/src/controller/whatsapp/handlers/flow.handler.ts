import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { decryptFlowRequest, encryptFlowResponse } from "../utils/crypto";
import { limparEndereco } from "../utils/helpers";
import { sessions, saveSession } from "../services/session.service";
import { getPlanosDoSistema } from "../services/plano.service";
import ApiMkDataSource from "../../../database/API_MK";
import Sessions from "../../../entities/APIMK/Sessions";

export async function Flow(req: Request, res: Response): Promise<void> {
  try {
    const { body } = req;
    const privatePemPath = path.resolve(__dirname, "..", "..", "..", "..", "private.pem");
    console.log(body);

    if (!fs.existsSync(privatePemPath)) {
      console.error(
        "Arquivo private.pem não encontrado na raiz do projeto. Necessário para WhatsApp Flows.",
      );
      res.status(500).json({
        message: "Servidor não configurado propriamente para Flows",
      });
      return;
    }

    const privatePem = fs.readFileSync(privatePemPath, "utf-8");

    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
      decryptFlowRequest(body, privatePem);
    const { screen, data, action, flow_token } = decryptedBody;

    console.log("Recebido via Flow", { action, screen, data, flow_token });

    if (action === "ping") {
      const responseData = { data: { status: "active" } };
      res.send(
        encryptFlowResponse(responseData, aesKeyBuffer, initialVectorBuffer),
      );
      return;
    }

    if (action === "INIT") {
      const planosDoSistema = await getPlanosDoSistema();
      const screenData = {
        screen: "CADASTRO_COMPLETO",
        data: { planos_do_sistema: planosDoSistema },
      };

      res.send(
        encryptFlowResponse(screenData, aesKeyBuffer, initialVectorBuffer),
      );
      return;
    }

    if (action === "data_exchange") {
      console.log("🟢 Formulário preenchido pelo cliente:", data);

      if (screen === "MUDANCA_ENDERECO") {
        const celular = flow_token.split("_")[1];

        const dbSession = await ApiMkDataSource.getRepository(
          Sessions,
        ).findOne({ where: { celular } });
        if (dbSession) {
          sessions[celular] = {
            stage: dbSession.stage,
            ...dbSession.dados,
          };
        } else if (!sessions[celular]) {
          sessions[celular] = { stage: "start" };
        }

        const session = sessions[celular];

        if (session) {
          session.dadosCadastro = {
            login: session.login,
            endereco_antigo: session.endereco_antigo,
            nome: limparEndereco(data.nome),
            cpf: session.cpf || data.cpf,
            celular: data.celular,
            rua: limparEndereco(data.rua),
            numero: limparEndereco(data.numero),
            novo_bairro: limparEndereco(data.novo_bairro),
            cep: data.cep,
          };

          try {
            await saveSession(celular);
          } catch (e) {
            console.error("Erro ao salvar sessão do Webhook Flow", e);
          }
        }
      }

      const successScreenData = {
        screen: "SUCCESS",
        data: {
          extension_message_response: {
            params: { flow_token: flow_token },
          },
        },
      };

      res.send(
        encryptFlowResponse(
          successScreenData,
          aesKeyBuffer,
          initialVectorBuffer,
        ),
      );
      return;
    }

    res.status(400).send("Ação não suportada pelo endpoint");
  } catch (error) {
    console.error(
      "Erro na descriptografia/processamento do Flow Endpoint:",
      error,
    );
    res.status(421).send();
  }
}
