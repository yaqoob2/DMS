const express = require("express");
const { search } = require("../controllers/searchController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Global search APIs
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search files and folders
 *     description: Searches files by name, commit message, or uploader. Searches folders by name or path. Automatically filters by user permissions.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, files, folders]
 *         description: Filter search results by type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Search results returned successfully
 *       400:
 *         description: Search query is required
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, search);

module.exports = router;
