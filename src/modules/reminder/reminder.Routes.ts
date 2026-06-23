import { Router } from "express";
import auth from "../../core/middleware/authMiddleware";
import {
    markComplete,
    rescheduleReminderController,
    disableReminderController,
    registerToken,
    removeToken,
} from "./reminder.controller";

const router = Router();

router.post("/complete",   auth, markComplete);
router.post("/reschedule", auth, rescheduleReminderController);
router.post("/disable",    auth, disableReminderController);
router.post("/token",      auth, registerToken);
router.delete("/token",    auth, removeToken);

export default router;