const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        // We set a reasonable single file limit, overall limit checked in controller
        fileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES) || 100 * 1024 * 1024, // Default 100MB
    },
});

module.exports = upload;
