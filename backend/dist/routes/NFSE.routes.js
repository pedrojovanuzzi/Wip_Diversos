"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NFSE_1 = __importDefault(require("../controller/NFSE"));
const AuthGuard_1 = __importDefault(require("../middleware/AuthGuard"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, '../files'));
    },
    filename: (req, file, cb) => {
        cb(null, 'certificado.pfx');
    }
});
const fileFilter = (req, file, cb) => {
    // Verifica se a extensão do arquivo é .pfx
    if (path_1.default.extname(file.originalname).toLowerCase() === '.pfx') {
        cb(null, true);
    }
    else {
        cb(new Error('Apenas arquivos com extensão .pfx são permitidos.'));
    }
};
const upload = (0, multer_1.default)({ storage, fileFilter });
const router = (0, express_1.Router)();
router.post('/', NFSE_1.default.iniciar.bind(NFSE_1.default));
// router.post('/cancelar', NFSE.cancelarRPS.bind(NFSE));
// router.get('/consultar', NFSE.consultarRPS.bind(NFSE));
router.post("/BuscarClientes", AuthGuard_1.default, NFSE_1.default.BuscarClientes);
router.post("/cancelarNfse", AuthGuard_1.default, NFSE_1.default.cancelarNfse.bind(NFSE_1.default));
router.post("/BuscarNSFE", AuthGuard_1.default, NFSE_1.default.BuscarNSFE);
router.post("/imprimirNFSE", AuthGuard_1.default, NFSE_1.default.imprimirNFSE);
router.post("/upload", upload.any(), AuthGuard_1.default, NFSE_1.default.uploadCertificado);
exports.default = router;
