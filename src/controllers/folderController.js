const Folder = require("../models/Folder");
const Permission = require("../models/Permission");
const { logActivity } = require("../services/activityService");
const { isWithinRetentionWindow } = require("../utils/retentionHelper");

// @desc Create a new folder
// @route POST /api/folders
const createFolder = async (req, res) => {
    try {
        const { name, parentFolderId } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required",
            });
        }

        let path = name;
        let level = 0;

        if (parentFolderId && parentFolderId !== "null") {
            const parentFolder = await Folder.findOne({
                _id: parentFolderId,
                isDeleted: false,
            });

            if (!parentFolder) {
                return res.status(404).json({
                    success: false,
                    message: "Parent folder not found",
                });
            }

            path = `${parentFolder.path}/${name}`;
            level = parentFolder.level + 1;
        }

        const existingFolder = await Folder.findOne({
            name,
            parentFolderId:
                parentFolderId && parentFolderId !== "null"
                    ? parentFolderId
                    : null,
            isDeleted: false,
        });

        if (existingFolder) {
            return res.status(400).json({
                success: false,
                message: "A folder with this name already exists in this location",
            });
        }

        const folder = await Folder.create({
            name,
            parentFolderId:
                parentFolderId && parentFolderId !== "null"
                    ? parentFolderId
                    : null,
            path,
            level,
            createdBy: req.user._id,
        });

        await Permission.create({
            folderId: folder._id,
            userId: req.user._id,
            access: "admin",
            grantedBy: req.user._id,
        });

        await logActivity({
            userId: req.user._id,
            action: "folder_created",
            targetType: "folder",
            targetId: folder._id,
            folderId: folder._id,
            message: `${req.user.name} created folder ${folder.name}`,
            req,
        });

        res.status(201).json({
            success: true,
            message: "Folder created successfully",
            folder,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "A folder with this name already exists in this location",
            });
        }

        res.status(500).json({
            success: false,
            message: "Folder creation failed",
            error: error.message,
        });
    }
};

// @desc Get all folders
// @route GET /api/folders
const getFolders = async (req, res) => {
    try {
        const { parentFolderId } = req.query;

        const query = {
            isDeleted: false,
        };

        if (parentFolderId !== undefined) {
            query.parentFolderId =
                parentFolderId === "null" ? null : parentFolderId;
        }

        if (req.user) {
            const permissions = await Permission.find({
                userId: req.user._id,
                isActive: true,
            });

            const allowedFolderIds = permissions.map((p) => p.folderId);

            query._id = { $in: allowedFolderIds };
        }

        const deletedFolders = await Folder.find({
            isDeleted: true,
        }).select("path");

        const deletedPaths = deletedFolders.map((folder) => folder.path);

        let folders = await Folder.find(query).sort({
            name: 1,
        });

        folders = folders.filter((folder) => {
            return !deletedPaths.some((deletedPath) => {
                return (
                    folder.path === deletedPath ||
                    folder.path.startsWith(`${deletedPath}/`)
                );
            });
        });

        res.json({
            success: true,
            count: folders.length,
            folders,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch folders",
            error: error.message,
        });
    }
};

// @desc Get folder by ID
// @route GET /api/folders/:id
const getFolderById = async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            isDeleted: false,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found",
            });
        }

        res.json({
            success: true,
            folder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch folder",
            error: error.message,
        });
    }
};

// @desc Rename a folder
// @route PATCH /api/folders/:id
const renameFolder = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "New folder name is required",
            });
        }

        const folder = await Folder.findOne({
            _id: req.params.id,
            isDeleted: false,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found",
            });
        }

        const duplicate = await Folder.findOne({
            name,
            parentFolderId: folder.parentFolderId,
            isDeleted: false,
            _id: { $ne: folder._id },
        });

        if (duplicate) {
            return res.status(400).json({
                success: false,
                message: "A folder with this name already exists in this location",
            });
        }

        const oldPath = folder.path;
        let newPath = name;

        if (folder.parentFolderId) {
            const parentFolder = await Folder.findOne({
                _id: folder.parentFolderId,
                isDeleted: false,
            });

            if (parentFolder) {
                newPath = `${parentFolder.path}/${name}`;
            }
        }

        folder.name = name;
        folder.path = newPath;
        await folder.save();

        const children = await Folder.find({
            path: { $regex: `^${oldPath}/` },
            isDeleted: false,
        });

        for (let child of children) {
            child.path = child.path.replace(
                new RegExp(`^${oldPath}/`),
                `${newPath}/`
            );
            await child.save();
        }

        res.json({
            success: true,
            message: "Folder renamed successfully",
            folder,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Folder rename failed",
            error: error.message,
        });
    }
};

// @desc Soft delete a folder and its child folders
// @route DELETE /api/folders/:id
const deleteFolder = async (req, res) => {
    try {
        const body = req.body || {};
        const { confirm, reason } = body;

        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                message: "Delete confirmation required.",
            });
        }

        const folder = await Folder.findOne({
            _id: req.params.id,
            isDeleted: false,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found",
            });
        }

        const deletedAt = new Date();

        await Folder.updateMany(
            {
                isDeleted: false,
                $or: [
                    { _id: folder._id },
                    { path: { $regex: `^${folder.path}/` } },
                ],
            },
            {
                $set: {
                    isDeleted: true,
                    deletedAt,
                    deletedBy: req.user?._id || null,
                    deleteReason: reason || null,
                },
            }
        );

        await logActivity({
            userId: req.user?._id,
            action: "folder_deleted",
            targetType: "folder",
            targetId: folder._id,
            folderId: folder._id,
            message: `${req.user?.name || "User"} deleted folder ${folder.name}`,
            metadata: {
                reason: reason || null,
                deletedAt,
            },
            req,
        });

        return res.json({
            success: true,
            message: "Folder and child folders deleted successfully",
        });
    } catch (error) {
        console.error("Folder deletion failed:", error);

        return res.status(500).json({
            success: false,
            message: "Folder deletion failed",
            error: error.message,
        });
    }
};

// @desc Restore deleted folder
// @route POST /api/folders/:id/restore-deleted
const restoreDeletedFolder = async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            isDeleted: true,
        });

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Deleted folder not found",
            });
        }

        if (!isWithinRetentionWindow(folder.deletedAt)) {
            return res.status(400).json({
                success: false,
                message: "Restore window expired.",
            });
        }

        folder.isDeleted = false;
        folder.deletedAt = null;
        folder.deletedBy = null;
        folder.deleteReason = null;
        folder.restoredAt = new Date();
        folder.restoredBy = req.user._id;

        await folder.save();

        await logActivity({
            userId: req.user._id,
            action: "folder_restored",
            targetType: "folder",
            targetId: folder._id,
            folderId: folder._id,
            message: `${req.user.name} restored folder ${folder.name}`,
            metadata: { restoredAt: folder.restoredAt },
            req,
        });

        res.json({
            success: true,
            message: "Folder restored successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Folder restore failed",
            error: error.message,
        });
    }
};

module.exports = {
    createFolder,
    getFolders,
    getFolderById,
    renameFolder,
    deleteFolder,
    restoreDeletedFolder,
};