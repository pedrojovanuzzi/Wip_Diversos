import { IsNull } from "typeorm";
import LocalDataSource from "../database/DataSource";
import { StreamingTeste } from "../entities/StreamingTeste";

/**
 * Registro dos testes grátis da Watch TV.
 *
 * Existe porque a assinatura de teste é apagada quando o prazo acaba: sem
 * este histórico, o cliente que testou e depois contratou apareceria como se
 * nunca tivesse usado o serviço, e o proporcional cobraria só os dias a
 * partir da contratação.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

function repo() {
  return LocalDataSource.getRepository(StreamingTeste);
}

/** Dias corridos entre duas datas, nunca negativo. */
function diasEntre(inicio: Date, fim: Date): number {
  const dias = Math.floor((fim.getTime() - inicio.getTime()) / MS_DIA);
  return dias > 0 ? dias : 0;
}

/**
 * Tabela ainda não criada (migration pendente): o fluxo do cliente não pode
 * parar por causa do histórico.
 */
function tabelaAusente(erro: any): boolean {
  return erro?.code === "ER_NO_SUCH_TABLE" || erro?.errno === 1146;
}

/** Marca o começo de um teste grátis. */
export async function registrarInicioTeste(
  login: string,
  fimPrevisto: Date | null,
): Promise<void> {
  if (!login) return;
  try {
    const aberto = await repo().findOne({
      where: { login, fim: IsNull() },
      order: { id: "DESC" },
    });

    // Teste reaberto (prazo estendido): só atualiza a previsão.
    if (aberto) {
      aberto.fimPrevisto = fimPrevisto;
      await repo().save(aberto);
      return;
    }

    await repo().save(
      repo().create({
        login,
        inicio: new Date(),
        fimPrevisto,
        dias: 0,
      }),
    );
  } catch (erro: any) {
    if (tabelaAusente(erro)) {
      console.warn(
        "⚠️ Histórico de teste da Watch TV: tabela ainda não existe. Rode 'npm run migration:run'.",
      );
      return;
    }
    console.error("Falha ao registrar o início do teste:", erro);
  }
}

/**
 * Fecha o teste em andamento e guarda quantos dias o cliente usou.
 *
 * `convertido` é quando ele passa a pagar antes do prazo acabar; `expirou`
 * quando o prazo venceu sozinho.
 */
export async function encerrarTeste(
  login: string,
  motivo: "expirou" | "convertido" | "removido",
  quando = new Date(),
): Promise<number> {
  if (!login) return 0;
  try {
    const aberto = await repo().findOne({
      where: { login, fim: IsNull() },
      order: { id: "DESC" },
    });
    if (!aberto) return 0;

    // Quem usou algumas horas usou um dia: o teste não é cobrado, mas conta
    // como uso para o proporcional da contratação.
    const dias = Math.max(1, diasEntre(new Date(aberto.inicio), quando));

    aberto.fim = quando;
    aberto.dias = dias;
    aberto.motivoFim = motivo;
    await repo().save(aberto);

    console.log(
      `[StreamingTeste] ${login}: teste encerrado (${motivo}) com ${dias} dia(s) de uso.`,
    );
    return dias;
  } catch (erro: any) {
    if (!tabelaAusente(erro)) {
      console.error("Falha ao encerrar o teste:", erro);
    }
    return 0;
  }
}

/**
 * Dias de teste grátis que o cliente já usou.
 *
 * Um teste ainda em andamento entra com os dias corridos até agora — é o caso
 * de quem testa e contrata antes de o prazo acabar.
 */
export async function diasDeTesteUsados(login: string): Promise<number> {
  if (!login) return 0;
  try {
    const testes = await repo().find({ where: { login } });
    if (testes.length === 0) return 0;

    const agora = new Date();
    return testes.reduce((total, t) => {
      if (t.fim) return total + (Number(t.dias) || 0);
      return total + Math.max(1, diasEntre(new Date(t.inicio), agora));
    }, 0);
  } catch (erro: any) {
    if (!tabelaAusente(erro)) {
      console.error("Falha ao somar os dias de teste:", erro);
    }
    return 0;
  }
}

/** Se o cliente já usou o teste grátis alguma vez. */
export async function jaUsouTesteGratis(login: string): Promise<boolean> {
  return (await diasDeTesteUsados(login)) > 0;
}
