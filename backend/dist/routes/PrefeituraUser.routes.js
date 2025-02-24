"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PrefeituraLogin_1 = __importDefault(require("../controller/PrefeituraLogin"));
const router = (0, express_1.Router)();
//Routes
router.post("/Login", PrefeituraLogin_1.default.login);
router.post("/redirect", PrefeituraLogin_1.default.redirect);
router.get("/redirect", PrefeituraLogin_1.default.redirect);
router.post("/redirect_2", PrefeituraLogin_1.default.redirect_2);
router.get("/redirect_2", PrefeituraLogin_1.default.redirect_2);
router.get("/SendOtp", PrefeituraLogin_1.default.SendOtp);
exports.default = router;
