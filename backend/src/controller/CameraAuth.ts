import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import DataSource from "../database/DataSource";
import { CameraCliente } from "../entities/CameraCliente";

dotenv.config();

const jwtSecret = String(process.env.JWT_SECRET);

/** Token de sessão do cliente-câmera (8h). */
export function generateClientToken(cid: number) {
  return jwt.sign({ cid, tipo: "camera_cliente" }, jwtSecret, {
    expiresIn: "8h",
  });
}

/** Token curto (60s) usado para autorizar o acesso ao stream/gravação no MediaMTX. */
export function generateStreamToken(cid: number, pathName: string) {
  return jwt.sign({ cid, path: pathName, tipo: "camera_stream" }, jwtSecret, {
    expiresIn: "60s",
  });
}

class CameraAuth {
  /** Login do cliente: PPPOE + senha definida no setup. */
  public async login(req: Request, res: Response) {
    try {
      await body("login").trim().notEmpty().withMessage("Login é obrigatório").run(req);
      await body("password")
        .isLength({ min: 6 })
        .withMessage("Senha tem que ter no mínimo 6 caracteres")
        .run(req);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { login, password } = req.body;
      const repo = DataSource.getRepository(CameraCliente);
      const cliente = await repo.findOne({ where: { login } });

      if (!cliente || !cliente.password) {
        res.status(422).json({ errors: [{ msg: "Usuário ou senha inválidos" }] });
        return;
      }

      if (cliente.status !== "ativo") {
        res.status(422).json({ errors: [{ msg: "Conta pendente ou bloqueada" }] });
        return;
      }

      if (!(await bcrypt.compare(password, cliente.password))) {
        res.status(422).json({ errors: [{ msg: "Usuário ou senha inválidos" }] });
        return;
      }

      res.status(200).json({
        id: cliente.id,
        login: cliente.login,
        email: cliente.email,
        token: generateClientToken(Number(cliente.id)),
      });
    } catch (error) {
      console.error(error);
      res.status(401).json({ errors: [{ msg: "Ocorreu um erro" }] });
    }
  }

  /** Dados do cliente logado. */
  public async me(req: Request, res: Response) {
    const cliente = req.cameraCliente!;
    res.status(200).json({
      id: cliente.id,
      login: cliente.login,
      email: cliente.email,
      status: cliente.status,
    });
  }
}

export default new CameraAuth();
