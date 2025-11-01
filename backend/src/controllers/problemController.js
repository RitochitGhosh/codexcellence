import Problem from "../models/Problem.js";

// Create a new problem (Admin/Authorized users only)
export async function createProblem(req, res) {
    try {
        const {
            title,
            description,
            difficulty,
            category,
            tags,
            examples,
            testCases,
            starterCode,
            constraints,
            hints
        } = req.body;

        const userId = req.user._id;

        // Validate required fields
        if (!title || !description || !difficulty || !category || !examples || !testCases || !starterCode) {
            return res.status(400).json({
                message: "Required fields are missing: title, description, difficulty, category, examples, testCases, starterCode"
            });
        }

        // Validate examples array
        if (!Array.isArray(examples) || examples.length === 0) {
            return res.status(400).json({
                message: "At least one example is required"
            });
        }

        // Validate testCases array
        if (!Array.isArray(testCases) || testCases.length === 0) {
            return res.status(400).json({
                message: "At least one test case is required"
            });
        }

        // Validate starterCode array
        if (!Array.isArray(starterCode) || starterCode.length === 0) {
            return res.status(400).json({
                message: "Starter code for at least one language is required"
            });
        }

        // Validate difficulty
        const validDifficulties = ["easy", "medium", "hard"];
        if (!validDifficulties.includes(difficulty)) {
            return res.status(400).json({
                message: "Difficulty must be one of: easy, medium, hard"
            });
        }

        // Validate starter code languages
        const validLanguages = ["javascript", "java", "python"];
        for (const code of starterCode) {
            if (!validLanguages.includes(code.language)) {
                return res.status(400).json({
                    message: `Invalid language: ${code.language}. Supported languages: javascript, java, python`
                });
            }
            if (!code.code || code.code.trim() === "") {
                return res.status(400).json({
                    message: `Starter code cannot be empty for language: ${code.language}`
                });
            }
        }

        // Validate examples structure
        for (const example of examples) {
            if (!example.input || !example.output) {
                return res.status(400).json({
                    message: "Each example must have input and output fields"
                });
            }
        }

        // Validate test cases structure
        for (const testCase of testCases) {
            if (!testCase.input || !testCase.expectedOutput) {
                return res.status(400).json({
                    message: "Each test case must have input and expectedOutput fields"
                });
            }
        }

        // Check if problem with same title already exists
        const existingProblem = await Problem.findOne({ title });
        if (existingProblem) {
            return res.status(409).json({
                message: "A problem with this title already exists"
            });
        }

        // Create the problem
        const problem = await Problem.create({
            title,
            description,
            difficulty,
            category,
            tags: tags || [],
            examples,
            testCases,
            starterCode,
            constraints: constraints || "",
            hints: hints || [],
            createdBy: userId,
        });

        res.status(201).json({
            message: "Problem created successfully",
            problem
        });
    } catch (error) {
        console.error("Error in createProblem controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Get all problems with optional filters
export async function getProblems(req, res) {
    try {
        const { difficulty, category, tag, search, page = 1, limit = 20 } = req.query;

        // Build filter object
        const filter = { isActive: true };

        if (difficulty) {
            const validDifficulties = ["easy", "medium", "hard"];
            if (!validDifficulties.includes(difficulty)) {
                return res.status(400).json({
                    message: "Invalid difficulty filter"
                });
            }
            filter.difficulty = difficulty;
        }

        if (category) {
            filter.category = category;
        }

        if (tag) {
            filter.tags = tag;
        }

        if (search) {
            filter.$text = { $search: search };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get problems
        const problems = await Problem.find(filter)
            .select("-testCases") // Don't send test cases in list view
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count for pagination
        const total = await Problem.countDocuments(filter);

        res.status(200).json({
            problems,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalProblems: total,
                hasMore: skip + problems.length < total
            }
        });
    } catch (error) {
        console.error("Error in getProblems controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Get a single problem by ID or slug
export async function getProblemByIdOrSlug(req, res) {
    try {
        const { identifier } = req.params;

        if (!identifier) {
            return res.status(400).json({
                message: "Problem identifier is required"
            });
        }

        // Try to find by ID first, then by slug
        let problem;
        if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
            // It's a valid MongoDB ObjectId
            problem = await Problem.findById(identifier);
        } else {
            // It's a slug
            problem = await Problem.findOne({ slug: identifier });
        }

        if (!problem) {
            return res.status(404).json({
                message: "Problem not found"
            });
        }

        if (!problem.isActive) {
            return res.status(403).json({
                message: "This problem is not currently available"
            });
        }

        // Return problem without hidden test cases
        const problemData = problem.toObject();
        problemData.testCases = problemData.testCases.filter(tc => !tc.isHidden);

        res.status(200).json({
            problem: problemData
        });
    } catch (error) {
        console.error("Error in getProblemByIdOrSlug controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Update a problem
export async function updateProblem(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({
                message: "Problem ID is required"
            });
        }

        const problem = await Problem.findById(id);

        if (!problem) {
            return res.status(404).json({
                message: "Problem not found"
            });
        }

        // Check if user is the creator (you might want to add admin check here)
        if (problem.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                message: "You are not authorized to update this problem"
            });
        }

        // Validate difficulty if provided
        if (updateData.difficulty) {
            const validDifficulties = ["easy", "medium", "hard"];
            if (!validDifficulties.includes(updateData.difficulty)) {
                return res.status(400).json({
                    message: "Invalid difficulty value"
                });
            }
        }

        // Validate starter code languages if provided
        if (updateData.starterCode) {
            const validLanguages = ["javascript", "java", "python"];
            for (const code of updateData.starterCode) {
                if (!validLanguages.includes(code.language)) {
                    return res.status(400).json({
                        message: `Invalid language: ${code.language}`
                    });
                }
            }
        }

        // Prevent updating certain fields
        delete updateData.createdBy;
        delete updateData.totalSubmissions;
        delete updateData.totalAccepted;
        delete updateData.acceptanceRate;

        // Update the problem
        Object.assign(problem, updateData);
        await problem.save();

        res.status(200).json({
            message: "Problem updated successfully",
            problem
        });
    } catch (error) {
        console.error("Error in updateProblem controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Delete a problem (soft delete by setting isActive to false)
export async function deleteProblem(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!id) {
            return res.status(400).json({
                message: "Problem ID is required"
            });
        }

        const problem = await Problem.findById(id);

        if (!problem) {
            return res.status(404).json({
                message: "Problem not found"
            });
        }

        // Check if user is the creator (you might want to add admin check here)
        if (problem.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                message: "You are not authorized to delete this problem"
            });
        }

        // Soft delete
        problem.isActive = false;
        await problem.save();

        res.status(200).json({
            message: "Problem deleted successfully"
        });
    } catch (error) {
        console.error("Error in deleteProblem controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Get problem categories (unique categories)
export async function getCategories(req, res) {
    try {
        const categories = await Problem.distinct("category", { isActive: true });
        
        res.status(200).json({
            categories: categories.sort()
        });
    } catch (error) {
        console.error("Error in getCategories controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Get problem tags (unique tags)
export async function getTags(req, res) {
    try {
        const tags = await Problem.distinct("tags", { isActive: true });
        
        res.status(200).json({
            tags: tags.sort()
        });
    } catch (error) {
        console.error("Error in getTags controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

// Get problem test cases (for validation - only accessible by creator or admin)
export async function getProblemTestCases(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!id) {
            return res.status(400).json({
                message: "Problem ID is required"
            });
        }

        const problem = await Problem.findById(id);

        if (!problem) {
            return res.status(404).json({
                message: "Problem not found"
            });
        }

        // Only allow creator to access all test cases (add admin check if needed)
        if (problem.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                message: "You are not authorized to view all test cases"
            });
        }

        res.status(200).json({
            testCases: problem.testCases
        });
    } catch (error) {
        console.error("Error in getProblemTestCases controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}