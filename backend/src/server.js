import express from "express";
import path from "path";

import { ENV } from "./lib/env.js";
import { connectDb } from "./lib/db.js";

const app = express();

const __dirname = path.resolve();

app.get("/health", (req, res) => {
    res.status(200).json({
        msg: "Ok!"
    });
});

app.get("/test", (req, res) => {
    res.status(200).json({
        msg: "Test endpoint"
    });
});

// check if application ready for deployment
if (ENV.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("/{*any}", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
    });
}


const startServer = async () => {
    try {
        await connectDb();
        app.listen(ENV.PORT, () => {
            console.log(`Server running on http://localhost:${ENV.PORT}`);
        });

    } catch (error) {
        console.error("☠️ Error while starting the server: ", error);
        process.exit(1);
    }
}

startServer();