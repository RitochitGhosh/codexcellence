import express from "express";

import { ENV } from "./lib/env.js";

const app = express();

app.get("/health", (req, res) => {
    res.status(200).json({
        msg: "Ok!"
    });
});

app.listen(ENV.PORT, () => {
    console.log(`Server runniing on http://localhost:${ENV.PORT}`);
});