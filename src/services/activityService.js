const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({ userId, action, targetType, targetId, folderId, fileId, message, metadata, req }) => {
    try {
        const ipAddress = req ? (req.headers['x-forwarded-for'] || req.connection?.remoteAddress) : undefined;
        const userAgent = req ? req.headers['user-agent'] : undefined;

        await ActivityLog.create({
            userId,
            action,
            targetType,
            targetId,
            folderId,
            fileId,
            message,
            metadata,
            ipAddress,
            userAgent
        });
    } catch (error) {
        console.error("Activity logging failed:", error.message);
        // Silently fail to not interrupt main workflow
    }
};

module.exports = { logActivity };
