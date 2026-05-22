const File = require("../models/File");
const FileVersion = require("../models/FileVersion");
const Folder = require("../models/Folder");
const Comment = require("../models/Comment");
const Permission = require("../models/Permission");
const { userCanManageFolderPermissions } = require("../middlewares/permissionMiddleware");
const { isWithinRetentionWindow } = require("../utils/retentionHelper");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sameUserId = (a, b) => Boolean(a && b && a.toString() === b.toString());

const userCanPermanentlyDeleteFile = async (user, file) => {
    if (user.role === "superadmin") {
        return true;
    }

    if (sameUserId(file.uploadedBy, user._id)) {
        return true;
    }

    const folder = await Folder.findById(file.folderId);

    if (!folder) {
        return false;
    }

    return userCanManageFolderPermissions(user, folder);
};

const removeDeletedFolderTree = async (folder) => {
    const folderScopeOr = [{ _id: folder._id }];

    if (folder.path) {
        folderScopeOr.push({
            path: { $regex: `^${escapeRegex(folder.path)}/` },
            isDeleted: true,
        });
    }

    const foldersToRemove = await Folder.find({
        isDeleted: true,
        $or: folderScopeOr,
    }).select("_id");

    const folderIds = foldersToRemove.map((item) => item._id);

    const filesToRemove = await File.find({
        folderId: { $in: folderIds },
    }).select("_id");

    const fileIds = filesToRemove.map((item) => item._id);

    if (fileIds.length > 0) {
        await Comment.deleteMany({ fileId: { $in: fileIds } });
        await FileVersion.deleteMany({ fileId: { $in: fileIds } });
        await File.deleteMany({ _id: { $in: fileIds } });
    }

    await Permission.deleteMany({ folderId: { $in: folderIds } });
    await Folder.deleteMany({ _id: { $in: folderIds } });

    return {
        removedFolderCount: foldersToRemove.length,
        removedFileCount: fileIds.length,
    };
};

const removeDeletedFileRecord = async (file) => {
    await Comment.deleteMany({ fileId: file._id });
    await FileVersion.deleteMany({ fileId: file._id });
    await File.deleteOne({ _id: file._id });

    return { removedFileCount: 1 };
};

const getRootDeletedFolders = (folders) => {
    return folders.filter(
        (folder) =>
            !folders.some(
                (other) =>
                    other._id.toString() !== folder._id.toString() &&
                    folder.path &&
                    other.path &&
                    folder.path.startsWith(`${other.path}/`)
            )
    );
};

const buildDeletedFolderContext = (deletedFolders) => {
    const deletedIdSet = new Set(
        deletedFolders.map((folder) => folder._id.toString())
    );
    const deletedPaths = deletedFolders
        .map((folder) => folder.path)
        .filter(Boolean);

    return { deletedIdSet, deletedPaths };
};

const filterActiveFoldersExcludingDeletedTrees = (activeFolders, deletedFolders) => {
    const { deletedIdSet, deletedPaths } = buildDeletedFolderContext(deletedFolders);
    const activeById = new Map(
        activeFolders.map((folder) => [folder._id.toString(), folder])
    );

    return activeFolders.filter((folder) => {
        if (
            deletedPaths.some(
                (deletedPath) =>
                    folder.path === deletedPath ||
                    (folder.path && folder.path.startsWith(`${deletedPath}/`))
            )
        ) {
            return false;
        }

        let parentId = folder.parentFolderId;
        const visited = new Set();

        while (parentId) {
            const parentKey = parentId.toString();

            if (visited.has(parentKey)) {
                break;
            }

            visited.add(parentKey);

            if (deletedIdSet.has(parentKey)) {
                return false;
            }

            const parentFolder = activeById.get(parentKey);
            parentId = parentFolder?.parentFolderId;
        }

        return true;
    });
};

const permanentlyDeleteAllDeletedFolders = async (user) => {
    const deletedFolders = await Folder.find({ isDeleted: true }).sort({
        path: -1,
    });

    const eligible = [];

    for (const folder of deletedFolders) {
        if (!isWithinRetentionWindow(folder.deletedAt)) {
            continue;
        }

        if (!(await userCanManageFolderPermissions(user, folder))) {
            continue;
        }

        eligible.push(folder);
    }

    const roots = getRootDeletedFolders(eligible);

    let removedFolderCount = 0;
    let removedFileCount = 0;
    let skippedCount = deletedFolders.length - eligible.length;

    for (const folder of roots) {
        const stillExists = await Folder.findOne({
            _id: folder._id,
            isDeleted: true,
        });

        if (!stillExists) {
            continue;
        }

        const result = await removeDeletedFolderTree(stillExists);
        removedFolderCount += result.removedFolderCount;
        removedFileCount += result.removedFileCount;
    }

    return {
        removedFolderCount,
        removedFileCount,
        skippedCount,
        processedRootCount: roots.length,
    };
};

const permanentlyDeleteAllDeletedFiles = async (user) => {
    const deletedFiles = await File.find({ isDeleted: true }).sort({
        deletedAt: -1,
    });

    let removedFileCount = 0;
    let skippedCount = 0;

    for (const file of deletedFiles) {
        if (!isWithinRetentionWindow(file.deletedAt)) {
            skippedCount += 1;
            continue;
        }

        if (!(await userCanPermanentlyDeleteFile(user, file))) {
            skippedCount += 1;
            continue;
        }

        const stillExists = await File.findOne({
            _id: file._id,
            isDeleted: true,
        });

        if (!stillExists) {
            continue;
        }

        await removeDeletedFileRecord(stillExists);
        removedFileCount += 1;
    }

    return {
        removedFileCount,
        skippedCount,
        processedCount: removedFileCount,
    };
};

module.exports = {
    userCanPermanentlyDeleteFile,
    removeDeletedFolderTree,
    removeDeletedFileRecord,
    getRootDeletedFolders,
    filterActiveFoldersExcludingDeletedTrees,
    permanentlyDeleteAllDeletedFolders,
    permanentlyDeleteAllDeletedFiles,
};
