import { Router } from "express";
import Home from "../controller/Home";
import AuthGuard from "../middleware/AuthGuard";


const router: Router = Router()

//Routes
router.get("/", AuthGuard, Home.show);

export default router;