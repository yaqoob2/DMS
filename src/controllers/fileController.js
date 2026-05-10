const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const r2 = require("../config/r2");
const File = require("../models/File");
const FileVersion = require("../models/FileVersion");
const Folder = require("../models/Folder");
const Permission = require("../models/Permission");
const { logActivity } = require("../services/activityService");
const { getStorageMetrics } = require("../services/storageService");
const { getFileTypeInfo } = require("../utils/fileTypeHelper");
const { isWithinRetentionWindow } = require("../utils/retentionHelper");

// Helper to sanitize file names
const sanitizeFileName = (fileName) => {
    return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
};

// Helper to format full file details
const getFileDetailsResponse = async (fileId) => {
    const file = await File.findOne({ _id: fileId, isDeleted: false })
        .populate("uploadedBy", "name email")
        .populate("folderId", "name path")
        .populate({
            path: "currentVersionId",
            populate: { path: "uploadedBy", select: "name email" }
        })
        .lean();

    if (!file) return null;

    const versionsCount = await FileVersion.countDocuments({ fileId });

    const typeInfo = getFileTypeInfo(
        file.currentVersionId ? file.currentVersionId.originalName : file.originalName,
        file.currentVersionId ? file.currentVersionId.mimeType : ""
    );

    return {
        _id: file._id,
        originalName: file.originalName,
        folderId: file.folderId,
        uploadedBy: file.uploadedBy,
        currentVersion: file.currentVersionId,
        latestVersionNumber: file.latestVersionNumber,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        versionsCount,
        ...typeInfo
    };
};

