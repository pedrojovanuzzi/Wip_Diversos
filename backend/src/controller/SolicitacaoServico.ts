import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import moment from "moment-timezone";
import { ConsultCenterService } from "../services/ConsultCenterService";
import whatsPixController from "./WhatsConversationPath";
import Pix from "./Pix";
import ZapSign from "./ZapSign";

class SolicitacaoServicoController {
  public list = async (req: Request, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        page = 1,
        limit = 10,
        finalizado,
      } = req.query;

      const repository = AppDataSource.getRepository(SolicitacaoServico);
      let where: any = {};

      if (startDate && endDate) {
        where.data_solicitacao = Between(
          moment(startDate as string)
            .startOf("day")
            .toDate(),
          moment(endDate as string)
            .endOf("day")
            .toDate(),
        );
      } else if (startDate) {
        where.data_solicitacao = MoreThanOrEqual(
          moment(startDate as string)
            .startOf("day")
            .toDate(),
        );
      } else if (endDate) {
        where.data_solicitacao = LessThanOrEqual(
          moment(endDate as string)
            .endOf("day")
            .toDate(),
        );
      }

      // Filtro de Finalizado
      if (finalizado === "true" || finalizado === "1") {
        where.finalizado = true;
      } else if (finalizado === "false" || finalizado === "0") {
        where.finalizado = false;
      } else if (finalizado === undefined || finalizado === null) {
        // Padrão apenas se não vier o parâmetro (ex: acesso direto à API)
        where.finalizado = false;
      }
      // Se finalizado for "all" ou qualquer outro valor não mapeado, não aplicamos filtro

      // Pagination
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const [list, count] = await repository.findAndCount({
        where,
        order: {
          data_solicitacao: "DESC",
        },
        skip,
        take: limitNum,
      });

