import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";
import DataSource from "../database/DataSource";
import { CameraCliente } from "../entities/CameraCliente";

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      cameraCliente?: CameraCliente | null;
    }
  }
}

const jwtSecret = String(process.env.JWT_SECRET);

/**
 * Protege as rotas do portal do cliente-câmera.
 * Aceita apenas tokens com claim `tipo === 'camera_cliente'` — não colide com o AuthGuard interno.
 */
async function CameraClientGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers["authorization"];
  const token =
    (authHeader && authHeader.split(" ")[1]) || (req.query.token as string);

  if (!token) {
    res.status(401).json({ errors: ["Acesso Negado!"] });
    return;
  }

  try {
    const verified = jwt.verify(token, jwtSecret) as JwtPayload;

    if (verified.tipo !== "camera_cliente" || !verified.cid) {
      res.status(401).json({ errors: ["Token Inválido"] });
      return;
    }

    const repo = DataSource.getRepository(CameraCliente);
    const cliente = await repo.findOne({ where: { id: verified.cid } });

    if (!cliente || cliente.status !== "ativo") {
      res.status(401).json({ errors: ["Conta inválida ou bloqueada"] });
      return;
    }

    req.cameraCliente = cliente;
    next();
  } catch (error) {
    res.status(401).json({ errors: ["Token Inválido"] });
  }
}

export default CameraClientGuard;