// @desc Upload a file (Initial)
// @route POST /api/files/upload
const uploadFile = async (req, res) => {
    try {
        const { folderId, commitMessage } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "No file provided" });
        }
        if (!folderId) {
            return res.status(400).json({ success: false, message: "Folder ID is required" });
        }
        if (!commitMessage || commitMessage.trim() === "") {
            return res.status(400).json({ success: false, message: "Commit message is required" });
        }

        // Check if folder exists
        const folder = await Folder.findOne({ _id: folderId, isDeleted: false });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        const metrics = await getStorageMetrics();

        if (metrics.usedBytes + file.size > metrics.limitBytes) {
            return res.status(403).json({
                success: false,
                message: "Storage limit exceeded. Upload blocked.",
                storage: {
                    usedBytes: metrics.usedBytes,
                    limitBytes: metrics.limitBytes,
                    remainingBytes: metrics.remainingBytes
                }
            });
        }

        const safeFileName = sanitizeFileName(file.originalname);
        const timestamp = Date.now();
        const storageKey = `folders/${folderId}/${timestamp}-${safeFileName}`;

        // Upload buffer to R2
        const putCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: storageKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        });

        await r2.send(putCommand);

        // Create File document first
        const newFile = await File.create({
            originalName: file.originalname,
            folderId,
            uploadedBy: req.user._id,
        });

        // Create FileVersion
        const newVersion = await FileVersion.create({
            fileId: newFile._id,
            versionNumber: 1,
            originalName: file.originalname,
            storedName: `${timestamp}-${safeFileName}`,
            mimeType: file.mimetype,
            size: file.size,
            storageKey,
            storageUrl: process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${storageKey}` : "",
            uploadedBy: req.user._id,
            commitMessage,
        });

        // Link version to file
        newFile.currentVersionId = newVersion._id;
        newFile.latestVersionNumber = 1;
        await newFile.save();

        await logActivity({
            userId: req.user._id,
            action: "file_uploaded",
            targetType: "file",
            targetId: newFile._id,
            fileId: newFile._id,
            folderId: newFile.folderId,
            message: `${req.user.name} uploaded file ${newFile.originalName}`,
            metadata: { size: file.size },
            req
        });

        const fileDetails = await getFileDetailsResponse(newFile._id);

        res.status(201).json({
            success: true,
            message: "File uploaded successfully",
            data: fileDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "File upload failed",
            error: error.message,
        });
    }
};

// @desc Upload a new version of an existing file
// @route POST /api/files/:id/new-version
const uploadNewVersion = async (req, res) => {
    try {
        const { commitMessage } = req.body;
        const uploadedFile = req.file;
        const fileId = req.params.id;

        if (!uploadedFile) {
            return res.status(400).json({ success: false, message: "No file provided" });
        }
        if (!commitMessage || commitMessage.trim() === "") {
            return res.status(400).json({ success: false, message: "Commit message is required" });
        }

        const file = await File.findOne({ _id: fileId, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found or deleted" });
        }

        const metrics = await getStorageMetrics();

        if (metrics.usedBytes + uploadedFile.size > metrics.limitBytes) {
            return res.status(403).json({
                success: false,
                message: "Storage limit exceeded. Upload blocked.",
                storage: {
                    usedBytes: metrics.usedBytes,
                    limitBytes: metrics.limitBytes,
                    remainingBytes: metrics.remainingBytes
                }
            });
        }

        const safeFileName = sanitizeFileName(uploadedFile.originalname);
        const timestamp = Date.now();
        const storageKey = `folders/${file.folderId}/${timestamp}-${safeFileName}`;

        const putCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: storageKey,
            Body: uploadedFile.buffer,
            ContentType: uploadedFile.mimetype,
        });

        await r2.send(putCommand);

        const newVersionNumber = file.latestVersionNumber + 1;

        const newVersion = await FileVersion.create({
            fileId: file._id,
            versionNumber: newVersionNumber,
            originalName: uploadedFile.originalname,
            storedName: `${timestamp}-${safeFileName}`,
            mimeType: uploadedFile.mimetype,
            size: uploadedFile.size,
            storageKey,
            storageUrl: process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${storageKey}` : "",
            uploadedBy: req.user._id,
            commitMessage,
        });

        file.currentVersionId = newVersion._id;
        file.latestVersionNumber = newVersionNumber;
        await file.save();

        await logActivity({
            userId: req.user._id,
            action: "file_updated",
            targetType: "version",
            targetId: newVersion._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} uploaded version ${newVersionNumber} for ${file.originalName}`,
            metadata: { size: uploadedFile.size },
            req
        });

        const fileDetails = await getFileDetailsResponse(file._id);

        res.status(201).json({
            success: true,
            message: "New version uploaded successfully",
            data: fileDetails,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to upload new version",
            error: error.message,
        });
    }
};

// @desc Get all versions of a file
// @route GET /api/files/:id/versions
const getVersions = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const versions = await FileVersion.find({ fileId: file._id })
            .populate("uploadedBy", "name email")
            .sort({ versionNumber: -1 });

        const versionsWithMeta = versions.map(v => {
            const typeInfo = getFileTypeInfo(v.originalName, v.mimeType);
            return {
                ...v.toObject(),
                ...typeInfo
            };
        });

        res.json({
            success: true,
            versions: versionsWithMeta,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch versions",
            error: error.message,
        });
    }
};

// @desc Get files
// @route GET /api/files
const getFiles = async (req, res) => {
    try {
        const { folderId } = req.query;
        const query = { isDeleted: false };
        
        if (folderId) {
            query.folderId = folderId;
        }

        if (req.user && req.user.role !== "superadmin") {
            const permissions = await Permission.find({
                userId: req.user._id,
                isActive: true
            });
            const allowedFolderIds = permissions.map(p => p.folderId);
            
            if (folderId) {
                if (!allowedFolderIds.some(id => id.toString() === folderId.toString())) {
                    return res.status(403).json({ success: false, message: "Access denied to this folder" });
                }
            } else {
                query.folderId = { $in: allowedFolderIds };
            }
        }

        const files = await File.find(query).populate("currentVersionId").sort({ createdAt: -1 });

        const filesWithMeta = files.map(f => {
            const cv = f.currentVersionId;
            const typeInfo = getFileTypeInfo(
                cv ? cv.originalName : f.originalName,
                cv ? cv.mimeType : ""
            );
            return {
                ...f.toObject(),
                ...typeInfo
            };
        });

        res.json({
            success: true,
            count: files.length,
            files: filesWithMeta,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch files",
            error: error.message,
        });
    }
};

// @desc Get file by ID
// @route GET /api/files/:id
const getFileById = async (req, res) => {
    try {
        const fileData = await getFileDetailsResponse(req.params.id);

        if (!fileData) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        res.json({
            success: true,
            data: fileData,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch file",
            error: error.message,
        });
    }
};

// @desc Get preview info and URL
// @route GET /api/files/:id/preview
const previewFile = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, isDeleted: false }).populate("currentVersionId");

        if (!file || !file.currentVersionId) {
            return res.status(404).json({ success: false, message: "File or current version not found" });
        }

        const currentVersion = file.currentVersionId;
        const typeInfo = getFileTypeInfo(currentVersion.originalName, currentVersion.mimeType);

        let previewUrl = null;
        
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: currentVersion.storageKey,
            ResponseContentDisposition: `inline; filename="${currentVersion.originalName}"`
        });

        previewUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

        res.json({
            success: true,
            data: {
                fileId: file._id,
                fileName: currentVersion.originalName,
                mimeType: currentVersion.mimeType,
                size: currentVersion.size,
                ...typeInfo,
                previewUrl
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to generate preview",
            error: error.message,
        });
    }
};

// @desc Download current file (Get signed URL)
// @route GET /api/files/:id/download
const downloadFile = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, isDeleted: false }).populate("currentVersionId");

        if (!file || !file.currentVersionId) {
            return res.status(404).json({ success: false, message: "File or current version not found" });
        }

        const currentVersion = file.currentVersionId;

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: currentVersion.storageKey,
            ResponseContentDisposition: `attachment; filename="${currentVersion.originalName}"`
        });

        const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

        await logActivity({
            userId: req.user._id,
            action: "file_downloaded",
            targetType: "file",
            targetId: file._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} downloaded file ${file.originalName}`,
            req
        });

        res.json({
            success: true,
            downloadUrl: signedUrl,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to generate download URL",
            error: error.message,
        });
    }
};

