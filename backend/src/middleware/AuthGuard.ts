import { Request, Response, NextFunction } from "express";
import { User } from "../entities/User";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";
import DataSource from "../database/DataSource";

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
    }
  }
}

const jwtSecret = String(process.env.JWT_SECRET);

async function AuthGuard(req: Request, res: Response, next: NextFunction) {
  const AuthHeader = req.headers["authorization"];
  const token =
    (AuthHeader && AuthHeader.split(" ")[1]) || (req.query.token as string);

  if (!token) {
    res.status(401).json({ errors: ["Acesso Negado!"] });
    return;
  }

  try {
    const verified = jwt.verify(token, jwtSecret) as JwtPayload;

    const userRepository = DataSource.getRepository(User);

    req.user = await userRepository.findOne({
      where: { id: verified.id },
      select: ["id", "login", "password"],
    });

    if (!req.user) {
      res.status(401).json({ errors: ["Usuário não encontrado"] });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ errors: ["Token Inválido"] });
  }
}

export default AuthGuard;
