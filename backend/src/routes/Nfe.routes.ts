import { Router } from 'express';

import Nfe from "../controller/Nfe";

const router: Router = Router()

router.get('/', Nfe.create);

export default router;