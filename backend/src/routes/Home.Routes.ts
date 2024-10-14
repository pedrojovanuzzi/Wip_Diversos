import { Router } from "express";
import Home from "../controller/Home";

const router: Router = Router()

//Routes
router.get("/", Home.home);

export default router;