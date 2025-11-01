import express from "express";

import {
    createProblem,
    getProblems,
    getProblemByIdOrSlug,
    updateProblem,
    deleteProblem,
    getCategories,
    getTags,
    getProblemTestCases
} from "../controllers/problemController.js";
import { protectRoute } from "../middleware/protectRoute.js";

const router = express.Router();

// Public routes (with authentication required)
router.get("/", getProblems); 
router.get("/categories", getCategories);
router.get("/tags", getTags);
router.get("/:identifier", getProblemByIdOrSlug);

// Protected routes (requires authentication)
router.post("/", protectRoute, createProblem); // Create new problem
router.put("/:id", protectRoute, updateProblem); // Update problem
router.delete("/:id", protectRoute, deleteProblem); // Delete problem (soft delete)
router.get("/:id/test-cases", protectRoute, getProblemTestCases); // Get all test cases (creator only)

export default router;