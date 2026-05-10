const express = require("express");
const {
    getDeletedFiles,
    getDeletedFolders,
    getBackupGuidance
} = require("../controllers/safetyController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Safety
 *   description: Backup, retention, and soft delete recovery APIs (Superadmin only)
 */

/**
 * @swagger
 * /api/safety/deleted-files:
 *   get:
 *     summary: View deleted files
 *     description: Retrieve all files currently soft-deleted and within the 30-day retention window. Requires superadmin role.
 *     tags: [Safety]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted files fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/deleted-files", protect, authorizeRoles("superadmin"), getDeletedFiles);

/**
 * @swagger
 * /api/safety/deleted-folders:
 *   get:
 *     summary: View deleted folders
 *     description: Retrieve all folders currently soft-deleted and within the 30-day retention window. Requires superadmin role.
 *     tags: [Safety]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted folders fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/deleted-folders", protect, authorizeRoles("superadmin"), getDeletedFolders);

/**
 * @swagger
 * /api/safety/backup-guidance:
 *   get:
 *     summary: View backup guidance
 *     description: Retrieve database and R2 storage backup guidance protocols. Requires superadmin role.
 *     tags: [Safety]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup guidance fetched
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 */
router.get("/backup-guidance", protect, authorizeRoles("superadmin"), getBackupGuidance);

module.exports = router;
