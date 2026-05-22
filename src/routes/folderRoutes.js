const express = require("express");
const {
    createFolder,
    getFolders,
    getFolderById,
    renameFolder,
    deleteFolder,
    restoreDeletedFolder,
    permanentlyDeleteFolder,
} = require("../controllers/folderController");
const { getFolderPermissions } = require("../controllers/permissionController");
const { getFolderActivityLogs } = require("../controllers/activityController");
const { protect } = require("../middlewares/authMiddleware");
const { requireFolderPermission } = require("../middlewares/permissionMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Folders
 *   description: Folder management APIs
 */

/**
 * @swagger
 * /api/folders:
 *   post:
 *     summary: Create a new folder
 *     description: Create a folder at the root or within a parent folder. Creator automatically gets admin access.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Contracts
 *               parentFolderId:
 *                 type: string
 *                 example: 60d21b4667d0d8992e610c85
 *                 description: Nullable. If provided, folder is nested.
 *     responses:
 *       201:
 *         description: Folder created successfully
 *       400:
 *         description: Bad request (e.g. duplicate name)
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Parent folder not found
 *       500:
 *         description: Server error
 */
router.post("/", protect, createFolder);

/**
 * @swagger
 * /api/folders:
 *   get:
 *     summary: Get all folders
 *     description: Retrieve all non-deleted folders you have access to. Can be filtered by parentFolderId.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parentFolderId
 *         schema:
 *           type: string
 *         description: Filter folders by their parentFolderId (use 'null' for root folders).
 *     responses:
 *       200:
 *         description: Folders fetched successfully
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, getFolders);

/**
 * @swagger
 * /api/folders/{folderId}/permissions:
 *   get:
 *     summary: Get all permissions for a folder
 *     description: Retrieve all active permissions for a specific folder. Requires admin access.
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     responses:
 *       200:
 *         description: Permissions fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.get("/:folderId/permissions", protect, requireFolderPermission("admin"), getFolderPermissions);

/**
 * @swagger
 * /api/folders/{id}:
 *   get:
 *     summary: Get folder by ID
 *     description: Retrieve a single non-deleted folder by its ID. Requires view permission.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     responses:
 *       200:
 *         description: Folder fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.get("/:id", protect, requireFolderPermission("view"), getFolderById);

/**
 * @swagger
 * /api/folders/{id}:
 *   patch:
 *     summary: Rename a folder
 *     description: Update the name of a folder. Requires edit permission.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: New Folder Name
 *     responses:
 *       200:
 *         description: Folder renamed successfully
 *       400:
 *         description: Bad request (duplicate name)
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.patch("/:id", protect, requireFolderPermission("edit"), renameFolder);

/**
 * @swagger
 * /api/folders/{id}:
 *   delete:
 *     summary: Soft delete a folder
 *     description: Marks a folder as deleted instead of physically removing it. Requires admin permission.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 description: Must be true to confirm deletion
 *               reason:
 *                 type: string
 *                 description: Optional reason for deletion
 *     responses:
 *       200:
 *         description: Folder deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", protect, deleteFolder);

/**
 * @swagger
 * /api/folders/{id}/restore-deleted:
 *   post:
 *     summary: Restore a soft-deleted folder
 *     description: Restores a deleted folder within the 30-day retention window. Requires admin permission.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     responses:
 *       200:
 *         description: Folder restored successfully
 *       400:
 *         description: Restore window expired
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Deleted folder not found
 *       500:
 *         description: Server error
 */
router.post("/:id/restore-deleted", protect, restoreDeletedFolder);

/**
 * @swagger
 * /api/folders/{id}/permanent-delete:
 *   post:
 *     summary: Permanently delete a soft-deleted folder
 *     description: Removes the folder and its soft-deleted descendants from the database. Does not delete R2 objects.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirm
 *             properties:
 *               confirm:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Folder permanently deleted
 *       400:
 *         description: Confirmation required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Deleted folder not found
 */
router.post("/:id/permanent-delete", protect, permanentlyDeleteFolder);

/**
 * @swagger
 * /api/folders/{id}/activity:
 *   get:
 *     summary: Get folder activity logs
 *     description: Requires view permission on the folder.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
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
 *         description: Activity fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 */
router.get("/:id/activity", protect, requireFolderPermission("view"), getFolderActivityLogs);

module.exports = router;
