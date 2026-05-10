const Permission = require("../models/Permission");
const Folder = require("../models/Folder");
const { logActivity } = require("../services/activityService");

// @desc Grant folder permission to a user
// @route POST /api/permissions
const grantFolderPermission = async (req, res) => {
    try {
        const { folderId, userId, access } = req.body;

        if (!folderId || !userId || !access) {
            return res.status(400).json({ success: false, message: "Folder ID, User ID, and Access level are required" });
        }

        if (!["view", "edit", "admin"].includes(access)) {
            return res.status(400).json({ success: false, message: "Invalid access level" });
        }

        const folder = await Folder.findOne({ _id: folderId, isDeleted: false });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        // Check if permission already exists
        let permission = await Permission.findOne({ folderId, userId });

        if (permission) {
            permission.access = access;
            permission.isActive = true;
            permission.grantedBy = req.user._id;
            await permission.save();
        } else {
            permission = await Permission.create({
                folderId,
                userId,
                access,
                grantedBy: req.user._id,
            });
        }

        await logActivity({
            userId: req.user._id,
            action: "permission_changed",
            targetType: "permission",
            targetId: permission._id,
            folderId: permission.folderId,
            message: `${req.user.name} granted ${access} access to user ID ${userId}`,
            req
        });

        res.status(201).json({
            success: true,
            message: "Permission granted successfully",
            permission,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to grant permission",
            error: error.message,
        });
    }
};

// @desc Get all permissions for a folder
// @route GET /api/folders/:folderId/permissions
const getFolderPermissions = async (req, res) => {
    try {
        const { folderId } = req.params;

        const folder = await Folder.findOne({ _id: folderId, isDeleted: false });
        if (!folder) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        const permissions = await Permission.find({ folderId, isActive: true })
            .populate("userId", "name email role")
            .populate("grantedBy", "name email");

        res.json({
            success: true,
            count: permissions.length,
            permissions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch permissions",
            error: error.message,
        });
    }
};

// @desc Update an existing permission
// @route PATCH /api/permissions/:id
const updateFolderPermission = async (req, res) => {
    try {
        const { access } = req.body;

        if (!["view", "edit", "admin"].includes(access)) {
            return res.status(400).json({ success: false, message: "Invalid access level" });
        }

        const permission = await Permission.findOne({ _id: req.params.id, isActive: true });
        if (!permission) {
            return res.status(404).json({ success: false, message: "Permission not found" });
        }

        permission.access = access;
        await permission.save();

        await logActivity({
            userId: req.user._id,
            action: "permission_changed",
            targetType: "permission",
            targetId: permission._id,
            folderId: permission.folderId,
            message: `${req.user.name} updated permission to ${access} for user ID ${permission.userId}`,
            req
        });

        res.json({
            success: true,
            message: "Permission updated successfully",
            permission,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update permission",
            error: error.message,
        });
    }
};

// @desc Remove folder permission (soft delete)
// @route DELETE /api/permissions/:id
const removeFolderPermission = async (req, res) => {
    try {
        const permission = await Permission.findOne({ _id: req.params.id, isActive: true });
        
        if (!permission) {
            return res.status(404).json({ success: false, message: "Permission not found" });
        }

        permission.isActive = false;
        await permission.save();

        await logActivity({
            userId: req.user._id,
            action: "permission_changed",
            targetType: "permission",
            targetId: permission._id,
            folderId: permission.folderId,
            message: `${req.user.name} removed permission for user ID ${permission.userId}`,
            req
        });

        res.json({
            success: true,
            message: "Permission removed successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to remove permission",
            error: error.message,
        });
    }
};

module.exports = {
    grantFolderPermission,
    getFolderPermissions,
    updateFolderPermission,
    removeFolderPermission,
};
