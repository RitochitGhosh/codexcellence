/*
    Usage:
        Checks if user is authenticated, attaches user object to the request

    [Note: Express will automatically flatten and execute the array of middlewares sequentially, one by one.]
*/

import { requireAuth } from "@clerk/express";

import User from "../models/User.js";

export const protectRoute = [
    requireAuth(),
    async (req, res, next) => {
        try {
            const clerkId = req.auth().userId;
            if (!clerkId) return res.status(401).json({ msg: "Unauthorized - invalid token" });

            // Find user in mongodb using clerkId and attach it to the reqest
            const user = await User.findOne({ clerkId });
            if (!user) return res.status(404).json({ msg: "User not found!" });

            req.user = user;
            next();
        } catch (error) {
            console.error("Error in protectRoute middleware: ", error);
            res.status(500).json({ msg: "Internal server error" })
        }
    }
];
