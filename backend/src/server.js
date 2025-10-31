import express from "express";
import path from "path";
import cors from "cors";
import { serve } from "inngest/express";

import { ENV } from "./lib/env.js";
import { connectDb } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

const app = express();

const __dirname = path.resolve();

// middlewares
app.use(express.json());
app.use(cors({
    origin: ENV.CLIENT_URL,
    credentials: true, // server allows browser to include cookies on request
}));

app.use("/api/inngest", serve({ client: inngest, functions }))

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