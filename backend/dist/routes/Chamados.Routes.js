"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Chamados_1 = __importDefault(require("../controller/Chamados"));
const AuthGuard_1 = __importDefault(require("../middleware/AuthGuard"));
const router = (0, express_1.Router)();
//Routes
router.get("/", AuthGuard_1.default, Chamados_1.default.showMonth);
router.get("/year", AuthGuard_1.default, Chamados_1.default.showYear);
router.get("/all", AuthGuard_1.default, Chamados_1.default.showAll);
router.get("/returns/month", AuthGuard_1.default, Chamados_1.default.returnMonth);
router.get("/returns/year", AuthGuard_1.default, Chamados_1.default.returnYear);
exports.default = router;
