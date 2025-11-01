import Problem from "../models/Problem.js";
import codeExecutor from "../services/simpleCodeExecutor.js";
/**
 * Submit code for a problem and run test cases
 */
export async function submitCode(req, res) {
    try {
        const { problemId, code, language } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!problemId || !code || !language) {
            return res.status(400).json({
                message: "Problem ID, code, and language are required"
            });
        }

        // Validate language
        const validLanguages = ["javascript", "java", "python"];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({
                message: "Invalid language. Supported languages: javascript, java, python"
            });
        }

        // Get the problem with all test cases
        const problem = await Problem.findById(problemId);

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

        // Check if the language is supported for this problem
        const hasStarterCode = problem.starterCode.some(sc => sc.language === language);
        if (!hasStarterCode) {
            return res.status(400).json({
                message: `Language ${language} is not supported for this problem`
            });
        }

        // Run test cases
        const testResults = await codeExecutor.runTestCases(code, language, problem.testCases);

        // Filter out hidden test case details for response
        const publicResults = testResults.results.map(result => {
            if (result.isHidden) {
                return {
                    passed: result.passed,
                    error: result.error,
                    executionTime: result.executionTime,
                    isHidden: true
                };
            }
            return result;
        });

        // Update problem statistics if all tests passed
        if (testResults.summary.allPassed) {
            problem.totalAccepted += 1;
        }
        problem.totalSubmissions += 1;
        
        // Calculate acceptance rate
        if (problem.totalSubmissions > 0) {
            problem.acceptanceRate = Math.round((problem.totalAccepted / problem.totalSubmissions) * 100);
        }

        await problem.save();

        res.status(200).json({
            message: testResults.summary.allPassed ? "All tests passed!" : "Some tests failed",
            results: publicResults,
            summary: testResults.summary,
            accepted: testResults.summary.allPassed
        });

    } catch (error) {
        console.error("Error in submitCode controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

/**
 * Run code against visible test cases only (for testing while coding)
 */
export async function runCode(req, res) {
    try {
        const { problemId, code, language } = req.body;

        // Validate required fields
        if (!problemId || !code || !language) {
            return res.status(400).json({
                message: "Problem ID, code, and language are required"
            });
        }

        // Validate language
        const validLanguages = ["javascript", "java", "python"];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({
                message: "Invalid language. Supported languages: javascript, java, python"
            });
        }

        // Get the problem
        const problem = await Problem.findById(problemId);

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

        // Get only visible test cases
        const visibleTestCases = problem.testCases.filter(tc => !tc.isHidden);

        if (visibleTestCases.length === 0) {
            return res.status(400).json({
                message: "No visible test cases available for this problem"
            });
        }

        // Run visible test cases only
        const testResults = await codeExecutor.runTestCases(code, language, visibleTestCases);

        res.status(200).json({
            message: "Code execution completed",
            results: testResults.results,
            summary: testResults.summary
        });

    } catch (error) {
        console.error("Error in runCode controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}

/**
 * Execute custom input for a problem (for custom testing)
 */
export async function executeCustomInput(req, res) {
    try {
        const { code, language, input } = req.body;

        // Validate required fields
        if (!code || !language) {
            return res.status(400).json({
                message: "Code and language are required"
            });
        }

        // Validate language
        const validLanguages = ["javascript", "java", "python"];
        if (!validLanguages.includes(language)) {
            return res.status(400).json({
                message: "Invalid language. Supported languages: javascript, java, python"
            });
        }

        // Execute code with custom input
        const result = await codeExecutor.executeCode(code, language, input || "");

        res.status(200).json({
            success: result.success,
            output: result.output,
            error: result.error,
            executionTime: result.executionTime
        });

    } catch (error) {
        console.error("Error in executeCustomInput controller:", error.message);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
}