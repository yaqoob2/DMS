const File = require("../models/File");

const getStorageMetrics = async () => {
    const limitBytes =
        parseInt(process.env.STORAGE_LIMIT_BYTES) || 1024 * 1024 * 1024;

    const aggregation = await File.aggregate([
        {
            $match: {
                isDeleted: false,
                currentVersionId: { $ne: null },
            },
        },
        {
            $lookup: {
                from: "fileversions",
                localField: "currentVersionId",
                foreignField: "_id",
                as: "currentVersion",
            },
        },
        {
            $unwind: "$currentVersion",
        },
        {
            $group: {
                _id: null,
                totalSize: { $sum: "$currentVersion.size" },
                totalFiles: { $sum: 1 },
            },
        },
    ]);

    const usedBytes = aggregation.length > 0 ? aggregation[0].totalSize : 0;
    const totalFiles = aggregation.length > 0 ? aggregation[0].totalFiles : 0;

    const remainingBytes = Math.max(0, limitBytes - usedBytes);
    const usagePercentage =
        limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;

    let status = "normal";
    if (usagePercentage >= 100) status = "full";
    else if (usagePercentage >= 95) status = "danger";
    else if (usagePercentage >= 80) status = "warning";

    return {
        usedBytes,
        limitBytes,
        remainingBytes,
        usagePercentage,
        totalFiles,
        status,
    };
};

module.exports = {
    getStorageMetrics,
};