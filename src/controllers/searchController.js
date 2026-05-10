const File = require("../models/File");
const Folder = require("../models/Folder");
const FileVersion = require("../models/FileVersion");
const User = require("../models/User");
const Permission = require("../models/Permission");
const { getFileTypeInfo } = require("../utils/fileTypeHelper");

// @desc Global search
// @route GET /api/search
const search = async (req, res) => {
    try {
        const { q, type } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        if (!q || q.trim() === "") {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const regex = new RegExp(q, "i");

        let allowedFolderIds = null;
        // Apply permission filtering for normal users
        if (req.user.role !== "superadmin") {
            const permissions = await Permission.find({
                userId: req.user._id,
                isActive: true
            });
            allowedFolderIds = permissions.map(p => p.folderId);
        }

        let folders = [];
        let files = [];
        let foldersCount = 0;
        let filesCount = 0;

        // Search Folders
        if (!type || type === "all" || type === "folders") {
            const folderQuery = {
                isDeleted: false,
                $or: [
                    { name: regex },
                    { path: regex }
                ]
            };

            if (allowedFolderIds) {
                folderQuery._id = { $in: allowedFolderIds };
            }

            foldersCount = await Folder.countDocuments(folderQuery);
            folders = await Folder.find(folderQuery)
                .skip((page - 1) * limit)
                .limit(limit);
        }

        // Search Files
        if (!type || type === "all" || type === "files") {
            // First, find matched users by name or email
            const matchedUsers = await User.find({
                $or: [{ name: regex }, { email: regex }]
            }).select("_id");
            const matchedUserIds = matchedUsers.map(u => u._id);

            // Second, find matched versions by commit message or original name or uploader
            const matchedVersions = await FileVersion.find({
                $or: [
                    { originalName: regex },
                    { commitMessage: regex },
                    { uploadedBy: { $in: matchedUserIds } }
                ]
            }).select("fileId");
            const matchedVersionFileIds = matchedVersions.map(v => v.fileId);

            // Construct file query
            const fileQuery = {
                isDeleted: false,
                $or: [
                    { originalName: regex },
                    { uploadedBy: { $in: matchedUserIds } },
                    { _id: { $in: matchedVersionFileIds } }
                ]
            };

            if (allowedFolderIds) {
                fileQuery.folderId = { $in: allowedFolderIds };
            }

            filesCount = await File.countDocuments(fileQuery);
            
            const rawFiles = await File.find(fileQuery)
                .populate("currentVersionId")
                .populate("uploadedBy", "name email")
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            // Append metadata
            files = rawFiles.map(file => {
                const cv = file.currentVersionId;
                const typeInfo = getFileTypeInfo(
                    cv ? cv.originalName : file.originalName,
                    cv ? cv.mimeType : ""
                );

                return {
                    ...file,
                    ...typeInfo
                };
            });
        }

        res.json({
            success: true,
            data: {
                files,
                folders
            },
            pagination: {
                page,
                limit,
                filesCount,
                foldersCount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Search failed",
            error: error.message
        });
    }
};

module.exports = { search };
