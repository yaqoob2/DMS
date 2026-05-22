const express = require("express");
const {
    grantFolderPermission,
    updateFolderPermission,
    removeFolderPermission,
} = require("../controllers/permissionController");
const { protect } = require("../middlewares/authMiddleware");
const { requireFolderPermission } = require("../middlewares/permissionMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Folder permission management APIs
 */

/**
 * @swagger
 * /api/permissions:
 *   post:
 *     summary: Grant folder permission to a user
 *     description: Only superadmin or users with admin access can grant permissions.
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - folderId
 *               - userId
 *               - access
 *             properties:
 *               folderId:
 *                 type: string
 *               userId:
 *                 type: string
 *               access:
 *                 type: string
 *                 enum: [view, edit, admin]
 *     responses:
 *       201:
 *         description: Permission granted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.post("/", protect, requireFolderPermission("admin"), grantFolderPermission);

/**
 * @swagger
 * /api/permissions/{id}:
 *   patch:
 *     summary: Update an existing permission
 *     description: Modify the access level of a granted permission. Requires admin access to the associated folder.
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - access
 *             properties:
 *               access:
 *                 type: string
 *                 enum: [view, edit, admin]
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Server error
 */
router.patch("/:id", protect, updateFolderPermission);

/**
 * @swagger
 * /api/permissions/{id}:
 *   delete:
 *     summary: Remove a folder permission
 *     description: Soft deletes the permission. Requires admin access to the associated folder.
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission removed successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", protect, removeFolderPermission);

module.exports = router;
