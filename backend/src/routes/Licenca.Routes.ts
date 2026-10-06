import { Router } from "express";
import LicencaController from "../controller/LicencaController";
import LicencaMensalidadeController from "../controller/LicencaMensalidadeController";
import { protegido } from "../middleware/PermissionGuard";

const Licenca = Router();

// Níveis iguais aos das telas no frontend (App.tsx): operador = 2, admin = 5.
const admin = protegido(5);

Licenca.post("/criar", admin, LicencaController.criarLicenca);
Licenca.get("/listar", admin, LicencaController.listarLicencas);
Licenca.put("/status/:id", admin, LicencaController.atualizarStatus);
Licenca.put("/:id", admin, LicencaController.atualizarLicenca);
Licenca.get("/verificar", LicencaController.verificarLicenca); // GET para consulta simples
Licenca.post("/verificar", LicencaController.verificarLicenca); // POST para enviar dados mais complexos se precisar
Licenca.post("/recuperar-chave", LicencaController.recuperarChaveLicenca);

// Mensalidades das licenças (não passam pelo MKAuth)
Licenca.get(
  "/mensalidades/config",
  admin,
  LicencaMensalidadeController.listarConfiguracoes,
);
Licenca.post(
  "/mensalidades/config",
  admin,
  LicencaMensalidadeController.salvarConfiguracao,
);
Licenca.delete(
  "/mensalidades/config/:id",
  admin,
  LicencaMensalidadeController.removerConfiguracao,
);
Licenca.get(
  "/mensalidades",
  admin,
  LicencaMensalidadeController.listarMensalidades,
);
Licenca.post(
  "/mensalidades/gerar",
  admin,
  LicencaMensalidadeController.gerarMensalidades,
);
Licenca.post(
  "/mensalidades/:id/pix",
  admin,
  LicencaMensalidadeController.gerarPix,
);
Licenca.post(
  "/mensalidades/:id/nfse",
  admin,
  LicencaMensalidadeController.emitirNfse,
);
Licenca.get(
  "/mensalidades/ultimo-rps",
  admin,
  LicencaMensalidadeController.ultimoRps,
);
Licenca.post(
  "/mensalidades/:id/cancelar-nfse",
  admin,
  LicencaMensalidadeController.cancelarNfse,
);
Licenca.post(
  "/mensalidades/:id/desvincular-nfse",
  admin,
  LicencaMensalidadeController.desvincularNfse,
);
Licenca.post(
  "/mensalidades/:id/vincular-nfse",
  admin,
  LicencaMensalidadeController.vincularNfse,
);
Licenca.post(
  "/mensalidades/:id/baixar",
  admin,
  LicencaMensalidadeController.baixar,
);
Licenca.post(
  "/mensalidades/:id/reabrir",
  admin,
  LicencaMensalidadeController.reabrir,
);
Licenca.post(
  "/mensalidades/:id/cancelar",
  admin,
  LicencaMensalidadeController.cancelar,
);
Licenca.delete(
  "/mensalidades/:id",
  admin,
  LicencaMensalidadeController.remover,
);

// Deixa por último: senão "/mensalidades" cairia aqui como se fosse um id.
Licenca.delete("/:id", admin, LicencaController.removerLicenca);

export default Licenca;
