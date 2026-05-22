const Folder = require("../models/Folder");
const File = require("../models/File");
const Permission = require("../models/Permission");
const { logActivity } = require("../services/activityService");
const { isWithinRetentionWindow } = require("../utils/retentionHelper");
const { userCanManageFolderPermissions } = require("../middlewares/permissionMiddleware");
const {
    removeDeletedFolderTree,
    filterActiveFoldersExcludingDeletedTrees,
} = require("../services/trashService");
const { buildParentFolderQuery } = require("../utils/folderQueryHelper");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findActiveFolderByNameAndParent = (name, parentFolderId) => {
    return Folder.findOne({
        name,
        ...buildParentFolderQuery(parentFolderId),
        isDeleted: false,
    });
};

// @desc Create a new folder
// @route POST /api/folders
const createFolder = async (req, res) => {
    try {
        const { name, parentFolderId } = req.body;
        const trimmedName = typeof name === "string" ? name.trim() : name;

        if (!trimmedName) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required",
            });
        }

        const normalizedParentId =
            parentFolderId && parentFolderId !== "null" ? parentFolderId : null;

        let path = trimmedName;
        let level = 0;

        if (normalizedParentId) {
            const parentFolder = await Folder.findOne({
                _id: normalizedParentId,
                isDeleted: false,
            });

            if (!parentFolder) {
                return res.status(404).json({
                    success: false,
                    message: "Parent folder not found",
                });
            }

            path = `${parentFolder.path}/${trimmedName}`;
            level = parentFolder.level + 1;
        }

        const existingFolder = await findActiveFolderByNameAndParent(
            trimmedName,
            normalizedParentId
        );

        if (existingFolder) {
            return res.status(400).json({
                success: false,
                message: "A folder with this name already exists in this location",
            });
        }

        const folder = await Folder.create({
            name: trimmedName,
            parentFolderId: normalizedParentId,
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

            const directlyAllowedFolderIds = permissions.map((p) => p.folderId);

            const directlyAllowedFolders = await Folder.find({
                _id: { $in: directlyAllowedFolderIds },
                isDeleted: false,
            }).select("_id path");

            const ownedFolders = await Folder.find({
                createdBy: req.user._id,
                isDeleted: false,
            }).select("_id path");

            const permissionRoots = [...directlyAllowedFolders, ...ownedFolders];
            const seenRootIds = new Set();
            const uniqueRoots = [];

            for (const folder of permissionRoots) {
                const key = folder._id.toString();

                if (!seenRootIds.has(key)) {
                    seenRootIds.add(key);
                    uniqueRoots.push(folder);
                }
            }

            const allowedOrConditions = uniqueRoots.map((folder) => ({
                $or: [
                    { _id: folder._id },
                    { path: { $regex: `^${escapeRegex(folder.path)}/` } },
                ],
            }));

            if (allowedOrConditions.length > 0) {
                query.$or = allowedOrConditions.flatMap((item) => item.$or);
            } else {
                query._id = { $in: [] };
            }
        }

        const deletedFolders = await Folder.find({
            isDeleted: true,
        }).select("_id path parentFolderId");

        let folders = await Folder.find(query).sort({
            name: 1,
        });

        folders = filterActiveFoldersExcludingDeletedTrees(folders, deletedFolders);

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

        const trimmedName = typeof name === "string" ? name.trim() : name;

        const duplicate = await Folder.findOne({
            name: trimmedName,
            ...buildParentFolderQuery(folder.parentFolderId),
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
        let newPath = trimmedName;

        if (folder.parentFolderId) {
            const parentFolder = await Folder.findOne({
                _id: folder.parentFolderId,
                isDeleted: false,
            });

            if (parentFolder) {
                newPath = `${parentFolder.path}/${trimmedName}`;
            }
        }

        folder.name = trimmedName;
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

        const activeFolder = await Folder.findOne({
            _id: req.params.id,
            isDeleted: false,
        });

        const deletedFolder = await Folder.findOne({
            _id: req.params.id,
            isDeleted: true,
        });

        // Trash UI uses DELETE /api/folders/:id on already soft-deleted rows
        if (!activeFolder && deletedFolder) {
            req.body = { ...body, confirm: true };
            return permanentlyDeleteFolder(req, res);
        }

        if (!activeFolder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found",
            });
        }

        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                message: "Delete confirmation required.",
            });
        }

        const folder = activeFolder;

        const canDelete = await userCanManageFolderPermissions(req.user, folder);

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the folder owner or users with admin permission can delete this folder.",
            });
        }

        const deletedAt = new Date();

        const deleteScopeOr = [{ _id: folder._id }];

        if (folder.path) {
            deleteScopeOr.push({
                path: { $regex: `^${escapeRegex(folder.path)}/` },
            });
        }

        const folderDeleteResult = await Folder.updateMany(
            {
                isDeleted: false,
                $or: deleteScopeOr,
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

        const deletedFolderIds = await Folder.find({
            isDeleted: true,
            $or: deleteScopeOr,
        }).distinct("_id");

        if (deletedFolderIds.length > 0) {
            await File.updateMany(
                {
                    folderId: { $in: deletedFolderIds },
                    isDeleted: false,
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
        }

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

        const canRestore = await userCanManageFolderPermissions(req.user, folder);

        if (!canRestore) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the folder owner or users with admin permission can restore this folder.",
            });
        }

        const activeDuplicate = await Folder.findOne({
            name: folder.name,
            ...buildParentFolderQuery(folder.parentFolderId),
            isDeleted: false,
            _id: { $ne: folder._id },
        });

        if (activeDuplicate) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot restore folder. An active folder with this name already exists in this location.",
            });
        }

        if (!isWithinRetentionWindow(folder.deletedAt)) {
            return res.status(400).json({
                success: false,
                message: "Restore window expired.",
            });
        }

        const restoreScopeOr = [{ _id: folder._id }];

        if (folder.path) {
            restoreScopeOr.push({
                path: { $regex: `^${escapeRegex(folder.path)}/` },
                isDeleted: true,
            });
        }

        const restoredAt = new Date();

        const restoreResult = await Folder.updateMany(
            {
                isDeleted: true,
                $or: restoreScopeOr,
            },
            {
                $set: {
                    isDeleted: false,
                    deletedAt: null,
                    deletedBy: null,
                    deleteReason: null,
                    restoredAt,
                    restoredBy: req.user._id,
                },
            }
        );

        const restoredFolderLookupOr = [{ _id: folder._id }];

        if (folder.path) {
            restoredFolderLookupOr.push({
                path: { $regex: `^${escapeRegex(folder.path)}/` },
            });
        }

        const restoredFolderIds = await Folder.find({
            isDeleted: false,
            $or: restoredFolderLookupOr,
        }).distinct("_id");

        if (restoredFolderIds.length > 0) {
            await File.updateMany(
                {
                    folderId: { $in: restoredFolderIds },
                    isDeleted: true,
                },
                {
                    $set: {
                        isDeleted: false,
                        deletedAt: null,
                        deletedBy: null,
                        deleteReason: null,
                        restoredAt,
                        restoredBy: req.user._id,
                    },
                }
            );
        }

        await logActivity({
            userId: req.user._id,
            action: "folder_restored",
            targetType: "folder",
            targetId: folder._id,
            folderId: folder._id,
            message: `${req.user.name} restored folder ${folder.name}`,
            metadata: {
                restoredAt,
                restoredFolderCount: restoreResult.modifiedCount,
            },
            req,
        });

        res.json({
            success: true,
            message: "Folder and nested folders restored successfully",
            restoredFolderCount: restoreResult.modifiedCount,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Folder restore failed",
            error: error.message,
        });
    }
};

// @desc Permanently delete a soft-deleted folder and its deleted descendants
// @route POST /api/folders/:id/permanent-delete
const permanentlyDeleteFolder = async (req, res) => {
    try {
        const body = req.body || {};
        const { confirm } = body;

        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                message: "Permanent delete confirmation required.",
            });
        }

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

        const canDelete = await userCanManageFolderPermissions(req.user, folder);

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the folder owner or users with admin permission can permanently delete this folder.",
            });
        }

        const { removedFolderCount, removedFileCount } =
            await removeDeletedFolderTree(folder);

        await logActivity({
            userId: req.user._id,
            action: "folder_deleted",
            targetType: "folder",
            targetId: folder._id,
            folderId: folder._id,
            message: `${req.user.name} permanently deleted folder ${folder.name}`,
            metadata: {
                permanent: true,
                removedFolderCount,
                removedFileCount,
            },
            req,
        });

        res.json({
            success: true,
            message: "Folder permanently deleted",
            removedFolderCount,
            removedFileCount,
        });
    } catch (error) {
        console.error("Permanent folder deletion failed:", error);

        res.status(500).json({
            success: false,
            message: "Permanent folder deletion failed",
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
    permanentlyDeleteFolder,
};