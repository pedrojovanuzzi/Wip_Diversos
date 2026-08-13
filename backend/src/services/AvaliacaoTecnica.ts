import { v4 as uuidv4 } from "uuid";
import AppDataSource from "../database/DataSource";
import { Feedback } from "../entities/NotaColaboradores";
import { ChamadoFichaTecnica } from "../entities/ChamadoFichaTecnica";
import Whatsapp from "../controller/Whatsapp";

/**
 * Template aprovado na Meta. O corpo recebe, nesta ordem:
 * {{1}} nome do técnico, {{2}} link da pesquisa.
 */
const TEMPLATE = "avaliacao_tecnica";

const FRONT_URL = (process.env.URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);

/** Celular no formato aceito pela API do WhatsApp (55 + DDD + número). */
function normalizarCelular(bruto?: string | null): string | null {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

/**
 * A ficha guarda o técnico em caixa alta ("ARNALDO"); a pesquisa usa o nome
 * como ele aparece na tela de avaliações ("Arnaldo").
 */
function formatarNome(nome: string): string {
  return nome
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Técnicos que estiveram no chamado, sem repetir e sem "NENHUM". */
function tecnicosDaFicha(ficha: ChamadoFichaTecnica): string[] {
  const nomes = [ficha.tec_externo, ficha.tec_interno]
    .map((t) => String(t ?? "").trim())
    .filter((t) => t && t.toUpperCase() !== "NENHUM")
    .map(formatarNome);
  return [...new Set(nomes)];
}

/**
 * Ao concluir a ficha técnica, manda ao cliente a mesma pesquisa da tela de
 * avaliações — um link por técnico que atendeu.
 *
 * Nunca lança: uma falha no WhatsApp não pode derrubar o fechamento da ficha.
 */
export async function enviarAvaliacaoDaFicha(
  ficha: ChamadoFichaTecnica,
): Promise<{ enviados: number; erro?: string }> {
  try {
    // Ressincronizar a ficha não pode disparar a pesquisa de novo.
    if (ficha.avaliacao_enviada_em) return { enviados: 0 };

    const tecnicos = tecnicosDaFicha(ficha);
    if (tecnicos.length === 0) return { enviados: 0 };

    // O número vem do formulário da ficha: quem assina o atendimento nem
    // sempre é o titular do cadastro.
    const celular = normalizarCelular(ficha.celular_avaliacao);
    if (!celular) {
      const erro = `Ficha ${ficha.id} sem celular válido para a avaliação.`;
      console.error(`[AvaliacaoTecnica] ${erro}`);
      return { enviados: 0, erro };
    }

    const feedbackRepo = AppDataSource.getRepository(Feedback);
    let enviados = 0;

    for (const tecnico of tecnicos) {
      const identificador = uuidv4();
      await feedbackRepo.save(
        feedbackRepo.create({
          unique_identifier: identificador,
          login: tecnico,
        }),
      );

      const link = `${FRONT_URL}/feedback/${encodeURIComponent(tecnico)}/${identificador}`;
      try {
        await Whatsapp.MensagemTemplate(celular, TEMPLATE, "pt_BR", [
          tecnico,
          link,
        ]);
        enviados += 1;
        console.log(
          `[AvaliacaoTecnica] Pesquisa do técnico ${tecnico} enviada para ${celular} (chamado ${ficha.chamado_number}): ${link}`,
        );
      } catch (e: any) {
        // O link já existe no banco: o atendimento consegue reenviar pela tela
        // de avaliações se o WhatsApp falhar.
        console.error(
          `[AvaliacaoTecnica] Falha ao enviar pesquisa do técnico ${tecnico}:`,
          e?.response?.data || e?.message || e,
        );
      }
    }

    if (enviados > 0) {
      ficha.avaliacao_enviada_em = new Date();
      await AppDataSource.getRepository(ChamadoFichaTecnica).save(ficha);
    }

    return { enviados };
  } catch (error: any) {
    console.error("[AvaliacaoTecnica] Erro inesperado:", error);
    return { enviados: 0, erro: error?.message };
  }
}
