const express = require("express");
const { getActivityLogs } = require("../controllers/activityController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: System activity logs
 */

/**
 * @swagger
 * /api/activity:
 *   get:
 *     summary: Get all activity logs
 *     description: Retrieve all system activity. Normal users see only logs for folders they have active access to.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Activity logs fetched successfully
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, getActivityLogs);

module.exports = router;
