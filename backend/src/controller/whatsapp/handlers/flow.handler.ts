import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import axios from "axios";
import { decryptFlowRequest, encryptFlowResponse } from "../utils/crypto";
import { limparEndereco, limparNomeRua } from "../utils/helpers";
import { sessions, saveSession } from "../services/session.service";
import { getPlanosDoSistema } from "../services/plano.service";
import ApiMkDataSource from "../../../database/API_MK";
import MkauthDataSource from "../../../database/MkauthSource";
import Sessions from "../../../entities/APIMK/Sessions";
import { ClientesEntities } from "../../../entities/ClientesEntities";

async function buscarDadosCep(cep: string): Promise<{ cidade: string; estado: string; bairro: string }> {
  try {
    const cepLimpo = (cep || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) return { cidade: "", estado: "", bairro: "" };
    const resp = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`, { timeout: 5000 });
    if (resp.data && !resp.data.erro) {
      return {
        cidade: resp.data.localidade || "",
        estado: resp.data.uf || "",
        bairro: resp.data.bairro || "",
      };
    }
  } catch (e) {
    console.error("Erro ao buscar CEP no ViaCEP:", e);
  }
  return { cidade: "", estado: "", bairro: "" };
}

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
      if (screen === "ALTERACAO_PLANO") {
        const screenData = {
          screen: "ALTERACAO_PLANO",
          data: { planos_do_sistema: planosDoSistema },
        };

        res.send(
          encryptFlowResponse(screenData, aesKeyBuffer, initialVectorBuffer),
        );
        return;
      }

      if (screen === "TROCA_TITULARIDADE_CONTATO") {
        const screenData = {
          screen: "TROCA_TITULARIDADE_CONTATO",
          data: {},
        };

        res.send(
          encryptFlowResponse(screenData, aesKeyBuffer, initialVectorBuffer),
        );
        return;
      }

      if (screen === "TROCA_TITULARIDADE_CONTRATACAO") {
        const screenData = {
          screen: "TROCA_TITULARIDADE_CONTRATACAO",
          data: { planos_do_sistema: planosDoSistema },
        };

        res.send(
          encryptFlowResponse(screenData, aesKeyBuffer, initialVectorBuffer),
        );
        return;
      }

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
          let emailCliente = "";
          let rgCliente = "";
          try {
            const cliente = await MkauthDataSource.getRepository(ClientesEntities).findOne({
              where: { login: session.login, cli_ativado: "s" },
            });
            if (cliente) {
              emailCliente = cliente.email || "";
              rgCliente = cliente.rg || "";
            }
          } catch (e) {
            console.error("Erro ao buscar cliente no MKAuth para mudança de endereço:", e);
          }

          // Fallback de cidade/estado via ViaCEP apenas se o formulário não enviou esses campos
          let cidadeForm = (data.cidade || "").trim();
          let estadoForm = (data.estado || "").trim();
          if (!cidadeForm || !estadoForm) {
            const dadosCep = await buscarDadosCep(data.cep);
            if (!cidadeForm) cidadeForm = dadosCep.cidade;
            if (!estadoForm) estadoForm = dadosCep.estado;
          }

          session.dadosCadastro = {
            login: session.login,
            endereco_antigo: session.endereco_antigo,
            nome: limparEndereco(data.nome),
            cpf: session.cpf || data.cpf,
            celular: data.celular,
            rua: limparNomeRua(data.rua),
            numero: limparEndereco(data.numero),
            bairro: limparEndereco(data.novo_bairro),
            novo_bairro: limparEndereco(data.novo_bairro),
            cep: data.cep,
            cidade: cidadeForm,
            estado: estadoForm,
            email: emailCliente,
            rg: rgCliente,
          };

          try {
            await saveSession(celular);
          } catch (e) {
            console.error("Erro ao salvar sessão do Webhook Flow", e);
          }
        }
      }

      if (screen === "MUDANCA_COMODO") {
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
            observacao: limparEndereco(
              data.observacao || data.nome || data.descricao || "",
            ),
          };

          try {
            await saveSession(celular);
          } catch (e) {
            console.error("Erro ao salvar sessão do Webhook Flow (Cômodo)", e);
          }
        }
      }

      if (screen === "ALTERACAO_PLANO") {
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
            ...(session.dadosCadastro || {}),
            plano: data.plano || "",
          };

          try {
            await saveSession(celular);
          } catch (e) {
            console.error("Erro ao salvar sessão do Webhook Flow (Troca de Plano)", e);
          }
        }
      }

      const successScreenData = {
        screen: "SUCCESS",
        data: {
          extension_message_response: {
            // "submitted: true" distingue submissão real de fechamento sem envio.
            // Quando o usuário fecha sem enviar, o nfm_reply tem apenas {flow_token}.
            // Com este parâmetro extra, o webhook consegue identificar submissões reais.
            params: { flow_token: flow_token, submitted: "true" },
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
