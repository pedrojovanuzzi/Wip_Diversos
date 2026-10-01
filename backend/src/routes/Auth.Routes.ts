import { Router } from "express";
import Auth from "../controller/Auth";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

// Cadastro e listagem de usuários: só administradores.
const somenteAdmin = (req: any, res: any, next: any) => {
  if ((req.user?.permission ?? 0) < 5) {
    res.status(403).json({ errors: [{ msg: "Permissão insuficiente." }] });
    return;
  }
  next();
};

//Routes
router.get("/", Auth.show);
router.post("/create", AuthGuard, somenteAdmin, Auth.createUser);
router.get("/users", AuthGuard, somenteAdmin, Auth.listUsers);
router.put("/users/:id", AuthGuard, somenteAdmin, Auth.updateUser);
router.delete("/users/:id", AuthGuard, somenteAdmin, Auth.deleteUser);
router.post("/login", Auth.Login);
router.get("/getUser", Auth.getCurrentUser);
router.post("/api", Auth.getToken);
router.post("/validate", Auth.validateToken);

export default router;
