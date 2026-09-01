import { Request, Response } from "express";

import CodefService, {
  BaseCompetencia,
  BaseTributos,
} from "../services/CodefService";
import { gerarPlanilhaCodef } from "../services/CodefPlanilha";
import {
  CATEGORIAS_CODEF,
  CategoriaCodef,
} from "../entities/CodefPlanoConta";

/**
 * Coleta Mensal CODEF (Anatel).
 *
 * Monta os cinco valores que a Anatel pede todo mês a partir do faturamento e
 * das contas a pagar do MKAuth. O MKAuth é só lido.
 */
class Codef {
  /** Grade dos doze meses, mais os planos de contas do período. */
  public apurar = async (req: Request, res: Response) => {
    try {
      const ano = this.lerAno(req.query.ano);
      const apuracao = await CodefService.apurar(
        ano,
        this.lerBase(req.query.base),
        this.lerTributos(req.query.tributos),
      );
      res.json(apuracao);
    } catch (error: any) {
      console.error("[Codef] Erro ao apurar:", error?.message || error);
      res
        .status(500)
        .json({ message: error?.message || "Erro ao apurar o CODEF." });
    }
  };

  /** Classificações já gravadas, para a tela saber o que foi decidido à mão. */
  public listarRegras = async (_req: Request, res: Response) => {
    try {
      res.json({ regras: await CodefService.listarRegras() });
    } catch (error: any) {
      console.error("[Codef] Erro ao listar regras:", error?.message || error);
      res.status(500).json({ message: "Erro ao carregar as classificações." });
    }
  };

  /** Classifica um plano de contas em uma coluna do CODEF. */
  public classificar = async (req: Request, res: Response) => {
    try {
      const plano = String(req.body?.plano ?? "").trim();
      const categoria = String(req.body?.categoria ?? "") as CategoriaCodef;

      if (!plano) {
        res.status(400).json({ message: "Informe o plano de contas." });
        return;
      }
      if (!CATEGORIAS_CODEF.includes(categoria)) {
        res.status(400).json({ message: "Categoria inválida." });
        return;
      }

      const regra = await CodefService.classificarPlano(
        plano,
        categoria,
        req.user?.login || "",
        req.body?.historicoContem ?? null,
      );

      res.json({ ok: true, regra });
    } catch (error: any) {
      console.error("[Codef] Erro ao classificar:", error?.message || error);
      res.status(500).json({ message: "Erro ao salvar a classificação." });
    }
  };

  /** Apaga uma classificação; o plano volta para o palpite padrão. */
  public removerClassificacao = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: "Classificação inválida." });
        return;
      }

      const removida = await CodefService.removerClassificacao(id);
      if (!removida) {
        res.status(404).json({ message: "Classificação não encontrada." });
        return;
      }

      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Codef] Erro ao remover regra:", error?.message || error);
      res.status(500).json({ message: "Erro ao remover a classificação." });
    }
  };

  /** Dívida, caixa e desconto de um mês — o que o MKAuth não tem. */
  public salvarCompetencia = async (req: Request, res: Response) => {
    try {
      const ano = this.lerAno(req.body?.ano);
      const mes = Number(req.body?.mes);

      if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
        res.status(400).json({ message: "Mês inválido." });
        return;
      }

      const competencia = await CodefService.salvarCompetencia(
        ano,
        mes,
        {
          emprestimos: this.lerValor(req.body?.emprestimos),
          caixa: this.lerValor(req.body?.caixa),
          descontos: this.lerValor(req.body?.descontos),
          observacao:
            req.body?.observacao === undefined
              ? undefined
              : String(req.body.observacao ?? "").trim() || null,
        },
        req.user?.login || "",
      );

      res.json({ ok: true, competencia });
    } catch (error: any) {
      console.error("[Codef] Erro ao salvar o mês:", error?.message || error);
      res.status(500).json({ message: "Erro ao salvar os valores do mês." });
    }
  };

  /**
   * Baixa a planilha do ano.
   *
   * O AuthGuard aceita o token na query, que é como o navegador consegue
   * abrir o download direto sem passar por fetch.
   */
  public exportar = async (req: Request, res: Response) => {
    try {
      const ano = this.lerAno(req.query.ano);
      const apuracao = await CodefService.apurar(
        ano,
        this.lerBase(req.query.base),
        this.lerTributos(req.query.tributos),
      );

      const arquivo = gerarPlanilhaCodef(apuracao);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="CODEF_${ano}.xlsx"`,
      );
      res.send(arquivo);
    } catch (error: any) {
      console.error("[Codef] Erro ao exportar:", error?.message || error);
      res
        .status(500)
        .json({ message: error?.message || "Erro ao gerar a planilha." });
    }
  };

  /** Ano da apuração; sem parâmetro, o ano corrente. */
  private lerAno(entrada: unknown): number {
    const ano = Number(entrada);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100)
      return new Date().getFullYear();
    return ano;
  }

  private lerBase(entrada: unknown): BaseCompetencia {
    return String(entrada) === "pagamento" ? "pagamento" : "vencimento";
  }

  private lerTributos(entrada: unknown): BaseTributos {
    return String(entrada) === "das" ? "das" : "todos";
  }

  /**
   * Aceita número, "1.234,56" e "1234.56"; undefined para campo ausente.
   *
   * O ponto só é tratado como separador de milhar quando existe uma vírgula na
   * string. Sem essa condição, um "1234.56" legítimo viraria 123456 — que num
   * campo de saldo bancário passaria despercebido.
   */
  private lerValor(entrada: unknown): number | undefined {
    if (entrada === undefined || entrada === null || entrada === "")
      return undefined;

    if (typeof entrada === "number")
      return Number.isFinite(entrada) ? entrada : undefined;

    const bruto = String(entrada).trim();
    const normalizado = bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto;

    const valor = Number(normalizado);
    return Number.isFinite(valor) ? valor : undefined;
  }
}

export default new Codef();
