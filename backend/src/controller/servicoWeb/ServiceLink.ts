import { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import moment from "moment-timezone";
import { In, Like } from "typeorm";
import AppDataSource from "../../database/DataSource";
import MkauthDataSource from "../../database/MkauthSource";
import { ServiceLink } from "../../entities/ServiceLink";
import { SolicitacaoServico } from "../../entities/SolicitacaoServico";
import { ClientesEntities as Sis_Cliente } from "../../entities/ClientesEntities";
import { SisPlano } from "../../entities/SisPlano";
import { Faturas } from "../../entities/Faturas";
import Pix from "../Pix";
import { criarChamadoMkauth } from "../whatsapp/services/chamado.service";
import { gerarLancamentoServico } from "../whatsapp/services/payment.service";
import { sendServiceEmail } from "../whatsapp/services/email.service";
import { verificarDebitosClienteDesativado } from "../whatsapp/services/debitoAnterior.service";
import { validarCPF, validarRG } from "../whatsapp/utils/validation";
import { limparNomeRua } from "../whatsapp/utils/helpers";
import {
  buscarServico,
  listarServicos,
  resolverServico,
  formasPagamento,
  resolverCampos,
  ServicoWeb,
  termosDoServico,
} from "./catalogo";
import {
  aplicarValorDoLink,
  gerarContrato,
  liberarContratoPosPagamento,
} from "./contrato";

const MAX_TENTATIVAS_CPF = 5;

/** Todo link vale por 1 dia — não é configurável ao gerar. */
const VALIDADE_DIAS = 1;

type Etapa =
  | "identificar"
  | "selecionar"
  | "termos"
  | "pagamento"
  | "formulario"
  | "concluido";

/** Campos do cadastro do MKAUTH expostos ao formulário público. */
const CAMPOS_CLIENTE = {
  id: true,
  nome: true,
  endereco: true,
  login: true,
  numero: true,
  termo: true,
  email: true,
  rg: true,
  cpf_cnpj: true,
  celular: true,
  plano: true,
  bairro: true,
  cidade: true,
  estado: true,
  cep: true,
  venc: true,
} as const;

function gerarToken() {
  return crypto.randomBytes(16).toString("hex");
}

function linkExpirado(link: ServiceLink) {
  return !!link.expira_em && new Date(link.expira_em).getTime() < Date.now();
}

/** Em que ponto do preenchimento o link está. */
export function etapaAtual(link: ServiceLink, servico: ServicoWeb): Etapa {
  if (link.status === "concluido") return "concluido";
  const dados = link.dados || {};
  // Quem ainda não é cliente não tem cadastro no MKAUTH para consultar nem
  // forma de pagamento a escolher agora: só os termos e o formulário.
  if (servico.clienteNovo) {
    return dados.aceite ? "formulario" : "termos";
  }
  if (!dados.cliente) return dados.cadastros ? "selecionar" : "identificar";
  if (!dados.aceite) return "termos";
  if (!dados.forma_pagamento) return "pagamento";
  return "formulario";
}

/**
 * Há etapa anterior para desfazer? A primeira etapa de cada tipo de serviço
 * e a conclusão não voltam.
 */
function podeVoltar(etapa: Etapa, servico: ServicoWeb): boolean {
  if (etapa === "concluido") return false;
  if (servico.clienteNovo) return etapa === "formulario";
  return etapa !== "identificar";
}

export type Rotulo = {
  texto: string;
  /** Cor sugerida para o chip na listagem interna. */
  tom: "neutro" | "aguardando" | "ok" | "atencao";
};

/** Situação da cobrança: grátis, sem custo, Pix pago ou Pix pendente. */
function rotuloPagamento(
  link: ServiceLink,
  servico: ServicoWeb | undefined,
  solicitacao?: SolicitacaoServico,
): Rotulo {
  if (link.status !== "concluido") {
    return { texto: "-", tom: "neutro" };
  }
  if (servico?.analiseManual) {
    return { texto: "Em análise", tom: "aguardando" };
  }

  const forma = link.dados?.forma_pagamento;
  if (forma === "gratis" || solicitacao?.gratis) {
    return { texto: "Grátis (fidelidade)", tom: "ok" };
  }
  if (forma === "sem_custo") {
    return { texto: "Sem custo", tom: "ok" };
  }
  if (forma === "pix") {
    return solicitacao?.pago
      ? { texto: "Pago", tom: "ok" }
      : { texto: "Aguardando Pix", tom: "atencao" };
  }
  return { texto: "-", tom: "neutro" };
}

/** Situação do contrato no ZapSign. */
function rotuloAssinatura(
  link: ServiceLink,
  solicitacao?: SolicitacaoServico,
): Rotulo {
  if (link.status !== "concluido") {
    return { texto: "-", tom: "neutro" };
  }
  if (solicitacao?.assinado) {
    return { texto: "Assinado", tom: "ok" };
  }
  if (link.resultado?.zapsign?.url) {
    return { texto: "Aguardando assinatura", tom: "atencao" };
  }
  return { texto: "Sem contrato", tom: "neutro" };
}

/** Só o que o cliente precisa ver do próprio cadastro. */
function resumoCliente(cliente: any) {
  return {
    login: cliente.login,
    nome: cliente.nome,
    endereco: cliente.endereco,
    numero: cliente.numero,
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    plano: cliente.plano,
  };
}

function servicoPublico(servico: ServicoWeb) {
  return {
    id: servico.id,
    nome: servico.nome,
    descricao: servico.descricao,
    termos: termosDoServico(servico),
    valor: servico.valor,
    clienteNovo: !!servico.clienteNovo,
    analiseManual: !!servico.analiseManual,
  };
}

class ServiceLinkController {
  private repo = () => AppDataSource.getRepository(ServiceLink);

  // ---------------------------------------------------------------- ADMIN

  /** GET /api/service-links/catalogo */
  public catalogo = async (_req: Request, res: Response) => {
    try {
      const servicos = await listarServicos();
      res.status(200).json(
        servicos.map((s) => ({
          ...servicoPublico(s),
          permiteGratisFidelidade: s.permiteGratisFidelidade,
          permiteValorCustomizado: !!s.permiteValorCustomizado,
          formas_pagamento: formasPagamento(s),
        })),
      );
    } catch (error) {
      console.error("[ServiceLink.catalogo]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao carregar a lista de serviços." }] });
    }
  };

  /** POST /api/service-links */
  public criar = async (req: Request, res: Response) => {
    try {
      const { servico, login, observacao, valor } = req.body || {};

      const catalogo = await resolverServico(String(servico || ""));
      if (!catalogo) {
        res.status(400).json({
          errors: [
            {
              msg: "Serviço inválido ou sem template cadastrado em Configurações do ZapSign.",
            },
          ],
        });
        return;
      }

      // Campo em branco = mantém o valor do catálogo (coluna fica nula).
      let valorLink: string | null = null;
      if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
        const numero = Number(String(valor).replace(",", "."));
        if (!Number.isFinite(numero) || numero < 0) {
          res.status(400).json({
            errors: [{ msg: "Valor inválido. Use apenas números, ex.: 200,00." }],
          });
          return;
        }
        if (!catalogo.permiteValorCustomizado) {
          res.status(400).json({
            errors: [
              { msg: `O serviço ${catalogo.nome} não aceita valor personalizado.` },
            ],
          });
          return;
        }
        valorLink = numero.toFixed(2);
      }

      let cliente: Sis_Cliente | null = null;
      if (login) {
        cliente = await MkauthDataSource.getRepository(Sis_Cliente).findOne({
          select: CAMPOS_CLIENTE,
          where: { login: String(login).trim(), cli_ativado: "s" },
        });
        if (!cliente) {
          res.status(404).json({
            errors: [
              { msg: `Nenhum cliente ativo encontrado com o login ${login}.` },
            ],
          });
          return;
        }
      }

      const link = await this.repo().save({
        token: gerarToken(),
        servico: catalogo.id,
        login_cliente: cliente?.login ?? null,
        cpf: cliente?.cpf_cnpj ?? null,
        nome_cliente: cliente?.nome ?? null,
        status: "pendente" as const,
        // Validade fixa de 1 dia: o link é sempre para o atendimento em curso.
        expira_em: moment().add(VALIDADE_DIAS, "days").toDate(),
        tentativas: 0,
        criado_por: req.user?.login ?? null,
        observacao: observacao ? String(observacao).slice(0, 255) : null,
        valor: valorLink,
      });

      res.status(201).json(link);
    } catch (error) {
      console.error("[ServiceLink.criar]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao gerar link." }] });
    }
  };

  /** GET /api/service-links */
  public listar = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, status, servico, cliente } = req.query;
      const where: any = {};
      if (status) where.status = String(status);
      if (servico) where.servico = String(servico);
      if (cliente) where.nome_cliente = Like(`%${String(cliente)}%`);

      const pageNum = Number(page);
      const limitNum = Number(limit);

      const [data, total] = await this.repo().findAndCount({
        where,
        order: { criado_em: "DESC" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      });

      // Pagamento e assinatura vivem na solicitação — os webhooks do Pix e do
      // ZapSign atualizam lá. Busca todas de uma vez para não consultar por linha.
      const ids = data
        .map((l) => l.resultado?.solicitacao_id)
        .filter((id): id is number => Number.isFinite(id));
      const solicitacoes = ids.length
        ? await AppDataSource.getRepository(SolicitacaoServico).find({
            where: { id: In(ids) },
          })
        : [];
      const porId = new Map(solicitacoes.map((s) => [s.id, s]));
      // Nomes vêm da tabela de templates; links de serviços removidos de lá
      // continuam listados pelo catálogo, para não sumir do histórico.
      const disponiveis = new Map(
        (await listarServicos()).map((s) => [s.id, s]),
      );

      res.status(200).json({
        data: data.map((l) => {
          const servicoCatalogo =
            disponiveis.get(l.servico) ?? buscarServico(l.servico);
          const solicitacao = porId.get(l.resultado?.solicitacao_id);
          return {
            ...l,
            servico_nome: servicoCatalogo?.nome ?? l.servico,
            expirado: linkExpirado(l),
            pagamento: rotuloPagamento(l, servicoCatalogo, solicitacao),
            assinatura: rotuloAssinatura(l, solicitacao),
          };
        }),
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error("[ServiceLink.listar]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao listar links." }] });
    }
  };

  /** POST /api/service-links/:id/cancelar */
  public cancelar = async (req: Request, res: Response) => {
    try {
      const link = await this.repo().findOne({
        where: { id: Number(req.params.id) },
      });
      if (!link) {
        res.status(404).json({ errors: [{ msg: "Link não encontrado." }] });
        return;
      }
      if (link.status === "concluido") {
        res.status(400).json({
          errors: [{ msg: "Este link já foi concluído e não pode ser cancelado." }],
        });
        return;
      }
      link.status = "cancelado";
      await this.repo().save(link);
      res.status(200).json(link);
    } catch (error) {
      console.error("[ServiceLink.cancelar]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao cancelar link." }] });
    }
  };

  // -------------------------------------------------------------- PÚBLICO

  /** Carrega o link e valida se ainda pode ser usado. */
  private async carregar(
    req: Request,
    res: Response,
  ): Promise<{ link: ServiceLink; servico: ServicoWeb } | null> {
    const link = await this.repo().findOne({
      where: { token: String(req.params.token || "") },
    });
    if (!link) {
      res.status(404).json({ errors: [{ msg: "Link não encontrado." }] });
      return null;
    }
    if (link.status === "cancelado") {
      res
        .status(410)
        .json({ errors: [{ msg: "Este link foi cancelado pelo atendimento." }] });
      return null;
    }
    if (linkExpirado(link)) {
      res.status(410).json({
        errors: [{ msg: "Este link expirou. Solicite um novo ao atendimento." }],
      });
      return null;
    }
    // O serviço pode ter sido removido da tabela de templates no meio do caminho.
    const base = await resolverServico(link.servico);
    // O preço combinado no link manda sobre o valor padrão do catálogo.
    const servico = base ? aplicarValorDoLink(base, link) : base;
    if (!servico) {
      res.status(410).json({
        errors: [
          {
            msg: "Este serviço não está mais disponível. Entre em contato com o atendimento.",
          },
        ],
      });
      return null;
    }
    return { link, servico };
  }

  /** GET /api/service-links/publico/:token */
  public abrir = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      if (link.status === "pendente") {
        link.status = "em_andamento";
        link.aberto_em = new Date();
        await this.repo().save(link);
      }

      res.status(200).json(await this.montarEstado(link, servico));
    } catch (error) {
      console.error("[ServiceLink.abrir]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao abrir o link." }] });
    }
  };

  /** Estado completo do link, usado ao abrir e ao voltar de etapa. */
  private async montarEstado(link: ServiceLink, servico: ServicoWeb) {
    const etapa = etapaAtual(link, servico);
    return {
      servico: servicoPublico(servico),
      etapa,
      vinculado: !!link.login_cliente,
      cliente: link.dados?.cliente ? resumoCliente(link.dados.cliente) : null,
      cadastros: link.dados?.cadastros ?? null,
      formas_pagamento: formasPagamento(servico),
      campos: etapa === "formulario" ? await resolverCampos(servico) : null,
      resultado: link.status === "concluido" ? link.resultado : null,
      pode_voltar: podeVoltar(etapa, servico),
    };
  }

  /**
   * POST /api/service-links/publico/:token/voltar
   * Desfaz a última etapa concluída para o cliente corrigir o que informou.
   */
  public voltar = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      const etapa = etapaAtual(link, servico);
      if (!podeVoltar(etapa, servico)) {
        res.status(400).json({
          errors: [{ msg: "Não há etapa anterior para voltar." }],
        });
        return;
      }

      const dados = { ...(link.dados || {}) };
      switch (etapa) {
        case "formulario":
          // Cliente novo só tem termos atrás; os demais voltam ao pagamento.
          if (servico.clienteNovo) delete dados.aceite;
          else delete dados.forma_pagamento;
          break;
        case "pagamento":
          delete dados.aceite;
          break;
        case "termos":
          delete dados.cliente;
          break;
        case "selecionar":
          delete dados.cadastros;
          delete dados.cpf;
          break;
      }

      link.dados = dados;
      await this.repo().save(link);

      res.status(200).json(await this.montarEstado(link, servico));
    } catch (error) {
      console.error("[ServiceLink.voltar]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao voltar de etapa." }] });
    }
  };

  /** POST /api/service-links/publico/:token/identificar { cpf } */
  public identificar = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      if (servico.clienteNovo) {
        res.status(400).json({
          errors: [
            { msg: "Este serviço não exige cadastro existente. Preencha o formulário." },
          ],
        });
        return;
      }

      if (link.tentativas >= MAX_TENTATIVAS_CPF) {
        res.status(429).json({
          errors: [
            {
              msg: "Número de tentativas excedido. Entre em contato com o atendimento.",
            },
          ],
        });
        return;
      }

      const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
      if (cpf.length !== 11 && cpf.length !== 14) {
        res
          .status(400)
          .json({ errors: [{ msg: "CPF/CNPJ inválido. Verifique e tente novamente." }] });
        return;
      }

      const where: any = { cpf_cnpj: cpf, cli_ativado: "s" };
      // Link gerado para um cliente específico só abre para aquele cadastro.
      if (link.login_cliente) where.login = link.login_cliente;

      const cadastros = await MkauthDataSource.getRepository(Sis_Cliente).find({
        select: CAMPOS_CLIENTE,
        where,
      });

      if (cadastros.length === 0) {
        link.tentativas += 1;
        await this.repo().save(link);
        res.status(404).json({
          errors: [
            {
              msg: "Nenhum cadastro ativo encontrado para este CPF/CNPJ neste link.",
            },
          ],
          tentativas_restantes: MAX_TENTATIVAS_CPF - link.tentativas,
        });
        return;
      }

      link.tentativas = 0;
      link.dados = { ...(link.dados || {}), cpf };

      // Cadastro único: já segue direto para a escolha da forma de pagamento.
      if (cadastros.length === 1) {
        link.dados = { ...link.dados, cliente: cadastros[0], cadastros: null };
        await this.repo().save(link);
        res.status(200).json({
          etapa: "termos",
          cliente: resumoCliente(cadastros[0]),
          termos: termosDoServico(servico),
        });
        return;
      }

      link.dados = {
        ...link.dados,
        cadastros: cadastros.map(resumoCliente),
      };
      await this.repo().save(link);
      res.status(200).json({
        etapa: "selecionar",
        cadastros: cadastros.map(resumoCliente),
      });
    } catch (error) {
      console.error("[ServiceLink.identificar]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao localizar o cadastro." }] });
    }
  };

  /** POST /api/service-links/publico/:token/selecionar { login } */
  public selecionar = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      const cpf = link.dados?.cpf;
      if (!cpf) {
        res
          .status(400)
          .json({ errors: [{ msg: "Informe o CPF/CNPJ antes de escolher o cadastro." }] });
        return;
      }

      const cliente = await MkauthDataSource.getRepository(Sis_Cliente).findOne({
        select: CAMPOS_CLIENTE,
        where: {
          login: String(req.body?.login || "").trim(),
          cpf_cnpj: cpf,
          cli_ativado: "s",
        },
      });
      if (!cliente) {
        res.status(404).json({ errors: [{ msg: "Cadastro não encontrado." }] });
        return;
      }

      // A lista é mantida para o cliente poder voltar e trocar de cadastro.
      link.dados = { ...(link.dados || {}), cliente };
      await this.repo().save(link);

      res.status(200).json({
        etapa: "termos",
        cliente: resumoCliente(cliente),
        termos: termosDoServico(servico),
      });
    } catch (error) {
      console.error("[ServiceLink.selecionar]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao selecionar o cadastro." }] });
    }
  };

  /**
   * POST /api/service-links/publico/:token/termos { aceites: string[] }
   * Registra o aceite dos termos com data e IP, para servir de comprovação.
   */
  public aceitarTermos = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      if (!servico.clienteNovo && !link.dados?.cliente) {
        res
          .status(400)
          .json({ errors: [{ msg: "Identifique o cadastro antes de continuar." }] });
        return;
      }

      const termos = termosDoServico(servico);
      const aceites: string[] = Array.isArray(req.body?.aceites)
        ? req.body.aceites.map(String)
        : [];
      const faltando = termos.filter((t) => !aceites.includes(t.id));
      if (faltando.length > 0) {
        res.status(400).json({
          errors: [
            {
              msg: `Aceite todos os termos para continuar: ${faltando
                .map((t) => t.titulo)
                .join(", ")}.`,
            },
          ],
        });
        return;
      }

      link.dados = {
        ...(link.dados || {}),
        aceite: {
          termos: termos.map((t) => ({ id: t.id, titulo: t.titulo, url: t.url })),
          em: new Date().toISOString(),
          ip: req.ip ?? null,
          user_agent: req.headers["user-agent"] ?? null,
        },
      };
      await this.repo().save(link);

      const proxima: Etapa = servico.clienteNovo
        ? "formulario"
        : link.dados.forma_pagamento
          ? "formulario"
          : formasPagamento(servico).length > 0
            ? "pagamento"
            : "formulario";

      res.status(200).json({
        etapa: proxima,
        formas_pagamento: formasPagamento(servico),
        campos: proxima === "formulario" ? await resolverCampos(servico) : null,
      });
    } catch (error) {
      console.error("[ServiceLink.aceitarTermos]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao registrar o aceite dos termos." }] });
    }
  };

  /** POST /api/service-links/publico/:token/pagamento { forma_pagamento } */
  public escolherPagamento = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      if (!link.dados?.cliente) {
        res
          .status(400)
          .json({ errors: [{ msg: "Identifique o cadastro antes de continuar." }] });
        return;
      }
      if (!link.dados?.aceite) {
        res
          .status(400)
          .json({ errors: [{ msg: "Aceite os termos antes de continuar." }] });
        return;
      }

      const escolhida = String(req.body?.forma_pagamento || "");
      const formas = formasPagamento(servico);
      if (!formas.some((f) => f.id === escolhida)) {
        res
          .status(400)
          .json({ errors: [{ msg: "Forma de pagamento inválida." }] });
        return;
      }

      link.dados = { ...link.dados, forma_pagamento: escolhida };
      await this.repo().save(link);

      res.status(200).json({
        etapa: "formulario",
        campos: await resolverCampos(servico),
      });
    } catch (error) {
      console.error("[ServiceLink.escolherPagamento]", error);
      res
        .status(500)
        .json({ errors: [{ msg: "Erro ao registrar a forma de pagamento." }] });
    }
  };

  /** POST /api/service-links/publico/:token/enviar { formulario } */
  public enviar = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link, servico } = ctx;

      if (link.status === "concluido") {
        res.status(409).json({
          errors: [{ msg: "Esta solicitação já foi enviada." }],
          resultado: link.resultado,
        });
        return;
      }

      const cliente = link.dados?.cliente;
      const formaPagamento = link.dados?.forma_pagamento;
      if (!servico.clienteNovo && (!cliente || !formaPagamento)) {
        res.status(400).json({
          errors: [{ msg: "Complete as etapas anteriores antes de enviar." }],
        });
        return;
      }
      if (!link.dados?.aceite) {
        res
          .status(400)
          .json({ errors: [{ msg: "Aceite os termos antes de enviar." }] });
        return;
      }

      const formulario = (req.body?.formulario || {}) as Record<string, any>;
      const faltando = servico.campos
        .filter((c) => c.required && !String(formulario[c.name] ?? "").trim())
        .map((c) => c.label);
      if (faltando.length > 0) {
        res.status(400).json({
          errors: [{ msg: `Preencha os campos obrigatórios: ${faltando.join(", ")}.` }],
        });
        return;
      }

      const resultado = servico.clienteNovo
        ? await this.processarCadastroNovo(link, servico, formulario)
        : await this.processarSolicitacao(
            link,
            servico,
            cliente,
            String(formaPagamento),
            formulario,
          );

      link.dados = { ...link.dados, formulario };
      link.resultado = resultado;
      link.solicitacao_id = resultado.solicitacao_id ?? null;
      link.status = "concluido";
      link.concluido_em = new Date();
      await this.repo().save(link);

      res.status(200).json({ etapa: "concluido", resultado });
    } catch (error: any) {
      console.error("[ServiceLink.enviar]", error);
      res.status(500).json({
        errors: [
          {
            msg:
              error?.message ||
              "Erro ao registrar a solicitação. Entre em contato com o atendimento.",
          },
        ],
      });
    }
  };

  /**
   * Instalação: o solicitante ainda não é cliente, então nada é cobrado nem
   * assinado agora — a solicitação entra na fila de análise, igual ao bot.
   */
  private async processarCadastroNovo(
    link: ServiceLink,
    servico: ServicoWeb,
    formulario: Record<string, any>,
  ) {
    const nome = String(formulario.nome || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

    const partes = nome.split(" ").filter(Boolean);
    if (partes.length < 2 || partes[0].length < 2) {
      throw new Error(
        "Informe o nome completo (nome e sobrenome), sem números ou abreviações.",
      );
    }

    const cpf = String(formulario.cpf || "").replace(/\D/g, "");
    if (!validarCPF(cpf)) {
      throw new Error("O CPF/CNPJ informado é inválido.");
    }

    const rg = String(formulario.rg || "").trim();
    if (rg && !validarRG(rg)) {
      throw new Error("O RG/IE informado é inválido.");
    }

    const cep = String(formulario.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) {
      throw new Error("O CEP informado é inválido. Digite os 8 números.");
    }

    const celular = String(formulario.celular || "").replace(/\D/g, "");
    if (celular.length < 10) {
      throw new Error("O celular informado é inválido. Digite DDD + número.");
    }

    let { cidade, estado, bairro } = formulario;
    if (!cidade || !estado || !bairro) {
      try {
        const resp = await axios.get(
          `https://viacep.com.br/ws/${cep}/json/`,
          { timeout: 5000 },
        );
        if (resp.data && !resp.data.erro) {
          cidade = cidade || resp.data.localidade || "";
          estado = estado || resp.data.uf || "";
          bairro = bairro || resp.data.bairro || "";
        }
      } catch (e) {
        console.error("[ServiceLink] Erro ao consultar o ViaCEP:", e);
      }
    }

    const login = nome.replace(/\s+/g, "").toUpperCase();
    const dados: Record<string, any> = {
      ...formulario,
      origem: "web",
      token_link: link.token,
      aceite_termos: link.dados?.aceite ?? null,
      nome,
      login,
      cpf,
      rg,
      cep,
      celular,
      cidade,
      estado,
      bairro,
      rua: limparNomeRua(String(formulario.rua || "")),
      plano: formulario.plano_escolhido || "",
      vencimento: formulario.vencimento || "",
    };

    // Valor combinado ao gerar o link: a cobrança da instalação sai depois,
    // pela tela de solicitações, já com esse preço preenchido.
    if (link.valor !== null && link.valor !== undefined) {
      dados.valor = Number(link.valor).toFixed(2);
    }

    const debitoAnterior = await verificarDebitosClienteDesativado(cpf);

    const solicitacaoRepo = AppDataSource.getRepository(SolicitacaoServico);
    const solicitacao = await solicitacaoRepo.save({
      servico: servico.nome,
      login_cliente: login,
      data_solicitacao: new Date(),
      assinado: false,
      pago: false,
      gratis: 0,
      finalizado: false,
      dados: {
        ...dados,
        ...(debitoAnterior.temDebito && { alertaDebitoAnterior: debitoAnterior }),
      },
    });

    const resumoHtml =
      `<h3>Nova Solicitação de Instalação (site)</h3>` +
      `<p><b>Nome:</b> ${nome}</p>` +
      `<p><b>CPF/CNPJ:</b> ${cpf}</p>` +
      `<p><b>RG/IE:</b> ${rg || "-"}</p>` +
      `<p><b>Nascimento:</b> ${dados.dataNascimento || "-"}</p>` +
      `<p><b>Celular:</b> ${celular}</p>` +
      `<p><b>Email:</b> ${dados.email || "-"}</p>` +
      `<p><b>Endereço:</b> ${dados.rua}, ${dados.numero} - ${bairro}</p>` +
      `<p><b>Cidade:</b> ${cidade}/${estado}</p>` +
      `<p><b>CEP:</b> ${cep}</p>` +
      `<p><b>Plano:</b> ${dados.plano}</p>` +
      `<p><b>Vencimento:</b> Dia ${dados.vencimento}</p>` +
      (debitoAnterior.temDebito
        ? `<p><b>⚠️ Débito anterior:</b> ${debitoAnterior.contas
            .map((c) => `${c.login} (R$ ${c.valorTotal.toFixed(2)})`)
            .join(", ")}</p>`
        : "");

    try {
      sendServiceEmail(resumoHtml);
    } catch (e) {
      console.error("[ServiceLink] Erro ao enviar e-mail de instalação:", e);
    }

    return {
      solicitacao_id: solicitacao.id,
      chamado: null,
      pix: null,
      zapsign: null,
      analise_manual: true,
      protocolo: `SOL-${solicitacao.id}`,
    };
  }

  /**
   * Executa o mesmo encadeamento do bot: solicitação, e-mail, chamado,
   * cobrança (quando paga via Pix) e contrato no ZapSign.
   */
  private async processarSolicitacao(
    link: ServiceLink,
    servico: ServicoWeb,
    cliente: any,
    formaPagamento: string,
    formulario: Record<string, any>,
  ) {
    const pago = formaPagamento === "pix";
    const gratis = formaPagamento === "gratis";

    const planoNome = formulario.plano_escolhido || cliente.plano || "";
    const planoRecord = planoNome
      ? await MkauthDataSource.getRepository(SisPlano).findOne({
          where: { nome: planoNome },
        })
      : null;

    const dadosSolicitacao = {
      origem: "web",
      token_link: link.token,
      servico: servico.id,
      forma_pagamento: formaPagamento,
      aceite_termos: link.dados?.aceite ?? null,
      nome: cliente.nome,
      cpf: cliente.cpf_cnpj,
      email: cliente.email,
      telefone: cliente.celular,
      login: cliente.login,
      rg: cliente.rg,
      endereco: cliente.endereco,
      numero: cliente.numero,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      vencimento: cliente.venc,
      termo: cliente.termo || "",
      plano: planoNome,
      valor: planoRecord?.valor || "0.00",
      valor_plano: planoRecord?.valor || "0.00",
      ...formulario,
    };

    const solicitacaoRepo = AppDataSource.getRepository(SolicitacaoServico);
    const solicitacao = await solicitacaoRepo.save({
      servico: servico.nome,
      login_cliente: cliente.login,
      pago: false,
      gratis: gratis ? 1 : 0,
      dados: dadosSolicitacao,
      finalizado: false,
    });

    const linhas = servico.campos
      .map((c) => `<p><b>${c.label}:</b> ${formulario[c.name] ?? "-"}</p>`)
      .join("");
    const resumoHtml =
      `<h3>${servico.nome} — solicitação pela web</h3>` +
      `<p><b>Cliente:</b> ${cliente.nome}</p>` +
      `<p><b>Login:</b> ${cliente.login}</p>` +
      `<p><b>CPF/CNPJ:</b> ${cliente.cpf_cnpj}</p>` +
      `<p><b>Celular:</b> ${cliente.celular || "-"}</p>` +
      `<p><b>Forma:</b> ${formaPagamento}</p>` +
      linhas;

    try {
      sendServiceEmail(resumoHtml);
    } catch (e) {
      console.error("[ServiceLink] Erro ao enviar e-mail:", e);
    }

    const resumoTexto =
      `*${servico.nome}* (solicitado pelo site)\n` +
      `Cliente: ${cliente.nome}\n` +
      `Login: ${cliente.login}\n` +
      `Forma: ${formaPagamento}\n` +
      servico.campos
        .map((c) => `${c.label}: ${formulario[c.name] ?? "-"}`)
        .join("\n");

    let chamadoId: string | null = null;
    try {
      chamadoId = await criarChamadoMkauth(
        servico.assuntoChamado,
        { nome: cliente.nome, login: cliente.login, email: cliente.email },
        resumoTexto,
        solicitacao,
      );
    } catch (e) {
      console.error("[ServiceLink] Erro ao abrir chamado:", e);
    }

    // Cobrança via Pix
    let pix: any = null;
    if (pago && servico.valor > 0) {
      try {
        // Serviços sem tipo fixo de lançamento (preço combinado no link) entram
        // com o próprio id e o valor do serviço.
        const lancamento = await gerarLancamentoServico(
          { cpf: cliente.cpf_cnpj, login: cliente.login },
          servico.tipoLancamento ?? servico.id,
          { valor: servico.valor, nomeServico: servico.nome },
        );
        if (lancamento) {
          solicitacao.id_fatura = lancamento.id;
          await solicitacaoRepo.save(solicitacao);

          const pixData = await new Pix().gerarPixServico({
            idLancamento: lancamento.id!,
            valor: lancamento.valor!,
            pppoe: lancamento.login!,
            cpf: cliente.cpf_cnpj,
          });
          pix = {
            id_fatura: lancamento.id,
            valor: lancamento.valor,
            link: pixData.link,
            copia_e_cola: pixData.qrcode,
            txid: pixData.txid,
          };
        }
      } catch (e) {
        console.error("[ServiceLink] Erro ao gerar Pix:", e);
      }
    }

    // Contrato para assinatura, seguindo o bot: na Mudança de Cômodo paga não
    // há termo; nos demais pagos ele só sai depois do Pix confirmado, gerado
    // pelo polling de status ou pelo webhook.
    const semContrato = pago && !!servico.semContratoNaOpcaoPaga;
    const contratoAposPagamento =
      !!pix && !!servico.criarContrato && !semContrato;
    let zapsign: any = null;
    if (servico.criarContrato && !contratoAposPagamento && !semContrato) {
      zapsign = await gerarContrato(servico, solicitacao, dadosSolicitacao, pago);
    }

    return {
      solicitacao_id: solicitacao.id,
      chamado: chamadoId,
      pix,
      zapsign,
      contrato_apos_pagamento: contratoAposPagamento,
      protocolo: chamadoId || `SOL-${solicitacao.id}`,
    };
  }

  /** GET /api/service-links/publico/:token/status */
  public status = async (req: Request, res: Response) => {
    try {
      const ctx = await this.carregar(req, res);
      if (!ctx) return;
      const { link } = ctx;

      const idFatura = link.resultado?.pix?.id_fatura;
      let pagoConfirmado = false;
      if (idFatura) {
        const fatura = await MkauthDataSource.getRepository(Faturas).findOne({
          where: { id: idFatura },
        });
        pagoConfirmado = fatura?.status === "pago";
      }

      let assinado = false;
      if (link.resultado?.solicitacao_id) {
        const solicitacaoRepo = AppDataSource.getRepository(SolicitacaoServico);
        const solicitacao = await solicitacaoRepo.findOne({
          where: { id: link.resultado.solicitacao_id },
        });
        assinado = !!solicitacao?.assinado;
        // Espelha o pagamento confirmado na solicitação de serviço.
        if (pagoConfirmado && solicitacao && !solicitacao.pago) {
          solicitacao.pago = true;
          await solicitacaoRepo.save(solicitacao);
        }

        // Pagou: agora o contrato pode ser assinado. O token na solicitação
        // evita gerar um segundo documento se o webhook do Pix chegar antes.
        if (pagoConfirmado && solicitacao) {
          await liberarContratoPosPagamento(solicitacao);
          const atualizado = await this.repo().findOne({
            where: { id: link.id },
          });
          if (atualizado) link.resultado = atualizado.resultado;
        }
      }

      res.status(200).json({
        status: link.status,
        pago: pagoConfirmado,
        assinado,
        resultado: link.resultado ?? null,
      });
    } catch (error) {
      console.error("[ServiceLink.status]", error);
      res.status(500).json({ errors: [{ msg: "Erro ao consultar status." }] });
    }
  };
}

export default new ServiceLinkController();
