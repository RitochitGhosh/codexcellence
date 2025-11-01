import mongoose from "mongoose";

const testCaseSchema = mongoose.Schema({
    input: {
        type: String,
        required: true,
    },
    expectedOutput: {
        type: String,
        required: true,
    },
    isHidden: {
        type: Boolean,
        default: false,
    }
}, { _id: false });

const starterCodeSchema = new mongoose.Schema({
    language: {
        type: String,
        enum: ["javascript", "java", "python"],
        required: true,
    },
    code: {
        type: String,
        required: true,
    }
}, { _id: false });

const exampleSchema = new mongoose.Schema({
    input: {
        type: String,
        required: true,
    },
    output: {
        type: String,
        required: true,
    },
    explanation: {
        type: String,
        default: "",
    }
}, { _id: false });

const problemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        required: true,
        index: true,
    },
    category: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    tags: [{
        type: String,
        trim: true,
    }],
    examples: {
        type: [exampleSchema],
        required: true,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: "At least one example is required"
        }
    },
    testCases: {
        type: [testCaseSchema],
        required: true,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: "At least one test case is required"
        }
    },
    starterCode: {
        type: [starterCodeSchema],
        required: true,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: "Starter code for at least one language is required"
        }
    },
    constraints: {
        type: String,
        default: "",
    },
    hints: [{
        type: String,
        trim: true,
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    acceptanceRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    totalSubmissions: {
        type: Number,
        default: 0,
    },
    totalAccepted: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
});

// Indexes for better query performance
problemSchema.index({ difficulty: 1, category: 1 });
problemSchema.index({ tags: 1 });
problemSchema.index({ title: "text", description: "text" });

// Pre-save middleware to generate slug from title
problemSchema.pre("save", function(next) {
    if (this.isModified("title")) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }
    next();
});

const Problem = mongoose.model("Problem", problemSchema);

export default Problem;