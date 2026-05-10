const FileVersion = require("../models/FileVersion");

const getStorageMetrics = async () => {
    // Default limit 1GB if not set
    const limitBytes = parseInt(process.env.STORAGE_LIMIT_BYTES) || 1024 * 1024 * 1024;
    
    const aggregation = await FileVersion.aggregate([
        { $group: { _id: null, totalSize: { $sum: "$size" } } },
    ]);
    
    const usedBytes = aggregation.length > 0 ? aggregation[0].totalSize : 0;
    const remainingBytes = Math.max(0, limitBytes - usedBytes);
    const usagePercentage = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;

    let status = "normal";
    if (usagePercentage >= 100) status = "full";
    else if (usagePercentage >= 95) status = "danger";
    else if (usagePercentage >= 80) status = "warning";

    return {
        usedBytes,
        limitBytes,
        remainingBytes,
        usagePercentage,
        status
    };
};

module.exports = {
    getStorageMetrics,
};