// @desc Download specific old version
// @route GET /api/files/:id/versions/:versionId/download
const downloadVersion = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const version = await FileVersion.findOne({ _id: req.params.versionId, fileId: file._id });
        if (!version) {
            return res.status(404).json({ success: false, message: "Version not found" });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: version.storageKey,
            ResponseContentDisposition: `attachment; filename="${version.originalName}"`
        });

        const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

        await logActivity({
            userId: req.user._id,
            action: "file_downloaded",
            targetType: "version",
            targetId: version._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} downloaded version ${version.versionNumber} of ${file.originalName}`,
            req
        });

        res.json({
            success: true,
            downloadUrl: signedUrl,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to generate download URL",
            error: error.message,
        });
    }
};

// @desc Restore specific version
// @route POST /api/files/:id/restore/:versionId
const restoreVersion = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const version = await FileVersion.findOne({ _id: req.params.versionId, fileId: file._id });
        if (!version) {
            return res.status(404).json({ success: false, message: "Version not found" });
        }

        file.currentVersionId = version._id;
        await file.save();

        await logActivity({
            userId: req.user._id,
            action: "version_restored",
            targetType: "version",
            targetId: version._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} restored version ${version.versionNumber} for ${file.originalName}`,
            req
        });

        const fileDetails = await getFileDetailsResponse(file._id);

        res.json({
            success: true,
            message: "Version restored successfully",
            data: fileDetails,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to restore version",
            error: error.message,
        });
    }
};

// @desc Soft delete file
// @route DELETE /api/files/:id
const deleteFile = async (req, res) => {
    try {
        const { confirm, reason } = req.body;
        
        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                message: "Delete confirmation required."
            });
        }

        const file = await File.findOne({ _id: req.params.id, isDeleted: false });

        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        // Soft delete the metadata
        file.isDeleted = true;
        file.deletedAt = new Date();
        file.deletedBy = req.user._id;
        file.deleteReason = reason || null;
        await file.save();

        await logActivity({
            userId: req.user._id,
            action: "file_deleted",
            targetType: "file",
            targetId: file._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} deleted file ${file.originalName}`,
            metadata: { reason, deletedAt: file.deletedAt },
            req
        });

        res.json({
            success: true,
            message: "File deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "File deletion failed",
            error: error.message,
        });
    }
};

// @desc Restore deleted file
// @route POST /api/files/:id/restore-deleted
const restoreDeletedFile = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, isDeleted: true });

        if (!file) {
            return res.status(404).json({ success: false, message: "Deleted file not found" });
        }

        if (!isWithinRetentionWindow(file.deletedAt)) {
            return res.status(400).json({ success: false, message: "Restore window expired." });
        }

        file.isDeleted = false;
        file.deletedAt = null;
        file.deletedBy = null;
        file.deleteReason = null;
        file.restoredAt = new Date();
        file.restoredBy = req.user._id;
        await file.save();

        await logActivity({
            userId: req.user._id,
            action: "file_restored",
            targetType: "file",
            targetId: file._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} restored file ${file.originalName}`,
            metadata: { restoredAt: file.restoredAt },
            req
        });

        res.json({
            success: true,
            message: "File restored successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "File restore failed",
            error: error.message,
        });
    }
};

module.exports = {
    uploadFile,
    uploadNewVersion,
    getVersions,
    getFiles,
    getFileById,
    previewFile,
    downloadFile,
    downloadVersion,
    restoreVersion,
    deleteFile,
    restoreDeletedFile,
};
