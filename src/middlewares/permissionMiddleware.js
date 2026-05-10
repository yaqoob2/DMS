const File = require("../models/File");
const Permission = require("../models/Permission");

const ACCESS_LEVELS = {
    view: 1,
    edit: 2,
    admin: 3
};

const requireFolderPermission = (requiredAccess) => {
    return async (req, res, next) => {
        try {
            // Superadmin bypasses all checks
            if (req.user && req.user.role === "superadmin") {
                return next();
            }

            let folderId = null;

            // Determine folderId based on the incoming route context
            if (req.baseUrl.includes("/api/files")) {
                if (req.params.id) {
                    // Find file regardless of deleted state (needed for restore-deleted)
                    const file = await File.findById(req.params.id);
                    if (!file) return res.status(404).json({ success: false, message: "File not found" });
                    folderId = file.folderId;
                } else if (req.body.folderId) {
                    folderId = req.body.folderId;
                }
            } else if (req.baseUrl.includes("/api/folders")) {
                if (req.params.folderId) {
                    folderId = req.params.folderId;
                } else if (req.params.id) {
                    folderId = req.params.id; 
                } else if (req.body.folderId) {
                    folderId = req.body.folderId;
                }
            } else if (req.baseUrl.includes("/api/permissions")) {
                if (req.body.folderId) {
                    folderId = req.body.folderId;
                } else if (req.params.id) {
                    // For PATCH/DELETE permission, we need to check the folder associated with the permission
                    const targetPermission = await Permission.findById(req.params.id);
                    if (!targetPermission) return res.status(404).json({ success: false, message: "Permission not found" });
                    folderId = targetPermission.folderId;
                }
            }

            if (!folderId) {
                return res.status(400).json({ success: false, message: "Target folder could not be determined for access check" });
            }

            const permission = await Permission.findOne({
                folderId,
                userId: req.user._id,
                isActive: true
            });

            if (!permission) {
                return res.status(403).json({ success: false, message: "Access denied. No permission granted for this folder." });
            }

            const userLevel = ACCESS_LEVELS[permission.access];
            const requiredLevel = ACCESS_LEVELS[requiredAccess];

            if (userLevel >= requiredLevel) {
                return next();
            } else {
                return res.status(403).json({ success: false, message: `Access denied. Requires ${requiredAccess} permission.` });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: "Permission verification failed", error: error.message });
        }
    };
};

module.exports = { requireFolderPermission };
