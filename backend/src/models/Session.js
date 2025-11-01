import mongoose from "mongoose";
import crypto from "crypto";

const sessionSchema = new mongoose.Schema({
    problem: {
        type: String,
        required: true,
        index: true
    },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        required: true
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    participant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    status: {
        type: String,
        enum: ["active", "completed"],
        default: "active",
    },
    // stream video call Id
    callId: {
        type: String,
        default: "",
    },
    // Session code for joining
    sessionCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        index: true,
    },
}, {
    timestamps: true,
});

// Pre-save middleware to generate session code if not provided
sessionSchema.pre("save", function(next) {
    if (this.isNew && !this.sessionCode) {
        // Generate a 6-character alphanumeric code
        this.sessionCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    }
    next();
});

// Index for better query performance
sessionSchema.index({ status: 1, createdAt: -1 });
sessionSchema.index({ host: 1, status: 1 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;