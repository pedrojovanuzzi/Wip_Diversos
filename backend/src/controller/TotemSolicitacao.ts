import { Request, Response } from "express";
import LocalDataSource from "../database/DataSource";
import { TotemPixSolicitacao } from "../entities/TotemPixSolicitacao";

const onlyDigits = (v: unknown) =>
  v == null ? null : String(v).replace(/\D/g, "");

class TotemSolicitacao {
  private repo = LocalDataSource.getRepository(TotemPixSolicitacao);

  registrar = async (req: Request, res: Response): Promise<void> => {
    try {
      const { txid, valor, cpf_cnpj, login, pix_url } = req.body ?? {};

      const registro = await this.repo.save({
        txid: txid ? String(txid) : null,
        valor: valor != null ? String(valor) : null,
        cpf_cnpj: onlyDigits(cpf_cnpj),
        login: login ? String(login) : null,
        pix_url: pix_url ? String(pix_url) : null,
      });

      res.status(201).json(registro);
    } catch (error: any) {
      console.error("[TotemSolicitacao] Erro ao registrar:", error);
      res.status(500).json({ erro: error?.message || "Erro ao registrar" });
    }
  };
}

export default TotemSolicitacao;
