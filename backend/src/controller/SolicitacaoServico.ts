import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import moment from "moment-timezone";
import { ConsultCenterService } from "../services/ConsultCenterService";
import whatsPixController from "./WhatsConversationPath";
import Pix from "./Pix";
import ZapSign from "./ZapSign";

class SolicitacaoServicoController {
  public async list(req: Request, res: Response) {
    try {
      const { startDate, endDate, page = 1, limit = 10 } = req.query;

      const repository = AppDataSource.getRepository(SolicitacaoServico);
      let where: any = {};

      if (startDate && endDate) {
        where.data_solicitacao = Between(
          moment(startDate as string).startOf("day").toDate(),
          moment(endDate as string).endOf("day").toDate()
        );
      } else if (startDate) {
        where.data_solicitacao = MoreThanOrEqual(
          moment(startDate as string).startOf("day").toDate()
        );
      } else if (endDate) {
        where.data_solicitacao = LessThanOrEqual(
          moment(endDate as string).endOf("day").toDate()
        );
      }

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
  }

  public async consultarCpf(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({ where: { id: Number(id) } });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada" });
        return;
      }

      const dados = solicitacao.dados as any;
      const cpf = dados.cpf;
      const celular = dados.telefone_conversa;

      console.log(`[ManualConsult] Iniciando consulta para ID: ${id}, CPF: ${cpf}`);

      const consultCenter = new ConsultCenterService();
      const consulta = await consultCenter.consultarDebitos(cpf);

      if (consulta.devePagar) {
        // Fluxo Pago
        solicitacao.pago = false;
        solicitacao.gratis = 0;
        await repository.save(solicitacao);

        await whatsPixController.MensagensComuns(
          celular,
          `🔍 *Após análise*, informamos que no momento não foi liberada a instalação na modalidade *grátis*.\n💰 Caso tenha interesse em dar continuidade, a instalação pode ser realizada na forma *paga*.\n*Taxa de Instalação:* R$ 350,00`,
        );

        // Gerar lançamento no MKAuth
        // Passamos 'dados' como se fosse a sessão, pois gerarLancamentoServico usa .cpf e .dadosCompleto.cpf
        const lancamento = await whatsPixController.gerarLancamentoServico({ cpf: cpf, login: solicitacao.login_cliente }, "instalacao");
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
  }

  public async ignorarConsulta(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({ where: { id: Number(id) } });

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
  }
}

export default new SolicitacaoServicoController();
