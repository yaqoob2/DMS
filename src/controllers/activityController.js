const ActivityLog = require("../models/ActivityLog");
const Permission = require("../models/Permission");

// @desc Get all activity logs
// @route GET /api/activity
const getActivityLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = {};

        // If not superadmin, restrict to allowed folders
        if (req.user.role !== "superadmin") {
            const permissions = await Permission.find({
                userId: req.user._id,
                isActive: true
            });
            const allowedFolderIds = permissions.map(p => p.folderId);
            
            // Allow logs associated with these folders, OR auth logs for themselves
            query.$or = [
                { folderId: { $in: allowedFolderIds } },
                { userId: req.user._id, targetType: "auth" }
            ];
        }

        const logs = await ActivityLog.find(query)
            .populate("userId", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ActivityLog.countDocuments(query);

        res.json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch activity logs",
            error: error.message,
        });
    }
};

// @desc Get activity logs for a specific file
// @route GET /api/files/:id/activity
const getFileActivityLogs = async (req, res) => {
    try {
        const fileId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = { fileId };

        const logs = await ActivityLog.find(query)
            .populate("userId", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ActivityLog.countDocuments(query);

        res.json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch file activity logs",
            error: error.message,
        });
    }
};

// @desc Get activity logs for a specific folder
// @route GET /api/folders/:id/activity
const getFolderActivityLogs = async (req, res) => {
    try {
        const folderId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = { folderId };

        const logs = await ActivityLog.find(query)
            .populate("userId", "name email role")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ActivityLog.countDocuments(query);

        res.json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch folder activity logs",
            error: error.message,
        });
    }
};

module.exports = {
    getActivityLogs,
    getFileActivityLogs,
    getFolderActivityLogs,
};