      res.status(200).json({
        data: list,
        total: count,
        page: pageNum,
        totalPages: Math.ceil(count / limitNum),
      });
    } catch (error) {
      console.error("Erro ao listar solicitações de serviço:", error);
      res.status(500).send("Erro interno do servidor.");
    }
  };

  public consultarCpf = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({
        where: { id: Number(id) },
      });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada" });
        return;
      }

      if (solicitacao.consulta_cpf_realizada) {
        res.status(409).json({
          message: "A consulta de CPF já foi realizada para esta solicitação.",
        });
        return;
      }

      if (solicitacao.consulta_cpf_tentada) {
        res.status(409).json({
          message:
            "A consulta normal já foi tentada para esta solicitação. Use a consulta manual se precisar tentar novamente.",
        });
        return;
      }

      const dados = solicitacao.dados as any;
      const cpf = dados.cpf;
      const celular = dados.telefone_conversa;

      console.log(
        `[ManualConsult] Iniciando consulta para ID: ${id}, CPF: ${cpf}`,
      );

      solicitacao.consulta_cpf_tentada = true;
      await repository.save(solicitacao);

      const consultCenter = new ConsultCenterService();
      const consulta = await consultCenter.consultarDebitos(cpf);

      if (consulta.erroConsulta) {
        res.status(502).json({
          message:
            "A consulta normal falhou. A consulta manual foi liberada para esta solicitação.",
        });
        return;
      }

      if (consulta.devePagar) {
        // Fluxo Pago
        solicitacao.pago = false;
        solicitacao.gratis = 0;
        solicitacao.consulta_cpf_realizada = true;
        await repository.save(solicitacao);

        await whatsPixController.MensagensComuns(
          celular,
          `🔍 *Após análise*, informamos que no momento não foi liberada a instalação na modalidade *grátis*.\n💰 Caso tenha interesse em dar continuidade, a instalação pode ser realizada na forma *paga*.\n*Taxa de Instalação:* R$ 350,00`,
        );

        // Gerar lançamento no MKAuth
        const lancamento = await whatsPixController.gerarLancamentoServico(
          { cpf: cpf, login: solicitacao.login_cliente },
          "instalacao",
        );
        if (lancamento) {
          solicitacao.id_fatura = lancamento.id;
          await repository.save(solicitacao);

          const pixController = new Pix();
          const pixData = await pixController.gerarPixServico({
            idLancamento: lancamento.id,
            valor: lancamento.valor,
            pppoe: lancamento.login,
            cpf: cpf,
          });

          await whatsPixController.MensagensComuns(
            celular,
            `✨ *Aqui está seu PIX para pagamento da Taxa de Instalação:*\n\n💰 *Valor:* R$ ${lancamento.valor}\n\n🔗 *Link para QR Code:* ${pixData.link}\n\n👇 *Pix Copia e Cola:*`,
          );
          await whatsPixController.MensagensComuns(celular, pixData.qrcode);
        }
      } else {
        // Fluxo Grátis
        solicitacao.pago = true;
        solicitacao.gratis = 1;
        solicitacao.consulta_cpf_realizada = true;

        // Criar contrato ZapSign
        const zapResponse = await ZapSign.createContractInstalacao(dados);
        const zapSignUrl = zapResponse.signers[0].sign_url;
        solicitacao.token_zapsign = zapResponse.token;
        await repository.save(solicitacao);

        await whatsPixController.MensagensComuns(
          celular,
          `✅ *Parabéns!* Sua instalação será *Isenta* de taxa de adesão! 🚀`,
        );

        await whatsPixController.enviarNotificacaoServico(celular);

        await whatsPixController.MensagensComuns(
          celular,
          `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos sua contratação! 🚀`,
        );
      }

      res.status(200).json({ success: true, devePagar: consulta.devePagar });
    } catch (error) {
      console.error("Erro ao consultar CPF manualmente:", error);
      res.status(500).json({ message: "Erro interno ao processar consulta" });
    }
  };

  public consultarCpfManual = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    const { cpf, nome } = req.body;

    if (!cpf || !nome) {
      res.status(400).json({
        message: "CPF e nome completo são obrigatórios para a consulta manual.",
      });
      return;
    }

    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({
        where: { id: Number(id) },
      });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada" });
        return;
      }

      if (solicitacao.consulta_cpf_realizada) {
        res.status(409).json({
          message: "A consulta de CPF já foi realizada para esta solicitação.",
        });
        return;
      }

      if (!solicitacao.consulta_cpf_tentada) {
        res.status(409).json({
          message:
            "A consulta manual só pode ser usada depois que a consulta normal for tentada.",
        });
        return;
      }

      const dados = (solicitacao.dados || {}) as any;
      const celular = dados.telefone_conversa;

      solicitacao.consulta_cpf_realizada = true;
      await repository.save(solicitacao);

      const consultCenter = new ConsultCenterService();
      const consulta = await consultCenter.consultarDebitos(cpf);

      if (consulta.erroConsulta) {
        res.status(502).json({
          message:
            "A consulta manual não pôde ser concluída no Consult Center. Tente novamente apenas se for realmente necessário.",
        });
        return;
      }

      if (consulta.devePagar) {
        solicitacao.pago = false;
        solicitacao.gratis = 0;
        await repository.save(solicitacao);

        await whatsPixController.MensagensComuns(
          celular,
          `🔍 *Após análise*, informamos que no momento não foi liberada a instalação na modalidade *grátis*.\n💰 Caso tenha interesse em dar continuidade, a instalação pode ser realizada na forma *paga*.\n*Taxa de Instalação:* R$ 350,00`,
        );

        const lancamento = await whatsPixController.gerarLancamentoServico(
          { cpf: cpf, login: solicitacao.login_cliente },
          "instalacao",
        );
        if (lancamento) {
          solicitacao.id_fatura = lancamento.id;
          await repository.save(solicitacao);

          const pixController = new Pix();
          const pixData = await pixController.gerarPixServico({
            idLancamento: lancamento.id,
            valor: lancamento.valor,
            pppoe: lancamento.login,
            cpf: cpf,
          });

          await whatsPixController.MensagensComuns(
            celular,
            `✨ *Aqui está seu PIX para pagamento da Taxa de Instalação:*\n\n💰 *Valor:* R$ ${lancamento.valor}\n\n🔗 *Link para QR Code:* ${pixData.link}\n\n👇 *Pix Copia e Cola:*`,
          );
          await whatsPixController.MensagensComuns(celular, pixData.qrcode);
        }
      } else {
        solicitacao.pago = true;
        solicitacao.gratis = 1;

        const payloadZap = {
          ...dados,
          cpf,
          nome,
        };

        const zapResponse = await ZapSign.createContractInstalacao(payloadZap);
        const zapSignUrl = zapResponse.signers[0].sign_url;
        solicitacao.token_zapsign = zapResponse.token;
        await repository.save(solicitacao);

        await whatsPixController.MensagensComuns(
          celular,
          `✅ *Ótima notícia!* Sua instalação foi aprovada com *Isenção* de taxa! 🚀`,
        );

        await whatsPixController.enviarNotificacaoServico(celular);

        await whatsPixController.MensagensComuns(
          celular,
          `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos sua contratação! 🚀`,
        );
      }

      res.status(200).json({ success: true, devePagar: consulta.devePagar });
    } catch (error) {
      console.error("Erro ao consultar CPF manualmente com nome:", error);
      res.status(500).json({ message: "Erro interno ao processar consulta" });
    }
  };

  public ignorarConsulta = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({
        where: { id: Number(id) },
      });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada" });
        return;
      }

      const dados = solicitacao.dados as any;
      const celular = dados.telefone_conversa;

      // Marcar como grátis
      solicitacao.pago = true;
      solicitacao.gratis = 1;

      // Criar contrato ZapSign
      const zapResponse = await ZapSign.createContractInstalacao(dados);
      const zapSignUrl = zapResponse.signers[0].sign_url;
      solicitacao.token_zapsign = zapResponse.token;
      await repository.save(solicitacao);

      await whatsPixController.MensagensComuns(
        celular,
        `✅ *Ótima notícia!* Sua instalação foi aprovada com *Isenção* de taxa! 🚀`,
      );

      await whatsPixController.enviarNotificacaoServico(celular);

      await whatsPixController.MensagensComuns(
        celular,
        `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos sua contratação! 🚀`,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao ignorar consulta:", error);
      res.status(500).json({ message: "Erro interno ao processar" });
    }
  };

  public finalizar = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { id_chamado } = req.body;

    if (!id_chamado) {
      res.status(400).json({ message: "ID do chamado é obrigatório." });
      return;
    }

    try {
      // 1. Verificar se o chamado existe no MKAuth
      const mkRepository = MkauthSource.getRepository(ChamadosEntities);
      const chamadoExistente = await mkRepository.findOne({
        where: { chamado: id_chamado },
      });

      if (!chamadoExistente) {
        res.status(404).json({
          message:
            "Chamado não encontrado no MKAuth. Verifique o ID informado.",
        });
        return;
      }

      // 2. Atualizar a solicitação
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({
        where: { id: Number(id) },
      });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada." });
        return;
      }

      solicitacao.finalizado = true;
      solicitacao.id_chamado = id_chamado;

      await repository.save(solicitacao);

      res.status(200).json({
        success: true,
        message: "Serviço finalizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao finalizar serviço:", error);
      res.status(500).json({ message: "Erro interno ao finalizar serviço." });
    }
  };
}

export default new SolicitacaoServicoController();
