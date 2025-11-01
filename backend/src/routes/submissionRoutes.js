import express from "express";
import rateLimit from "express-rate-limit";


import {
    submitCode,
    runCode,
    executeCustomInput
} from "../controllers/submissionController.js";
import { protectRoute } from "../middleware/protectRoute.js"; // Assuming you have this

const router = express.Router();

const executionLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
    message: {
        error: "Too many code execution requests. Please try again later.",
        retryAfter: "15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// All routes require authentication
router.post("/submit", protectRoute, executionLimiter, submitCode); // Submit code for evaluation
router.post("/run", protectRoute, executionLimiter, runCode); // Run code against visible test cases
router.post("/execute", protectRoute, executionLimiter, executeCustomInput); // Execute code with custom input

export default router;