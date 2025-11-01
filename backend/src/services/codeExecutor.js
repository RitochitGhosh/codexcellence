import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const execPromise = promisify(exec);

// Timeouts and limits - can be overridden by environment variables
const EXECUTION_TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT) || 5000; // 5 seconds
const MAX_OUTPUT_SIZE = parseInt(process.env.MAX_OUTPUT_SIZE) || 10000; // 10KB

/**
 * Execute code within the same Docker container
 * Uses pre-installed Node.js, Python, and Java
 * 
 * This approach is SAFE because:
 * 1. The entire app runs in an isolated Docker container
 * 2. Savella provides container-level isolation
 * 3. Resource limits are set at container level
 * 4. No nested Docker needed
 */
export class InContainerCodeExecutor {
    constructor() {
        this.tempDir = process.env.TEMP_DIR || path.join(process.cwd(), "temp");
        this.initTempDir();
        this.checkRuntimesAvailability();
    }

    async initTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log(`✓ Temp directory initialized at: ${this.tempDir}`);
        } catch (error) {
            console.error("Error creating temp directory:", error);
            throw new Error("Failed to initialize temp directory");
        }
    }

    async checkRuntimesAvailability() {
        const runtimes = {
            node: 'node --version',
            python: 'python3 --version',
            java: 'java -version'
        };

        console.log('Checking runtime availability...');
        
        for (const [name, command] of Object.entries(runtimes)) {
            try {
                const { stdout, stderr } = await execPromise(command);
                const version = stdout || stderr;
                console.log(`✓ ${name}: ${version.split('\n')[0]}`);
            } catch (error) {
                console.error(`⚠️  Warning: ${name} is not available`);
            }
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
            console.error(`Execution error for ${language}:`, error.message);
            return {
                success: false,
                output: "",
                error: error.message,
                executionTime: 0
            };
        } finally {
            // Cleanup (non-blocking)
            this.cleanupDirectory(executionDir);
        }
    }

    /**
     * Cleanup directory asynchronously
     */
    async cleanupDirectory(dirPath) {
        setTimeout(async () => {
            try {
                await fs.rm(dirPath, { recursive: true, force: true });
            } catch (error) {
                console.error(`Cleanup error for ${dirPath}:`, error.message);
            }
        }, 100);
    }

    /**
     * Execute JavaScript code using Node.js
     */
    async executeJavaScript(code, input, executionDir) {
        const fileName = "solution.js";
        const filePath = path.join(executionDir, fileName);

        // Wrap code to handle stdin
        const wrappedCode = `
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
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
            // Create input file
            const inputFile = path.join(executionDir, "input.txt");
            await fs.writeFile(inputFile, input);

            // Execute with timeout
            const command = `timeout ${Math.ceil(EXECUTION_TIMEOUT / 1000)} node ${filePath} < ${inputFile}`;
            
            const { stdout, stderr } = await execPromise(command, {
                cwd: executionDir,
                timeout: EXECUTION_TIMEOUT + 1000,
                maxBuffer: MAX_OUTPUT_SIZE,
                encoding: 'utf8'
            });

            const executionTime = Date.now() - startTime;

            return {
                success: stderr.length === 0 || !stderr.includes('Error'),
                output: stdout.trim(),
                error: stderr.trim(),
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            if (error.killed || error.code === 124) { // timeout exit code
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
            const inputFile = path.join(executionDir, "input.txt");
            await fs.writeFile(inputFile, input);

            const command = `timeout ${Math.ceil(EXECUTION_TIMEOUT / 1000)} python3 ${filePath} < ${inputFile}`;
            
            const { stdout, stderr } = await execPromise(command, {
                cwd: executionDir,
                timeout: EXECUTION_TIMEOUT + 1000,
                maxBuffer: MAX_OUTPUT_SIZE,
                encoding: 'utf8'
            });

            const executionTime = Date.now() - startTime;

            return {
                success: stderr.length === 0 || !stderr.includes('Error'),
                output: stdout.trim(),
                error: stderr.trim(),
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            if (error.killed || error.code === 124) {
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
            // Compile
            const compileCommand = `javac ${fileName}`;
            await execPromise(compileCommand, {
                cwd: executionDir,
                timeout: EXECUTION_TIMEOUT,
                maxBuffer: MAX_OUTPUT_SIZE
            });

            // Execute
            const inputFile = path.join(executionDir, "input.txt");
            await fs.writeFile(inputFile, input);

            const runCommand = `timeout ${Math.ceil(EXECUTION_TIMEOUT / 1000)} java ${className} < ${inputFile}`;
            
            const { stdout, stderr } = await execPromise(runCommand, {
                cwd: executionDir,
                timeout: EXECUTION_TIMEOUT + 1000,
                maxBuffer: MAX_OUTPUT_SIZE,
                encoding: 'utf8'
            });

            const executionTime = Date.now() - startTime;

            return {
                success: stderr.length === 0 || !stderr.includes('Error'),
                output: stdout.trim(),
                error: stderr.trim(),
                executionTime
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;

            if (error.killed || error.code === 124) {
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
        let shouldContinue = true;

        for (const testCase of testCases) {
            if (!shouldContinue) break;

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

            // Stop if execution failed
            if (!result.success) {
                shouldContinue = false;
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

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const checks = {
                node: await execPromise('node --version'),
                python: await execPromise('python3 --version'),
                java: await execPromise('java -version')
            };

            return {
                status: 'healthy',
                runtimes: {
                    node: checks.node.stdout.trim(),
                    python: checks.python.stdout.trim(),
                    java: 'available'
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

export default new InContainerCodeExecutor();