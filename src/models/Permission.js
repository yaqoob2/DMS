const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
    {
        folderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Folder",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        access: {
            type: String,
            enum: ["view", "edit", "admin"],
            required: true,
        },
        grantedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

permissionSchema.index({ folderId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Permission", permissionSchema);
