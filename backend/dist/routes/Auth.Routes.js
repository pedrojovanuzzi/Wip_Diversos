"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Auth_1 = __importDefault(require("../controller/Auth"));
const router = (0, express_1.Router)();
//Routes
router.get("/", Auth_1.default.show);
router.post("/create", Auth_1.default.createUser);
router.post("/login", Auth_1.default.Login);
router.get("/getUser", Auth_1.default.getCurrentUser);
router.post("/api", Auth_1.default.getToken);
exports.default = router;
