const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    action: {
        type: String,
        required: true,
    },
    targetType: {
        type: String,
        enum: ["auth", "folder", "file", "version", "permission", "comment"],
        required: true,
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
    },
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
    },
    message: {
        type: String,
        required: true,
    },
    metadata: {
        type: Object,
        default: {}
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    }
}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
