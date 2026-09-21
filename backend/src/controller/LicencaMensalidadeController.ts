import { Request, Response } from "express";
import licencaMensalidadeService, {
  competenciaDe,
} from "../services/LicencaMensalidadeService";

/** Mensalidades das licenças de software (separadas do MKAuth). */
class LicencaMensalidadeController {
  listarConfiguracoes = async (_req: Request, res: Response) => {
    try {
      res
        .status(200)
        .json(await licencaMensalidadeService.listarConfiguracoes());
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Erro ao listar." });
    }
  };

  salvarConfiguracao = async (req: Request, res: Response) => {
    try {
      const config = await licencaMensalidadeService.salvarConfiguracao(
        req.body,
      );
      res.status(200).json(config);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao salvar." });
    }
  };

  removerConfiguracao = async (req: Request, res: Response) => {
    try {
      await licencaMensalidadeService.removerConfiguracao(
        Number(req.params.id),
      );
      res.status(200).json({ message: "Configuração removida." });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Erro ao remover." });
    }
  };

  listarMensalidades = async (req: Request, res: Response) => {
    try {
      const { competencia, status, software, licencaId } = req.query;
      const mensalidades = await licencaMensalidadeService.listarMensalidades({
        competencia: competencia ? String(competencia) : undefined,
        status: status ? String(status) : undefined,
        software: software ? String(software) : undefined,
        licencaId: licencaId ? Number(licencaId) : undefined,
      });
      res.status(200).json(mensalidades);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Erro ao listar." });
    }
  };

  gerarMensalidades = async (req: Request, res: Response) => {
    try {
      const competencia = req.body?.competencia
        ? String(req.body.competencia)
        : competenciaDe();
      const resumo =
        await licencaMensalidadeService.gerarMensalidades(competencia);
      res.status(200).json(resumo);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Erro ao gerar." });
    }
  };

  gerarPix = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.gerarPix(
        Number(req.params.id),
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      console.error("Erro ao gerar Pix de licença:", error);
      res
        .status(500)
        .json({ message: error?.message || "Erro ao gerar o Pix." });
    }
  };

  emitirNfse = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.emitirNfse(
        Number(req.params.id),
        req.body,
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      console.error("Erro ao emitir NFS-e de licença:", error?.message);
      res
        .status(400)
        .json({ message: error?.message || "Erro ao emitir a nota." });
    }
  };

  vincularNfse = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.vincularNfse(
        Number(req.params.id),
        req.body,
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      res
        .status(400)
        .json({ message: error?.message || "Erro ao vincular a nota." });
    }
  };

  ultimoRps = async (req: Request, res: Response) => {
    try {
      const ambiente = String(req.query.ambiente || "homologacao");
      res
        .status(200)
        .json(await licencaMensalidadeService.ultimoRpsConhecido(ambiente));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Erro ao consultar." });
    }
  };

  cancelarNfse = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.cancelarNfse(
        Number(req.params.id),
        req.body,
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      console.error("Erro ao cancelar NFS-e de licença:", error?.message);
      res
        .status(400)
        .json({ message: error?.message || "Erro ao cancelar a nota." });
    }
  };

  desvincularNfse = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.desvincularNfse(
        Number(req.params.id),
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      res
        .status(400)
        .json({ message: error?.message || "Erro ao remover a nota." });
    }
  };

  baixar = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.baixarManual(
        Number(req.params.id),
        req.body?.valorPago,
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao baixar." });
    }
  };

  reabrir = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.reabrir(
        Number(req.params.id),
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao reabrir." });
    }
  };

  cancelar = async (req: Request, res: Response) => {
    try {
      const mensalidade = await licencaMensalidadeService.cancelar(
        Number(req.params.id),
      );
      res.status(200).json(mensalidade);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || "Erro ao cancelar." });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      await licencaMensalidadeService.remover(Number(req.params.id));
      res.status(200).json({ message: "Mensalidade removida." });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Erro ao remover." });
    }
  };
}

export default new LicencaMensalidadeController();
