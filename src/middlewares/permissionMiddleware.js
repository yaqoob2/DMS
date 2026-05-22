const File = require("../models/File");
const Folder = require("../models/Folder");
const Permission = require("../models/Permission");

const ACCESS_LEVELS = {
    view: 1,
    edit: 2,
    admin: 3,
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sameUserId = (a, b) => Boolean(a && b && a.toString() === b.toString());

const userCanManageFolderPermissions = async (user, folder) => {
    if (!user || !folder) {
        return false;
    }

    if (user.role === "superadmin") {
        return true;
    }

    if (sameUserId(folder.createdBy, user._id)) {
        return true;
    }

    const directAdmin = await Permission.findOne({
        folderId: folder._id,
        userId: user._id,
        access: "admin",
        isActive: true,
    });

    if (directAdmin) {
        return true;
    }

    const highestAccess = await getHighestAccessLevel(user._id, folder._id);
    return highestAccess >= ACCESS_LEVELS.admin;
};

const getFolderAndAncestorIds = async (folderId) => {
    const ids = [];
    let currentFolder = await Folder.findById(folderId);

    while (currentFolder) {
        ids.push(currentFolder._id);

        if (!currentFolder.parentFolderId) break;

        currentFolder = await Folder.findById(currentFolder.parentFolderId);
    }

    return ids;
};

const getHighestAccessLevel = async (userId, folderId) => {
    const folder = await Folder.findById(folderId);

    if (!folder) {
        return 0;
    }

    if (sameUserId(folder.createdBy, userId)) {
        return ACCESS_LEVELS.admin;
    }

    const permissions = await Permission.find({
        userId,
        isActive: true,
    });

    if (!permissions.length) {
        return 0;
    }

    const permittedFolders = await Folder.find({
        _id: { $in: permissions.map((p) => p.folderId) },
    }).select("_id path");

    const permittedFolderMap = new Map(
        permittedFolders.map((f) => [f._id.toString(), f])
    );

    let maxLevel = 0;

    for (const permission of permissions) {
        const level = ACCESS_LEVELS[permission.access] || 0;
        const permittedFolder = permittedFolderMap.get(permission.folderId.toString());

        if (!permittedFolder) {
            continue;
        }

        if (permittedFolder._id.toString() === folder._id.toString()) {
            maxLevel = Math.max(maxLevel, level);
            continue;
        }

        if (
            folder.path &&
            permittedFolder.path &&
            folder.path.startsWith(`${permittedFolder.path}/`)
        ) {
            maxLevel = Math.max(maxLevel, level);
        }
    }

    const folderAndAncestorIds = await getFolderAndAncestorIds(folderId);

    const ancestorPermissions = await Permission.find({
        folderId: { $in: folderAndAncestorIds },
        userId,
        isActive: true,
    });

    for (const permission of ancestorPermissions) {
        maxLevel = Math.max(maxLevel, ACCESS_LEVELS[permission.access] || 0);
    }

    return maxLevel;
};

const getAccessibleFolderIds = async (userId) => {
    const permissions = await Permission.find({
        userId,
        isActive: true,
    });

    const directlyAllowedFolderIds = permissions.map((p) => p.folderId);

    const directlyAllowedFolders = await Folder.find({
        _id: { $in: directlyAllowedFolderIds },
        isDeleted: false,
    }).select("_id path");

    const ownedFolders = await Folder.find({
        createdBy: userId,
        isDeleted: false,
    }).select("_id path");

    const seen = new Set();
    const roots = [];

    for (const folder of [...directlyAllowedFolders, ...ownedFolders]) {
        const key = folder._id.toString();

        if (!seen.has(key)) {
            seen.add(key);
            roots.push(folder);
        }
    }

    if (!roots.length) {
        return [];
    }

    const orConditions = roots.flatMap((folder) => [
        { _id: folder._id },
        { path: { $regex: `^${escapeRegex(folder.path)}/` } },
    ]);

    const accessibleFolders = await Folder.find({
        isDeleted: false,
        $or: orConditions,
    }).select("_id");

    return accessibleFolders.map((folder) => folder._id);
};

const isFolderAccessible = async (userId, folderId) => {
    const folder = await Folder.findOne({
        _id: folderId,
        isDeleted: false,
    });

    if (!folder) {
        return false;
    }

    if (sameUserId(folder.createdBy, userId)) {
        return true;
    }

    const permissions = await Permission.find({
        userId,
        isActive: true,
    });

    const permittedRoots = await Folder.find({
        _id: { $in: permissions.map((p) => p.folderId) },
        isDeleted: false,
    }).select("path");

    return permittedRoots.some(
        (root) =>
            folder._id.toString() === root._id.toString() ||
            (folder.path &&
                root.path &&
                (folder.path === root.path ||
                    folder.path.startsWith(`${root.path}/`)))
    );
};

const resolveFolderIdFromRequest = async (req) => {
    if (req.baseUrl.includes("/api/files")) {
        if (req.params.id) {
            const file = await File.findById(req.params.id);
            return file ? file.folderId : null;
        }

        return req.body.folderId || null;
    }

    if (req.baseUrl.includes("/api/folders") || req.originalUrl.includes("/api/folders")) {
        return req.params.folderId || req.params.id || req.body.folderId || null;
    }

    if (req.baseUrl.includes("/api/permissions") || req.originalUrl.includes("/api/permissions")) {
        if (req.body.folderId) {
            return req.body.folderId;
        }

        if (req.params.id) {
            const targetPermission = await Permission.findById(req.params.id);
            return targetPermission ? targetPermission.folderId : null;
        }
    }

    return null;
};

const requireFolderPermission = (requiredAccess) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }

            const folderId = await resolveFolderIdFromRequest(req);

            if (req.baseUrl.includes("/api/files") && req.params.id && !folderId) {
                return res.status(404).json({
                    success: false,
                    message: "File not found",
                });
            }

            if (
                (req.baseUrl.includes("/api/permissions") ||
                    req.originalUrl.includes("/api/permissions")) &&
                req.params.id &&
                !folderId
            ) {
                return res.status(404).json({
                    success: false,
                    message: "Permission not found",
                });
            }

            if (!folderId) {
                return res.status(400).json({
                    success: false,
                    message: "Target folder could not be determined for access check",
                });
            }

            const folder = await Folder.findById(folderId);

            if (!folder) {
                return res.status(404).json({
                    success: false,
                    message: "Folder not found",
                });
            }

            if (sameUserId(folder.createdBy, req.user._id)) {
                return next();
            }

            if (req.user.role === "superadmin") {
                return next();
            }

            const highestUserLevel = await getHighestAccessLevel(req.user._id, folderId);
            const requiredLevel = ACCESS_LEVELS[requiredAccess];

            if (!requiredLevel) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid permission access level",
                });
            }

            if (highestUserLevel === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. No permission granted for this folder or parent folder.",
                });
            }

            if (highestUserLevel >= requiredLevel) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Access denied. Requires ${requiredAccess} permission.`,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Permission verification failed",
                error: error.message,
            });
        }
    };
};

module.exports = {
    requireFolderPermission,
    getFolderAndAncestorIds,
    getHighestAccessLevel,
    getAccessibleFolderIds,
    isFolderAccessible,
    userCanManageFolderPermissions,
    ACCESS_LEVELS,
};
