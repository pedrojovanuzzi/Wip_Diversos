import { Router } from 'express';

import Nfe from "../controller/Nfe";
import AuthGuard from '../middleware/AuthGuard';

const router: Router = Router()

router.get('/', AuthGuard, Nfe.create);

export default router;