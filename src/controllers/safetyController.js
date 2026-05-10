const File = require("../models/File");
const Folder = require("../models/Folder");
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

        // Filter and map in memory
        const validFiles = deletedFilesRaw
            .filter(f => isWithinRetentionWindow(f.deletedAt))
            .map(f => ({
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
            data: validFiles
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch deleted files",
            error: error.message
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

        // Filter and map in memory
        const validFolders = deletedFoldersRaw
            .filter(f => isWithinRetentionWindow(f.deletedAt))
            .map(f => ({
                _id: f._id,
                name: f.name,
                path: f.path,
                deletedAt: f.deletedAt,
                deletedBy: f.deletedBy,
                deleteReason: f.deleteReason,
                daysRemaining: calculateDaysRemaining(f.deletedAt)
            }));

        res.json({
            success: true,
            count: validFolders.length,
            data: validFolders
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch deleted folders",
            error: error.message
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
                "Use point-in-time restore if available"
            ],
            r2: [
                "Enable lifecycle rules later",
                "Keep soft-deleted metadata for 30 days",
                "Do not permanently delete R2 objects during MVP"
            ]
        }
    });
};

module.exports = {
    getDeletedFiles,
    getDeletedFolders,
    getBackupGuidance
};
