import { IsNull, MoreThan } from "typeorm";

import AppDataSource from "../database/DataSource";
import {
  DestinoNotificacao,
  TvWipNotificacao,
} from "../entities/TvWipNotificacao";
import TvWipCanaisService from "./TvWipCanaisService";

const DESTINOS: DestinoNotificacao[] = ["todos", "pacotes", "logins"];

/** Quantas o app recebe de uma vez: o envelope é recado, não arquivo. */
const LIMITE_APP = 30;

/** O que o aplicativo recebe de cada notificação. */
export interface NotificacaoApp {
  id: number;
  titulo: string;
  mensagem: string;
  enviada_em: string;
}

export interface DadosNotificacao {
  titulo?: unknown;
  mensagem?: unknown;
  destino?: unknown;
  alvos?: unknown;
  expira_em?: unknown;
  criadoPor?: string;
}

function paraApp(n: TvWipNotificacao): NotificacaoApp {
  return {
    id: n.id,
    titulo: n.titulo,
    mensagem: n.mensagem,
    enviada_em: new Date(n.created_at).toISOString(),
  };
}

class TvWipNotificacoesService {
  private repo() {
    return AppDataSource.getRepository(TvWipNotificacao);
  }

  /** Histórico do painel, mais novas primeiro. */
  async listar(): Promise<TvWipNotificacao[]> {
    return this.repo().find({ order: { created_at: "DESC" }, take: 200 });
  }

  async criar(dados: DadosNotificacao): Promise<TvWipNotificacao> {
    const titulo = String(dados.titulo ?? "").trim();
    const mensagem = String(dados.mensagem ?? "").trim();
    const destino = String(dados.destino ?? "todos") as DestinoNotificacao;

    if (!titulo) throw new Error("Informe o título.");
    if (titulo.length > 120) throw new Error("O título passa de 120 caracteres.");
    if (!mensagem) throw new Error("Escreva a mensagem.");
    if (mensagem.length > 2000) {
      throw new Error("A mensagem passa de 2000 caracteres.");
    }
    if (!DESTINOS.includes(destino)) throw new Error("Destino inválido.");

    const bruto = Array.isArray(dados.alvos) ? dados.alvos : [];
    let alvos: (string | number)[] | null = null;

    if (destino === "pacotes") {
      alvos = Array.from(
        new Set(
          bruto.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0),
        ),
      );
      if (alvos.length === 0) throw new Error("Escolha ao menos um pacote.");
    }

    if (destino === "logins") {
      alvos = Array.from(
        new Set(bruto.map((v) => String(v ?? "").trim()).filter(Boolean)),
      );
      if (alvos.length === 0) throw new Error("Informe ao menos um login.");
    }

    let expira: Date | null = null;
    if (dados.expira_em) {
      expira = new Date(String(dados.expira_em));
      if (Number.isNaN(expira.getTime())) throw new Error("Data de validade inválida.");
      if (expira.getTime() <= Date.now()) {
        throw new Error("A validade precisa ser uma data futura.");
      }
    }

    return this.repo().save(
      this.repo().create({
        titulo,
        mensagem,
        destino,
        alvos,
        expira_em: expira,
        ativo: true,
        criado_por: dados.criadoPor || null,
      }),
    );
  }

  /** Liga ou desliga no app sem apagar do histórico. */
  async definirAtivo(id: number, ativo: boolean): Promise<TvWipNotificacao> {
    const notificacao = await this.repo().findOne({ where: { id } });
    if (!notificacao) throw new Error("Notificação não encontrada.");
    notificacao.ativo = ativo;
    return this.repo().save(notificacao);
  }

  async remover(id: number): Promise<void> {
    const resultado = await this.repo().delete({ id });
    if (!resultado.affected) throw new Error("Notificação não encontrada.");
  }

  /** Em vigor agora: ligadas e dentro da validade. */
  private async emVigor(): Promise<TvWipNotificacao[]> {
    const agora = new Date();
    return this.repo().find({
      where: [
        { ativo: true, expira_em: IsNull() },
        { ativo: true, expira_em: MoreThan(agora) },
      ],
      order: { created_at: "DESC" },
      take: 300,
    });
  }

  /**
   * Notificações de um login do app.
   *
   * O filtro por pacote usa os pacotes efetivos da conta — os atribuídos ou,
   * sem nenhum, os padrão —, que é o que ela assiste de fato.
   */
  async doLogin(login: string): Promise<NotificacaoApp[]> {
    const todas = await this.emVigor();
    const precisaPacotes = todas.some((n) => n.destino === "pacotes");

    let pacotes = new Set<number>();
    if (precisaPacotes) {
      const mapa = await TvWipCanaisService.pacotesDetalhadosDasContas([login]);
      pacotes = new Set((mapa.get(login) ?? []).map((p) => p.id));
    }

    const loginNormal = login.trim().toLowerCase();

    return todas
      .filter((n) => {
        if (n.destino === "todos") return true;
        const alvos = n.alvos ?? [];
        if (n.destino === "pacotes") {
          return alvos.some((id) => pacotes.has(Number(id)));
        }
        return alvos.some((l) => String(l).trim().toLowerCase() === loginNormal);
      })
      .slice(0, LIMITE_APP)
      .map(paraApp);
  }

  /** Só os avisos gerais — para os logins fixos do app, que não têm conta. */
  async publicas(): Promise<NotificacaoApp[]> {
    const todas = await this.emVigor();
    return todas
      .filter((n) => n.destino === "todos")
      .slice(0, LIMITE_APP)
      .map(paraApp);
  }
}

export default new TvWipNotificacoesService();
