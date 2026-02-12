import { Router } from "express";
import LicencaController from "../controller/LicencaController";

const Licenca = Router();

Licenca.post("/criar", LicencaController.criarLicenca);
Licenca.get("/listar", LicencaController.listarLicencas);
Licenca.put("/status/:id", LicencaController.atualizarStatus);
Licenca.get("/verificar", LicencaController.verificarLicenca); // GET para consulta simples
Licenca.post("/verificar", LicencaController.verificarLicenca); // POST para enviar dados mais complexos se precisar
Licenca.post("/recuperar-chave", LicencaController.recuperarChaveLicenca);
Licenca.delete("/:id", LicencaController.removerLicenca);

export default Licenca;
