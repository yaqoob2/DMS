const express = require("express");
const {
    getDeletedFiles,
    getDeletedFolders,
    permanentlyDeleteAllFolders,
    permanentlyDeleteAllFiles,
    getBackupGuidance,
} = require("../controllers/safetyController");
const { permanentlyDeleteFolder } = require("../controllers/folderController");
const { permanentlyDeleteFile } = require("../controllers/fileController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const safetyRoles = authorizeRoles("superadmin", "owner");

/**
 * @swagger
 * tags:
 *   name: Safety
 *   description: Backup, retention, and soft delete recovery APIs (Superadmin only)
 */

router.get("/deleted-files", protect, safetyRoles, getDeletedFiles);
router.get("/deleted-folders", protect, safetyRoles, getDeletedFolders);

router.post(
    "/deleted-files/permanent-delete-all",
    protect,
    safetyRoles,
    permanentlyDeleteAllFiles
);

router.post(
    "/deleted-folders/permanent-delete-all",
    protect,
    safetyRoles,
    permanentlyDeleteAllFolders
);

router.post(
    "/deleted-folders/:id/permanent-delete",
    protect,
    safetyRoles,
    permanentlyDeleteFolder
);

router.delete(
    "/deleted-folders/:id",
    protect,
    safetyRoles,
    (req, res) => {
        req.body = { ...(req.body || {}), confirm: true };
        return permanentlyDeleteFolder(req, res);
    }
);

router.post(
    "/deleted-files/:id/permanent-delete",
    protect,
    safetyRoles,
    permanentlyDeleteFile
);

router.delete(
    "/deleted-files/:id",
    protect,
    safetyRoles,
    (req, res) => {
        req.body = { ...(req.body || {}), confirm: true };
        return permanentlyDeleteFile(req, res);
    }
);

router.get("/backup-guidance", protect, authorizeRoles("superadmin"), getBackupGuidance);

module.exports = router;
