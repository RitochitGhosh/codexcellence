import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const execPromise = promisify(exec);

// Timeouts and limits
const EXECUTION_TIMEOUT = 5000; // 5 seconds
const MAX_OUTPUT_SIZE = 10000; // 10KB

/**
 * Execute code WITHOUT Docker (for development only)
 * WARNING: This is less secure and should not be used in production
 * Use the Docker version (codeExecutor.js) for production
 */
export class SimpleCodeExecutor {
    constructor() {
        this.tempDir = path.join(process.cwd(), "temp");
        this.initTempDir();
    }

    async initTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error("Error creating temp directory:", error);
        }
    }

    /**
     * Execute code based on language
     */
    async executeCode(code, language, input = "") {
        const executionId = crypto.randomBytes(16).toString("hex");
        const executionDir = path.join(this.tempDir, executionId);

        try {
            await fs.mkdir(executionDir, { recursive: true });

            switch (language) {
                case "javascript":
                    return await this.executeJavaScript(code, input, executionDir);
                case "python":
                    return await this.executePython(code, input, executionDir);
                case "java":
                    return await this.executeJava(code, input, executionDir);
                default:
                    throw new Error(`Unsupported language: ${language}`);
            }
        } catch (error) {
            return {
                success: false,
                output: "",
                error: error.message,
                executionTime: 0
            };
        } finally {
            // Cleanup
            try {
                await fs.rm(executionDir, { recursive: true, force: true });
            } catch (error) {
                console.error("Error cleaning up execution directory:", error);
            }
        }
    }

    /**
     * Execute JavaScript code using Node.js
     */
    async executeJavaScript(code, input, executionDir) {
        const fileName = "solution.js";
        const filePath = path.join(executionDir, fileName);

        // Wrap code to handle stdin input
        const wrappedCode = `
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let inputLines = [];
rl.on('line', (line) => {
    inputLines.push(line);
});

rl.on('close', () => {
    try {
        ${code}
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
});
`;

        await fs.writeFile(filePath, wrappedCode);

        const startTime = Date.now();

        try {
            const { stdout, stderr } = await execPromise(`node ${filePath}`, {
                cwd: executionDir,
                input: input,
                timeout: EXECUTION_TIMEOUT,
                maxBuffer: MAX_OUTPUT_SIZE,
                killSignal: 'SIGTERM'
            });

            const executionTime = Date.now() - startTime;

            return {
                success: !stderr,
                output: stdout.trim(),
                error: stderr.trim(),
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            if (error.killed) {
                return {
                    success: false,
                    output: "",
                    error: "Execution timed out",
                    executionTime: EXECUTION_TIMEOUT
                };
            }

            return {
                success: false,
                output: error.stdout?.trim() || "",
                error: error.stderr?.trim() || error.message,
                executionTime
            };
        }
    }

    /**
     * Execute Python code
     */
    async executePython(code, input, executionDir) {
        const fileName = "solution.py";
        const filePath = path.join(executionDir, fileName);

        await fs.writeFile(filePath, code);

        const startTime = Date.now();

        try {
            const { stdout, stderr } = await execPromise(`python3 ${filePath}`, {
                cwd: executionDir,
                input: input,
                timeout: EXECUTION_TIMEOUT,
                maxBuffer: MAX_OUTPUT_SIZE,
                killSignal: 'SIGTERM'
            });

            const executionTime = Date.now() - startTime;

            return {
                success: !stderr,
                output: stdout.trim(),
                error: stderr.trim(),
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            if (error.killed) {
                return {
                    success: false,
                    output: "",
                    error: "Execution timed out",
                    executionTime: EXECUTION_TIMEOUT
                };
            }

            return {
                success: false,
                output: error.stdout?.trim() || "",
                error: error.stderr?.trim() || error.message,
                executionTime
            };
        }
    }

    /**
     * Execute Java code
     */
    async executeJava(code, input, executionDir) {
        const className = this.extractJavaClassName(code);
        const fileName = `${className}.java`;
        const filePath = path.join(executionDir, fileName);

        await fs.writeFile(filePath, code);

        const startTime = Date.now();

        try {
            // First compile
            await execPromise(`javac ${fileName}`, {
                cwd: executionDir,
                timeout: EXECUTION_TIMEOUT,
                maxBuffer: MAX_OUTPUT_SIZE
            });

            // Then execute
            const { stdout, stderr } = await execPromise(`java ${className}`, {
                cwd: executionDir,
                input: input,
                timeout: EXECUTION_TIMEOUT,
                maxBuffer: MAX_OUTPUT_SIZE,
                killSignal: 'SIGTERM'
            });

            const executionTime = Date.now() - startTime;

            return {
                success: !stderr,
                output: stdout.trim(),
                error: stderr.trim(),
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            if (error.killed) {
                return {
                    success: false,
                    output: "",
                    error: "Execution timed out",
                    executionTime: EXECUTION_TIMEOUT
                };
            }

            return {
                success: false,
                output: error.stdout?.trim() || "",
                error: error.stderr?.trim() || error.message,
                executionTime
            };
        }
    }

    /**
     * Extract class name from Java code
     */
    extractJavaClassName(code) {
        const match = code.match(/public\s+class\s+(\w+)/);
        return match ? match[1] : "Solution";
    }

    /**
     * Run test cases against the code
     */
    async runTestCases(code, language, testCases) {
        const results = [];

        for (const testCase of testCases) {
            const result = await this.executeCode(code, language, testCase.input);
            
            const passed = result.success && 
                          result.output.trim() === testCase.expectedOutput.trim();

            results.push({
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                actualOutput: result.output,
                passed,
                error: result.error,
                executionTime: result.executionTime,
                isHidden: testCase.isHidden || false
            });

            // Stop if execution failed (compilation error, runtime error, etc.)
            if (!result.success) {
                break;
            }
        }

        const totalTests = testCases.length;
        const passedTests = results.filter(r => r.passed).length;

        return {
            results,
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: totalTests - passedTests,
                allPassed: passedTests === totalTests
            }
        };
    }
}

export default new SimpleCodeExecutor();