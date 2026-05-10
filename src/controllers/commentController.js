const Comment = require("../models/Comment");
const File = require("../models/File");
const Permission = require("../models/Permission");
const { logActivity } = require("../services/activityService");

// @desc Add a comment to a file
// @route POST /api/files/:id/comments
const addComment = async (req, res) => {
    try {
        const { comment } = req.body;
        const fileId = req.params.id;

        if (!comment || comment.trim() === "") {
            return res.status(400).json({ success: false, message: "Comment text is required" });
        }

        const file = await File.findOne({ _id: fileId, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const newComment = await Comment.create({
            fileId,
            userId: req.user._id,
            comment,
        });

        await logActivity({
            userId: req.user._id,
            action: "comment_added",
            targetType: "comment",
            targetId: newComment._id,
            fileId: file._id,
            folderId: file.folderId,
            message: `${req.user.name} commented on ${file.originalName}`,
            req
        });

        // Fetch populated comment
        const populatedComment = await Comment.findById(newComment._id).populate("userId", "name email role");

        res.status(201).json({
            success: true,
            message: "Comment added successfully",
            comment: populatedComment,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to add comment",
            error: error.message,
        });
    }
};

// @desc Get all comments for a file
// @route GET /api/files/:id/comments
const getFileComments = async (req, res) => {
    try {
        const fileId = req.params.id;

        const file = await File.findOne({ _id: fileId, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const comments = await Comment.find({ fileId, isDeleted: false })
            .populate("userId", "name email role")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: comments.length,
            comments,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch comments",
            error: error.message,
        });
    }
};

// @desc Delete a comment
// @route DELETE /api/files/:id/comments/:commentId
const deleteComment = async (req, res) => {
    try {
        const { id: fileId, commentId } = req.params;

        const file = await File.findOne({ _id: fileId, isDeleted: false });
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const comment = await Comment.findOne({ _id: commentId, fileId, isDeleted: false });
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        let hasPermission = false;

        // 1. Owner of comment
        if (comment.userId.toString() === req.user._id.toString()) {
            hasPermission = true;
        }
        // 2. Superadmin
        else if (req.user.role === "superadmin") {
            hasPermission = true;
        }
        // 3. Folder Admin
        else {
            const folderPermission = await Permission.findOne({
                folderId: file.folderId,
                userId: req.user._id,
                isActive: true,
            });
            if (folderPermission && folderPermission.access === "admin") {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            return res.status(403).json({ success: false, message: "Access denied. You cannot delete this comment." });
        }

        comment.isDeleted = true;
        comment.deletedAt = new Date();
        await comment.save();

        res.json({
            success: true,
            message: "Comment deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete comment",
            error: error.message,
        });
    }
};

module.exports = {
    addComment,
    getFileComments,
    deleteComment,
};
