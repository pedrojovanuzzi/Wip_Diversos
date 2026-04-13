import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import moment from "moment-timezone";
import { ConsultCenterService } from "../services/ConsultCenterService";
import { MensagensComuns, enviarNotificacaoServico, gerarLancamentoServico } from "./whatsapp/index";
import { Faturas } from "../entities/Faturas";
import { ClientesEntities } from "../entities/ClientesEntities";
import { v4 as uuidv4 } from "uuid";
import Pix from "./Pix";
import ZapSign from "./ZapSign";
import { criarChamadoMkauth } from "./whatsapp/services/chamado.service";

class SolicitacaoServicoController {
  private isConsultaCpfConcluida(solicitacao: SolicitacaoServico): boolean {
    return Boolean(
      solicitacao.consulta_cpf_realizada &&
        (solicitacao.gratis === 1 ||
          solicitacao.pago === true ||
          solicitacao.id_fatura ||
          solicitacao.token_zapsign),
    );
  }

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

      // Filtro de Finalizado / Cancelado
      if (finalizado === "cancelado") {
        where.cancelado = true;
      } else if (finalizado === "true" || finalizado === "1") {
        where.finalizado = true;
        where.cancelado = false;
      } else if (finalizado === "false" || finalizado === "0") {
        where.finalizado = false;
        where.cancelado = false;
      } else if (finalizado === undefined || finalizado === null) {
        // Padrão apenas se não vier o parâmetro (ex: acesso direto à API)
        where.finalizado = false;
        where.cancelado = false;
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

      // Enrich with chamado status from MKAuth
      const chamadoIds = list.map((s) => s.id_chamado).filter(Boolean) as string[];
      let chamadoStatusMap: Record<string, string> = {};
      if (chamadoIds.length > 0) {
        const chamados = await MkauthSource.getRepository(ChamadosEntities).find({
          select: { chamado: true, status: true },
          where: { chamado: In(chamadoIds) },
        });
        chamadoStatusMap = Object.fromEntries(chamados.map((c) => [c.chamado!, c.status || "aberto"]));
      }

      const enrichedList = list.map((s) => ({
        ...s,
        status_chamado: s.id_chamado ? (chamadoStatusMap[s.id_chamado] ?? null) : null,
      }));

      res.status(200).json({
        data: enrichedList,
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

      if (this.isConsultaCpfConcluida(solicitacao)) {
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

      // Salva resultado da consulta nos dados da solicitação
      solicitacao.dados = {
        ...dados,
        consultaConsultCenter: {
          nome: consulta.nome || null,
          totalDivida: consulta.totalDivida,
          devePagar: consulta.devePagar,
          dataConsulta: new Date().toISOString(),
        },
      };

      if (consulta.devePagar) {
        // Fluxo Pago
        solicitacao.pago = false;
        solicitacao.gratis = 0;
        solicitacao.consulta_cpf_realizada = true;
        await repository.save(solicitacao);

        await MensagensComuns(
          celular,
          `🔍 *Após análise*, informamos que no momento não foi liberada a instalação na modalidade *grátis*.\n💰 Caso tenha interesse em dar continuidade, a instalação pode ser realizada na forma *paga*.\n*Taxa de Instalação:* R$ 350,00`,
        );

        // Gerar lançamento no MKAuth
        const lancamento = await gerarLancamentoServico(
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

          await MensagensComuns(
            celular,
            `✨ *Aqui está seu PIX para pagamento da Taxa de Instalação:*\n\n💰 *Valor:* R$ ${lancamento.valor}\n\n🔗 *Link para QR Code:* ${pixData.link}`,
          );
        }
      } else {
        // Fluxo Grátis
        solicitacao.pago = true;
        solicitacao.gratis = 1;
        solicitacao.consulta_cpf_realizada = true;

        // Criar contrato ZapSign — grátis: força valor "0,00" para selecionar template correto
        const zapResponse = await ZapSign.createContractInstalacao({ ...dados, valor: "0,00" });
        const zapSignUrl = zapResponse.signers[0].sign_url;
        solicitacao.token_zapsign = zapResponse.token;
        await repository.save(solicitacao);

        await MensagensComuns(
          celular,
          `✅ *Parabéns!* Sua instalação será *Isenta* de taxa de adesão! 🚀`,
        );

        if (process.env.TEST_PHONE) await enviarNotificacaoServico(process.env.TEST_PHONE);

        await MensagensComuns(
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

      if (this.isConsultaCpfConcluida(solicitacao)) {
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

      const consultCenter = new ConsultCenterService();
      const consulta = await consultCenter.consultarDebitos(cpf);

      if (consulta.erroConsulta) {
        res.status(502).json({
          message:
            "A consulta manual não pôde ser concluída no Consult Center. Tente novamente apenas se for realmente necessário.",
        });
        return;
      }

      // Salva resultado da consulta manual nos dados da solicitação
      solicitacao.dados = {
        ...dados,
        consultaConsultCenter: {
          nome: consulta.nome || nome || null,
          totalDivida: consulta.totalDivida,
          devePagar: consulta.devePagar,
          dataConsulta: new Date().toISOString(),
          manual: true,
        },
      };

      if (consulta.devePagar) {
        solicitacao.pago = false;
        solicitacao.gratis = 0;
        solicitacao.consulta_cpf_realizada = true;
        await repository.save(solicitacao);

        await MensagensComuns(
          celular,
          `🔍 *Após análise*, informamos que no momento não foi liberada a instalação na modalidade *grátis*.\n💰 Caso tenha interesse em dar continuidade, a instalação pode ser realizada na forma *paga*.\n*Taxa de Instalação:* R$ 350,00`,
        );

        const lancamento = await gerarLancamentoServico(
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

          await MensagensComuns(
            celular,
            `✨ *Aqui está seu PIX para pagamento da Taxa de Instalação:*\n\n💰 *Valor:* R$ ${lancamento.valor}\n\n🔗 *Link para QR Code:* ${pixData.link}`,
          );
        }
      } else {
        solicitacao.pago = true;
        solicitacao.gratis = 1;
        solicitacao.consulta_cpf_realizada = true;

        const payloadZap = {
          ...dados,
          cpf,
          nome,
          valor: "0,00", // grátis: força template correto
        };

        const zapResponse = await ZapSign.createContractInstalacao(payloadZap);
        const zapSignUrl = zapResponse.signers[0].sign_url;
        solicitacao.token_zapsign = zapResponse.token;
        await repository.save(solicitacao);

        await MensagensComuns(
          celular,
          `✅ *Ótima notícia!* Sua instalação foi aprovada com *Isenção* de taxa! 🚀`,
        );

        if (process.env.TEST_PHONE) await enviarNotificacaoServico(process.env.TEST_PHONE);

        await MensagensComuns(
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

      // Criar contrato ZapSign — grátis: força valor "0,00" para selecionar template correto
      const zapResponse = await ZapSign.createContractInstalacao({ ...dados, valor: "0,00" });
      const zapSignUrl = zapResponse.signers[0].sign_url;
      solicitacao.token_zapsign = zapResponse.token;
      await repository.save(solicitacao);

      await MensagensComuns(
        celular,
        `✅ *Ótima notícia!* Sua instalação foi aprovada com *Isenção* de taxa! 🚀`,
      );

      if (process.env.TEST_PHONE) await enviarNotificacaoServico(process.env.TEST_PHONE);

      await MensagensComuns(
        celular,
        `📄 *Aqui está o seu Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos sua contratação! 🚀`,
      );

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao ignorar consulta:", error);
      res.status(500).json({ message: "Erro interno ao processar" });
    }
  };

  public instalacaoPaga = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { valor } = req.body;

    if (!valor) {
      res.status(400).json({ message: "O valor da instalação é obrigatório." });
      return;
    }

    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({ where: { id: Number(id) } });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada." });
        return;
      }

      const dados = (solicitacao.dados || {}) as any;
      const celular = dados.telefone_conversa;
      const cpf = (dados.cpf || "").replace(/\D/g, "");
      const loginCliente = solicitacao.login_cliente || dados.login || "novo_cliente";
      const nomeCliente = dados.nome || loginCliente;
      const valorFormatado = parseFloat(String(valor).replace(",", ".")).toFixed(2);

      // Criar lançamento diretamente com o login do cliente
      // Não busca por CPF para evitar encontrar outro cliente com o mesmo CPF.
      // O cliente pode ainda não existir no MKAuth (novo cadastro pendente).
      const faturasRepo = MkauthSource.getRepository(Faturas);
      const novoLancamento = await faturasRepo.save({
        login: loginCliente,
        nome: nomeCliente.slice(0, 16),
        tipo: "servicos",
        valor: valorFormatado,
        datavenc: new Date(),
        processamento: new Date(),
        status: "aberto",
        recibo: `SRV-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        obs: `Serviço: Instalação Paga (taxa regional) - R$ ${valorFormatado} - Gerado via painel`,
        valorger: "completo",
        aviso: "nao",
        imp: "nao",
        tipocob: "fat",
        cfop_lanc: "5307",
        referencia: moment().format("MM/YYYY"),
        uuid_lanc: uuidv4().slice(0, 16),
      });

      // Atualizar solicitação com id_fatura e valor nos dados (para o PIX criar o contrato correto)
      solicitacao.id_fatura = novoLancamento.id;
      solicitacao.pago = false;
      solicitacao.gratis = 0;
      solicitacao.dados = { ...dados, valor: valorFormatado, dificuldade_acesso: true };
      await repository.save(solicitacao);

      // Gerar PIX usando o login do cliente e CPF informado no cadastro
      const pixController = new Pix();
      const pixData = await pixController.gerarPixServico({
        idLancamento: novoLancamento.id,
        valor: valorFormatado,
        pppoe: loginCliente,
        cpf: cpf,
      });

      // Enviar mensagens ao cliente
      await MensagensComuns(
        celular,
        `📋 *Olá ${dados.nome || ""}!* Após análise da sua solicitação de instalação, identificamos que a sua região possui *dificuldade de acesso*, o que gera uma taxa adicional.\n\n💰 *Taxa de Instalação:* R$ ${valorFormatado}\n\nCaso tenha interesse em prosseguir, realize o pagamento via PIX abaixo e o contrato será enviado automaticamente após a confirmação.`,
      );

      await MensagensComuns(
        celular,
        `✨ *Aqui está seu PIX para pagamento da Taxa de Instalação:*\n\n💰 *Valor:* R$ ${valorFormatado}\n\n🔗 *Link para QR Code:* ${pixData.link}`,
      );

      if (process.env.TEST_PHONE) await enviarNotificacaoServico(process.env.TEST_PHONE);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao processar instalação paga:", error);
      res.status(500).json({ message: "Erro interno ao processar instalação paga." });
    }
  };

  public cancelar = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { motivo } = req.body || {};

    try {
      const repository = AppDataSource.getRepository(SolicitacaoServico);
      const solicitacao = await repository.findOne({
        where: { id: Number(id) },
      });

      if (!solicitacao) {
        res.status(404).json({ message: "Solicitação não encontrada." });
        return;
      }

      if (solicitacao.cancelado) {
        res.status(409).json({ message: "Solicitação já está cancelada." });
        return;
      }

      const dadosAtuais = (solicitacao.dados || {}) as any;
      solicitacao.cancelado = true;
      solicitacao.finalizado = true;
      solicitacao.dados = {
        ...dadosAtuais,
        cancelamento: {
          data: new Date().toISOString(),
          usuario: req.user?.login || null,
          motivo: motivo || null,
        },
      };
      await repository.save(solicitacao);

      res.status(200).json({
        success: true,
        message: "Solicitação cancelada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao cancelar solicitação:", error);
      res.status(500).json({ message: "Erro interno ao cancelar solicitação." });
    }
  };

  public criarSemAssinatura = async (
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
        res.status(404).json({ message: "Solicitação não encontrada." });
        return;
      }

      if (solicitacao.cancelado) {
        res.status(409).json({ message: "Solicitação cancelada não pode ser processada." });
        return;
      }

      const jaTemChamado = Boolean(solicitacao.id_chamado);
      const dados = (solicitacao.dados || {}) as any;
      const servicoNorm = (solicitacao.servico || "").toLowerCase();

      let loginCliente = solicitacao.login_cliente || dados.login || "";
      const ehInstalacao =
        servicoNorm === "instalação" || servicoNorm === "instalacao";
      // Para troca/alteração de titularidade, apenas a solicitação do "novo titular"
      // gera um cadastro novo. A do titular original apenas abre chamado no cadastro existente.
      const ehTitularidade = servicoNorm.includes("titularidade");
      const ehNovoTitular = ehTitularidade && servicoNorm.includes("novo titular");
      const ehTitularAntigo = ehTitularidade && !ehNovoTitular;
      const deveCriarCadastro = ehInstalacao || ehNovoTitular;

      if (deveCriarCadastro) {
        loginCliente = await ZapSign.registerClientInMkAuth(dados);
        solicitacao.login_cliente = loginCliente;
      } else if (ehTitularAntigo) {
        // Titular antigo: não criamos cadastro. Se o login_cliente estiver
        // indefinido/Desconhecido, buscamos no MKAuth pelo CPF para abrir
        // o chamado diretamente no cadastro existente.
        const loginInvalido =
          !loginCliente ||
          loginCliente === "Desconhecido" ||
          loginCliente === "Não informado";
        if (loginInvalido) {
          const cpfLimpo = (dados.cpf || "").toString().replace(/\D/g, "");
          if (cpfLimpo) {
            const clienteExistente = await MkauthSource
              .getRepository(ClientesEntities)
              .findOne({ where: { cpf_cnpj: cpfLimpo } });
            if (clienteExistente?.login) {
              loginCliente = clienteExistente.login;
              solicitacao.login_cliente = loginCliente;
            }
          }
        }

        if (!loginCliente || loginCliente === "Desconhecido") {
          res.status(400).json({
            message:
              "Não foi possível identificar o cadastro do titular original no MKAuth. Verifique o CPF nos dados da solicitação.",
          });
          return;
        }
      }

      const assunto = (solicitacao.servico || "SERVIÇO")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

      const mensagemChamado =
        `Chamado criado manualmente pelo painel (sem assinatura de contrato).\n\n` +
        `Serviço: ${solicitacao.servico || "-"}\n` +
        `👤 Nome: ${dados.nome || "-"}\n` +
        `📄 CPF: ${dados.cpf || "-"}\n` +
        `🪪 RG/IE: ${dados.rg || "-"}\n` +
        `📱 Celular: ${dados.celular || dados.telefone_conversa || "-"}\n` +
        `📧 E-mail: ${dados.email || "-"}\n` +
        `📍 Endereço: ${dados.rua || dados.endereco || "-"}, ${dados.numero || "-"} - ${dados.bairro || "-"}\n` +
        `🏙️ Cidade: ${dados.cidade || "-"}/${dados.estado || "-"}\n` +
        `📮 CEP: ${dados.cep || "-"}\n` +
        `📶 Plano: ${dados.plano || "-"}\n` +
        `📅 Vencimento: Dia ${dados.vencimento || "-"}`;

      let chamadoId: string | null = solicitacao.id_chamado || null;
      if (!jaTemChamado) {
        chamadoId = await criarChamadoMkauth(
          assunto,
          {
            nome: dados.nome || "",
            login: loginCliente || "",
            email: dados.email || "",
          },
          mensagemChamado,
          solicitacao,
        );

        if (!chamadoId) {
          res.status(500).json({
            message: "Não foi possível criar o chamado no MKAuth.",
          });
          return;
        }
      }

      solicitacao.dados = {
        ...dados,
        criadoSemAssinatura: {
          data: new Date().toISOString(),
          usuario: req.user?.login || null,
          login_gerado: deveCriarCadastro ? loginCliente : undefined,
          chamado_existente: jaTemChamado || undefined,
        },
      };
      await repository.save(solicitacao);

      const partes: string[] = [];
      if (deveCriarCadastro) partes.push("Cadastro criado");
      if (!jaTemChamado) partes.push("chamado criado");
      if (jaTemChamado && !deveCriarCadastro)
        partes.push("nenhuma ação necessária: solicitação marcada como dispensada de assinatura");
      const mensagemFinal =
        partes.length > 0
          ? `${partes.join(" e ")} com sucesso (sem assinatura).`
          : "Solicitação marcada como dispensada de assinatura.";

      res.status(200).json({
        success: true,
        id_chamado: chamadoId,
        login_cliente: loginCliente || null,
        message: mensagemFinal,
      });
    } catch (error: any) {
      console.error("Erro ao criar sem assinatura:", error);
      res.status(500).json({
        message: error?.message || "Erro interno ao criar chamado/cadastro sem assinatura.",
      });
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

      if (solicitacao.id_chamado && solicitacao.id_chamado !== id_chamado) {
        res.status(403).json({
          message: `Chamado inválido. Esta solicitação só pode ser finalizada com o chamado ${solicitacao.id_chamado}.`,
        });
        return;
      }

      solicitacao.finalizado = true;
      solicitacao.id_chamado = id_chamado;

      await repository.save(solicitacao);

      // Fecha o chamado no MKAuth
      chamadoExistente.status = "fechado";
      await mkRepository.save(chamadoExistente);

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
