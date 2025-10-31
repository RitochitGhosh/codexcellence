/*
    Use connectDB method to connect your application to the mongodb server
*/

import mongoose from "mongoose";

import { ENV } from "./env.js";


export const connectDb = async () => {
    try {
        const conn = await mongoose.connect(ENV.DB_URL);
        console.log("✅ Connected to MongoDB: ", conn.connection.host);
    } catch (error) {
        console.error("☠️ Error while connecting to MongoDB: ", error);
        process.exit(1);
    }
}