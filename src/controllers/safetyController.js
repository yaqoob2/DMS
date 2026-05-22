const File = require("../models/File");
const Folder = require("../models/Folder");
const { logActivity } = require("../services/activityService");
const {
    getRootDeletedFolders,
    permanentlyDeleteAllDeletedFolders,
    permanentlyDeleteAllDeletedFiles,
} = require("../services/trashService");
const { isWithinRetentionWindow } = require("../utils/retentionHelper");

// Helper to calculate days remaining
const calculateDaysRemaining = (deletedAt, days = 30) => {
    if (!deletedAt) return 0;
    const now = new Date();
    const deletedDate = new Date(deletedAt);
    const diffTime = now - deletedDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, days - diffDays);
};

// @desc Get deleted files within retention window
// @route GET /api/safety/deleted-files
const getDeletedFiles = async (req, res) => {
    try {
        const deletedFilesRaw = await File.find({ isDeleted: true })
            .populate("deletedBy", "name email")
            .populate("folderId", "name path")
            .populate("currentVersionId", "mimeType size originalName")
            .sort({ deletedAt: -1 })
            .lean();

        const deletedFolderIds = await Folder.find({ isDeleted: true }).distinct("_id");

        const validFiles = deletedFilesRaw
            .filter((f) => isWithinRetentionWindow(f.deletedAt))
            .filter((f) => {
                const folderRef = f.folderId?._id || f.folderId;
                return (
                    !folderRef ||
                    !deletedFolderIds.some(
                        (id) => id.toString() === folderRef.toString()
                    )
                );
            })
            .map((f) => ({
                _id: f._id,
                name: f.originalName,
                originalName: f.originalName,
                folder: f.folderId,
                deletedAt: f.deletedAt,
                deletedBy: f.deletedBy,
                deleteReason: f.deleteReason,
                daysRemaining: calculateDaysRemaining(f.deletedAt),
                mimeType: f.currentVersionId?.mimeType || "-",
                type: f.currentVersionId?.mimeType || "-",
                size: f.currentVersionId?.size || 0,
            }));

        res.json({
            success: true,
            count: validFiles.length,
            data: validFiles,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch deleted files",
            error: error.message,
        });
    }
};

// @desc Get deleted folders within retention window
// @route GET /api/safety/deleted-folders
const getDeletedFolders = async (req, res) => {
    try {
        const deletedFoldersRaw = await Folder.find({ isDeleted: true })
            .populate("deletedBy", "name email")
            .sort({ deletedAt: -1 })
            .lean();

        const withinRetention = deletedFoldersRaw.filter((f) =>
            isWithinRetentionWindow(f.deletedAt)
        );

        const rootDeletedFolders = getRootDeletedFolders(withinRetention);

        const validFolders = rootDeletedFolders.map((f) => {
            const nestedCount = withinRetention.filter(
                (other) =>
                    other._id.toString() !== f._id.toString() &&
                    other.path &&
                    f.path &&
                    other.path.startsWith(`${f.path}/`)
            ).length;

            return {
                _id: f._id,
                name: f.name,
                path: f.path,
                deletedAt: f.deletedAt,
                deletedBy: f.deletedBy,
                deleteReason: f.deleteReason,
                daysRemaining: calculateDaysRemaining(f.deletedAt),
                nestedDeletedCount: nestedCount,
            };
        });

        res.json({
            success: true,
            count: validFolders.length,
            data: validFolders,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch deleted folders",
            error: error.message,
        });
    }
};

// @desc Permanently delete all eligible deleted folders
// @route POST /api/safety/deleted-folders/permanent-delete-all
const permanentlyDeleteAllFolders = async (req, res) => {
    try {
        const { confirm } = req.body || {};

        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                message: "Permanent delete all confirmation required.",
            });
        }

        const result = await permanentlyDeleteAllDeletedFolders(req.user);

        await logActivity({
            userId: req.user._id,
            action: "folder_deleted",
            targetType: "folder",
            targetId: null,
            message: `${req.user.name} permanently deleted all eligible deleted folders`,
            metadata: { permanent: true, bulk: true, ...result },
            req,
        });

        res.json({
            success: true,
            message: "Eligible deleted folders permanently removed",
            ...result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to permanently delete all folders",
            error: error.message,
        });
    }
};

// @desc Permanently delete all eligible deleted files
// @route POST /api/safety/deleted-files/permanent-delete-all
const permanentlyDeleteAllFiles = async (req, res) => {
    try {
        const { confirm } = req.body || {};

        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                message: "Permanent delete all confirmation required.",
            });
        }

        const result = await permanentlyDeleteAllDeletedFiles(req.user);

        await logActivity({
            userId: req.user._id,
            action: "file_deleted",
            targetType: "file",
            targetId: null,
            message: `${req.user.name} permanently deleted all eligible deleted files`,
            metadata: { permanent: true, bulk: true, ...result },
            req,
        });

        res.json({
            success: true,
            message: "Eligible deleted files permanently removed",
            ...result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to permanently delete all files",
            error: error.message,
        });
    }
};

// @desc Get backup guidance
// @route GET /api/safety/backup-guidance
const getBackupGuidance = (req, res) => {
    res.json({
        success: true,
        data: {
            database: [
                "Enable MongoDB Atlas automated backups",
                "Take manual backup before deployment",
                "Use point-in-time restore if available",
            ],
            r2: [
                "Enable lifecycle rules later",
                "Keep soft-deleted metadata for 30 days",
                "Do not permanently delete R2 objects during MVP",
            ],
        },
    });
};

module.exports = {
    getDeletedFiles,
    getDeletedFolders,
    permanentlyDeleteAllFolders,
    permanentlyDeleteAllFiles,
    getBackupGuidance,
};
