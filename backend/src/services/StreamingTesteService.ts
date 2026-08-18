import { LessThanOrEqual } from "typeorm";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { StreamingAssinante } from "../entities/StreamingAssinante";
import { SisSerContratos } from "../entities/SisSerContratos";
import { deleteTicket } from "./WatchBrasilService";

/** Tags de streaming em sis_ser_contratos. */
const TIPOS_STREAMING = ["STREAMER", "STREAMER_COLAB"];

/** De quanto em quanto tempo os testes vencidos são varridos. */
const INTERVALO_MS = 60_000;

/**
 * Assinaturas de teste da Watch TV: quando o prazo acaba, o cadastro sai da
 * Watch Brasil e o serviço some do contrato do cliente.
 */
class StreamingTesteService {
  private timer: NodeJS.Timeout | null = null;
  private rodando = false;

  start() {
    if (this.timer) return;
    // Uma passada no boot pega o que venceu com o sistema fora do ar.
    this.varrer().catch(() => undefined);
    this.timer = setInterval(() => {
      this.varrer().catch(() => undefined);
    }, INTERVALO_MS);
    console.log("[StreamingTeste] Monitor de assinaturas de teste iniciado.");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Encerra todos os testes cujo prazo já passou. */
  async varrer(): Promise<number> {
    // Evita duas varreduras simultâneas quando a remoção demora.
    if (this.rodando) return 0;
    this.rodando = true;
    try {
      const repo = AppDataSource.getRepository(StreamingAssinante);
      // NULL nunca satisfaz uma comparação em SQL, então assinaturas sem
      // prazo ficam de fora sem precisar de filtro extra.
      const vencidos = await repo.find({
        where: { teste_expira_em: LessThanOrEqual(new Date()) },
      });

      let encerrados = 0;
      for (const assinante of vencidos) {
        if (!assinante.teste_expira_em) continue;
        try {
          await this.encerrar(assinante);
          encerrados += 1;
        } catch (e: any) {
          console.error(
            `[StreamingTeste] Falha ao encerrar o teste de ${assinante.login}:`,
            e?.response?.data || e?.message || e,
          );
        }
      }
      return encerrados;
    } finally {
      this.rodando = false;
    }
  }

  /** Remove o cadastro na Watch Brasil e o serviço do contrato. */
  async encerrar(assinante: StreamingAssinante): Promise<void> {
    if (assinante.ticket) {
      await deleteTicket(assinante.ticket);
    }

    const contratos = MkauthSource.getRepository(SisSerContratos);
    const remover = await contratos
      .createQueryBuilder("s")
      .where("UPPER(TRIM(s.login)) = UPPER(TRIM(:login))", {
        login: assinante.login,
      })
      .andWhere("UPPER(TRIM(s.nome)) IN (:...tipos)", { tipos: TIPOS_STREAMING })
      .getMany();

    if (remover.length > 0) {
      await contratos.delete(remover.map((r) => r.id));
    }

    await AppDataSource.getRepository(StreamingAssinante).delete(assinante.id);

    console.log(
      `[StreamingTeste] Teste encerrado: ${assinante.login} removido da Watch Brasil` +
        ` e ${remover.length} serviço(s) excluído(s) do contrato.`,
    );
  }
}

export default new StreamingTesteService();
