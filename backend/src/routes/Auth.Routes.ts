import { Router } from "express";
import Auth from "../controller/Auth";

const router: Router = Router();

//Routes
router.get("/", Auth.show);
router.post("/create", Auth.createUser);
router.post("/login", Auth.Login);
router.get("/getUser", Auth.getCurrentUser);
router.post("/api", Auth.getToken);
router.post("/validate", Auth.validateToken);

export default router;
