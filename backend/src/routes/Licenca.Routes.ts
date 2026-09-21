import { Router } from "express";
import LicencaController from "../controller/LicencaController";
import LicencaMensalidadeController from "../controller/LicencaMensalidadeController";
import AuthGuard from "../middleware/AuthGuard";

const Licenca = Router();

Licenca.post("/criar", AuthGuard, LicencaController.criarLicenca);
Licenca.get("/listar", AuthGuard, LicencaController.listarLicencas);
Licenca.put("/status/:id", AuthGuard, LicencaController.atualizarStatus);
Licenca.put("/:id", AuthGuard, LicencaController.atualizarLicenca);
Licenca.get("/verificar", LicencaController.verificarLicenca); // GET para consulta simples
Licenca.post("/verificar", LicencaController.verificarLicenca); // POST para enviar dados mais complexos se precisar
Licenca.post("/recuperar-chave", LicencaController.recuperarChaveLicenca);

// Mensalidades das licenças (não passam pelo MKAuth)
Licenca.get(
  "/mensalidades/config",
  AuthGuard,
  LicencaMensalidadeController.listarConfiguracoes,
);
Licenca.post(
  "/mensalidades/config",
  AuthGuard,
  LicencaMensalidadeController.salvarConfiguracao,
);
Licenca.delete(
  "/mensalidades/config/:id",
  AuthGuard,
  LicencaMensalidadeController.removerConfiguracao,
);
Licenca.get(
  "/mensalidades",
  AuthGuard,
  LicencaMensalidadeController.listarMensalidades,
);
Licenca.post(
  "/mensalidades/gerar",
  AuthGuard,
  LicencaMensalidadeController.gerarMensalidades,
);
Licenca.post(
  "/mensalidades/:id/pix",
  AuthGuard,
  LicencaMensalidadeController.gerarPix,
);
Licenca.post(
  "/mensalidades/:id/nfse",
  AuthGuard,
  LicencaMensalidadeController.emitirNfse,
);
Licenca.get(
  "/mensalidades/ultimo-rps",
  AuthGuard,
  LicencaMensalidadeController.ultimoRps,
);
Licenca.post(
  "/mensalidades/:id/cancelar-nfse",
  AuthGuard,
  LicencaMensalidadeController.cancelarNfse,
);
Licenca.post(
  "/mensalidades/:id/desvincular-nfse",
  AuthGuard,
  LicencaMensalidadeController.desvincularNfse,
);
Licenca.post(
  "/mensalidades/:id/vincular-nfse",
  AuthGuard,
  LicencaMensalidadeController.vincularNfse,
);
Licenca.post(
  "/mensalidades/:id/baixar",
  AuthGuard,
  LicencaMensalidadeController.baixar,
);
Licenca.post(
  "/mensalidades/:id/reabrir",
  AuthGuard,
  LicencaMensalidadeController.reabrir,
);
Licenca.post(
  "/mensalidades/:id/cancelar",
  AuthGuard,
  LicencaMensalidadeController.cancelar,
);
Licenca.delete(
  "/mensalidades/:id",
  AuthGuard,
  LicencaMensalidadeController.remover,
);

// Deixa por último: senão "/mensalidades" cairia aqui como se fosse um id.
Licenca.delete("/:id", AuthGuard, LicencaController.removerLicenca);

export default Licenca;
