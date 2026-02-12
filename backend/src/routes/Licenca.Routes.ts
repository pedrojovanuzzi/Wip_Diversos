import { Router } from "express";
import LicencaController from "../controller/LicencaController";
import AuthGuard from "../middleware/AuthGuard";

const Licenca = Router();

Licenca.post("/criar", AuthGuard, LicencaController.criarLicenca);
Licenca.get("/listar", AuthGuard, LicencaController.listarLicencas);
Licenca.put("/status/:id", AuthGuard, LicencaController.atualizarStatus);
Licenca.get("/verificar", LicencaController.verificarLicenca); // GET para consulta simples
Licenca.post("/verificar", LicencaController.verificarLicenca); // POST para enviar dados mais complexos se precisar
Licenca.post("/recuperar-chave", LicencaController.recuperarChaveLicenca);
Licenca.delete("/:id", AuthGuard, LicencaController.removerLicenca);

export default Licenca;
