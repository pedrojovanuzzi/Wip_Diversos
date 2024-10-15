import { Router } from "express";
import Auth from "../controller/Auth";

const router: Router = Router()

//Routes
router.get("/", Auth.show);
router.post("/create", Auth.createUser);

export default router;