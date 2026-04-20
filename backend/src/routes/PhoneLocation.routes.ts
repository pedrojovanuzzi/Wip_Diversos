import { Router } from "express";
import PhoneLocationController from "../controller/PhoneLocation";
import AuthGuard from "../middleware/AuthGuard";

const router: Router = Router();

// Endpoint público (autenticado por device_token no corpo) usado pelo celular
router.post("/position", (req, res) =>
  PhoneLocationController.updatePosition(req, res),
);

// Endpoints administrativos (dashboard)
router.get("/", AuthGuard, (req, res) => PhoneLocationController.list(req, res));
router.post("/", AuthGuard, (req, res) =>
  PhoneLocationController.register(req, res),
);
router.put("/:id", AuthGuard, (req, res) =>
  PhoneLocationController.update(req, res),
);
router.delete("/:id", AuthGuard, (req, res) =>
  PhoneLocationController.delete(req, res),
);

export default router;
