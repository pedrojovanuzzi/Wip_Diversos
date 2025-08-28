import {Router} from 'express';
import DosProtect from '../controller/DosProtect';
import AuthGuard from '../middleware/AuthGuard';

// const dosProtect = new DosProtect();
// router.get("/eventsPerMinute", AuthGuard, dosProtect.eventsPerMinute); Se não fosse estatico funcionaria assim

const router: Router = Router();

router.get("/last10Pppoe", AuthGuard, DosProtect.last10Pppoe);
router.get("/eventsPerHost", AuthGuard, DosProtect.eventsPerHost);
router.get("/eventsPerMinute", AuthGuard, DosProtect.eventsPerMinute);

export default router;