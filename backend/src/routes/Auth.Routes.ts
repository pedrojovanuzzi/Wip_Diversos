import { Router } from "express";
import Auth from "../controller/Auth";
import AuthGuard from "../middleware/AuthGuard";
import rateLimit from "express-rate-limit";

const router: Router = Router();

// Cadastro e listagem de usuários: só administradores.
const somenteAdmin = (req: any, res: any, next: any) => {
  if ((req.user?.permission ?? 0) < 5) {
    res.status(403).json({ errors: [{ msg: "Permissão insuficiente." }] });
    return;
  }
  next();
};

// Contra força bruta: 10 tentativas erradas por IP a cada 15 min. Login certo
// não conta, para não travar o escritório inteiro saindo pelo mesmo IP.
// Depende do "trust proxy" no app.ts, senão todo mundo vira o IP do nginx.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    errors: [{ msg: "Muitas tentativas. Tente novamente em alguns minutos." }],
  },
});

//Routes
router.get("/", Auth.show);
router.post("/create", AuthGuard, somenteAdmin, Auth.createUser);
router.get("/users", AuthGuard, somenteAdmin, Auth.listUsers);
router.put("/users/:id", AuthGuard, somenteAdmin, Auth.updateUser);
router.delete("/users/:id", AuthGuard, somenteAdmin, Auth.deleteUser);
router.post("/login", loginLimiter, Auth.Login);
router.get("/getUser", Auth.getCurrentUser);
router.post("/api", Auth.getToken);
router.post("/validate", Auth.validateToken);

export default router;
