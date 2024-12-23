"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Home_1 = __importDefault(require("../controller/Home"));
const AuthGuard_1 = __importDefault(require("../middleware/AuthGuard"));
const router = (0, express_1.Router)();
router.get("/", AuthGuard_1.default, Home_1.default.show);
exports.default = router;
