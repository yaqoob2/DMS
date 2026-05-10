const mongoose = require("mongoose");

const fileVersionSchema = new mongoose.Schema(
    {
        fileId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "File",
            required: true,
        },
        versionNumber: {
            type: Number,
            required: true,
        },
        originalName: {
            type: String,
            required: true,
        },
        storedName: {
            type: String,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
        },
        storageKey: {
            type: String,
            required: true,
        },
        storageUrl: {
            type: String,
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        commitMessage: {
            type: String,
            required: true,
        },
        isRestoredFrom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FileVersion",
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("FileVersion", fileVersionSchema);
