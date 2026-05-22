const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Folder name is required"],
            trim: true,
        },
        parentFolderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Folder",
            default: null,
        },
        path: {
            type: String,
            required: true,
        },
        level: {
            type: Number,
            default: 0,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        deleteReason: {
            type: String,
            default: null,
        },
        restoredAt: {
            type: Date,
            default: null,
        },
        restoredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

// Unique name per parent for active folders only (soft-deleted rows are excluded).
folderSchema.index(
    { name: 1, parentFolderId: 1 },
    {
        unique: true,
        partialFilterExpression: { isDeleted: { $eq: false } },
    }
);

module.exports = mongoose.model("Folder", folderSchema);
