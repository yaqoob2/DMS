const express = require("express");
const {
    getStorageSummary,
    getLargestFiles,
    getMonthlyActivity
} = require("../controllers/storageController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Storage
 *   description: System storage and monitoring (Admin only)
 */

/**
 * @swagger
 * /api/storage/summary:
 *   get:
 *     summary: Get storage summary
 *     description: Retrieve total used storage, limits, and status. Requires superadmin role.
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storage summary fetched
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/summary", protect, authorizeRoles("superadmin"), getStorageSummary);

/**
 * @swagger
 * /api/storage/largest-files:
 *   get:
 *     summary: Get largest files
 *     description: Retrieve the largest file versions consuming storage. Requires superadmin role.
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of files to return
 *     responses:
 *       200:
 *         description: Largest files fetched
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/largest-files", protect, authorizeRoles("superadmin"), getLargestFiles);

/**
 * @swagger
 * /api/storage/monthly-activity:
 *   get:
 *     summary: Get monthly activity
 *     description: Retrieve monthly upload/download counts and bytes. Requires superadmin role.
 *     tags: [Storage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly activity fetched
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/monthly-activity", protect, authorizeRoles("superadmin"), getMonthlyActivity);

module.exports = router;
