const mongoose = require("mongoose");

const repairFolderDeleteFlags = async (Folder) => {
    await Folder.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } }
    );

    await Folder.updateMany(
        {
            deletedAt: { $ne: null },
            isDeleted: { $ne: true },
        },
        { $set: { isDeleted: true } }
    );
};

const syncFolderIndexes = async () => {
    const Folder = require("../models/Folder");
    const collection = Folder.collection;
    const indexes = await collection.indexes();

    for (const index of indexes) {
        const isNameParentIndex =
            index.name !== "_id_" &&
            index.key?.name === 1 &&
            index.key?.parentFolderId === 1;

        if (isNameParentIndex) {
            try {
                await collection.dropIndex(index.name);
                console.log(`Dropped folder name index: ${index.name}`);
            } catch (error) {
                console.warn(
                    `Could not drop folder index ${index.name}:`,
                    error.message
                );
            }
        }
    }

    await repairFolderDeleteFlags(Folder);
    await Folder.syncIndexes();
    console.log("Folder indexes synced");
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB connected successfully");
        await syncFolderIndexes();
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
