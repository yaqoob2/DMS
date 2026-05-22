const buildParentFolderQuery = (parentFolderId) => {
    if (parentFolderId) {
        return { parentFolderId };
    }

    return {
        $or: [{ parentFolderId: null }, { parentFolderId: { $exists: false } }],
    };
};

module.exports = { buildParentFolderQuery };
