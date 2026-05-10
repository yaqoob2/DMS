const FileVersion = require("../models/FileVersion");
const ActivityLog = require("../models/ActivityLog");
const { getStorageMetrics } = require("../services/storageService");

// @desc Get storage summary metrics
// @route GET /api/storage/summary
const getStorageSummary = async (req, res) => {
    try {
        const metrics = await getStorageMetrics();
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch storage summary",
            error: error.message
        });
    }
};

// @desc Get largest files in storage
// @route GET /api/storage/largest-files
const getLargestFiles = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const largestFiles = await FileVersion.find()
            .populate("fileId", "originalName folderId")
            .populate("uploadedBy", "name email")
            .sort({ size: -1 })
            .limit(limit);

        res.json({
            success: true,
            data: largestFiles
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch largest files",
            error: error.message
        });
    }
};

// @desc Get monthly upload/download activity
// @route GET /api/storage/monthly-activity
const getMonthlyActivity = async (req, res) => {
    try {
        // Group by month YYYY-MM
        const pipeline = [
            {
                $match: {
                    action: { $in: ["file_uploaded", "file_updated", "file_downloaded"] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m", date: "$createdAt" }
                    },
                    uploads: {
                        $sum: { $cond: [{ $in: ["$action", ["file_uploaded", "file_updated"]] }, 1, 0] }
                    },
                    downloads: {
                        $sum: { $cond: [{ $eq: ["$action", "file_downloaded"] }, 1, 0] }
                    },
                    // We also need to sum uploadedBytes. We stored size in metadata if we passed it.
                    // Wait, our logActivity for uploads didn't explicitly store size in metadata.
                    // We can either extract size from metadata if available, or just count events.
                    // If metadata.size exists, we add it.
                    uploadedBytes: {
                        $sum: {
                            $cond: [
                                { $in: ["$action", ["file_uploaded", "file_updated"]] },
                                { $ifNull: ["$metadata.size", 0] },
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: "$_id",
                    uploads: 1,
                    downloads: 1,
                    uploadedBytes: 1
                }
            },
            {
                $sort: { month: -1 } // newest first
            }
        ];

        const monthlyActivity = await ActivityLog.aggregate(pipeline);

        res.json({
            success: true,
            data: monthlyActivity
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch monthly activity",
            error: error.message
        });
    }
};

module.exports = {
    getStorageSummary,
    getLargestFiles,
    getMonthlyActivity
};
