const express = require("express");
const {
    uploadFile,
    uploadNewVersion,
    getVersions,
    getFiles,
    getFileById,
    downloadFile,
    downloadVersion,
    restoreVersion,
    deleteFile,
    previewFile,
    restoreDeletedFile,
    permanentlyDeleteFile,
} = require("../controllers/fileController");
const { addComment, getFileComments, deleteComment } = require("../controllers/commentController");
const { getFileActivityLogs } = require("../controllers/activityController");
const { protect } = require("../middlewares/authMiddleware");
const { requireFolderPermission } = require("../middlewares/permissionMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: File management, upload, and versioning APIs
 */

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload a new file (Initial Version)
 *     description: Upload a file to a specific folder. Requires edit permission on the folder.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - folderId
 *               - commitMessage
 *               - file
 *             properties:
 *               folderId:
 *                 type: string
 *                 description: ID of the folder where the file belongs
 *               commitMessage:
 *                 type: string
 *                 description: A required commit message describing the file upload
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The file to upload
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied or Storage limit exceeded
 *       404:
 *         description: Folder not found
 *       500:
 *         description: Server error
 */
router.post("/upload", protect, upload.single("file"), requireFolderPermission("edit"), uploadFile);

/**
 * @swagger
 * /api/files/{id}/new-version:
 *   post:
 *     summary: Upload a new version of a file
 *     description: Uploads a new version for an existing file. Requires edit permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - commitMessage
 *               - file
 *             properties:
 *               commitMessage:
 *                 type: string
 *                 description: A required commit message describing the changes
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The new version of the file
 *     responses:
 *       201:
 *         description: New version uploaded successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied or Storage limit exceeded
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.post("/:id/new-version", protect, requireFolderPermission("edit"), upload.single("file"), uploadNewVersion);

/**
 * @swagger
 * /api/files/{id}/versions:
 *   get:
 *     summary: Get all versions of a file
 *     description: Retrieve all versions of a specific file. Requires view permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: Versions fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get("/:id/versions", protect, requireFolderPermission("view"), getVersions);

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Get all files
 *     description: Retrieve all non-deleted files. Only returns files from folders the user has access to.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folderId
 *         schema:
 *           type: string
 *         description: Filter files by their folderId
 *     responses:
 *       200:
 *         description: Files fetched successfully
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, getFiles); // Permission handled inside controller

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get file by ID
 *     description: Retrieve file metadata including the current version. Requires view permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get("/:id", protect, requireFolderPermission("view"), getFileById);

/**
 * @swagger
 * /api/files/{id}/preview:
 *   get:
 *     summary: Generate signed preview URL and metadata
 *     description: Returns a signed URL for inline preview and file type metadata. Requires view permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: Signed preview URL and metadata generated
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get("/:id/preview", protect, requireFolderPermission("view"), previewFile);

/**
 * @swagger
 * /api/files/{id}/download:
 *   get:
 *     summary: Generate signed download URL for current version
 *     description: Returns a signed URL. Requires view permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: Signed download URL generated
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get("/:id/download", protect, requireFolderPermission("view"), downloadFile);

/**
 * @swagger
 * /api/files/{id}/versions/{versionId}/download:
 *   get:
 *     summary: Generate signed download URL for an old version
 *     description: Returns a signed URL. Requires view permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Version ID
 *     responses:
 *       200:
 *         description: Signed download URL generated
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File or Version not found
 *       500:
 *         description: Server error
 */
router.get("/:id/versions/:versionId/download", protect, requireFolderPermission("view"), downloadVersion);

/**
 * @swagger
 * /api/files/{id}/restore/{versionId}:
 *   post:
 *     summary: Restore a specific old version
 *     description: Updates the file's current version to the specified old version. Requires edit permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Version ID to restore to
 *     responses:
 *       200:
 *         description: Version restored successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File or Version not found
 *       500:
 *         description: Server error
 */
router.post("/:id/restore/:versionId", protect, requireFolderPermission("edit"), restoreVersion);

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Soft delete a file
 *     description: Marks a file as deleted without physically removing it from storage. Requires admin permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
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
 *         description: File deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", protect, deleteFile);

/**
 * @swagger
 * /api/files/{id}/restore-deleted:
 *   post:
 *     summary: Restore a soft-deleted file
 *     description: Restores a deleted file within the 30-day retention window. Requires admin permission.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File restored successfully
 *       400:
 *         description: Restore window expired
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Deleted file not found
 *       500:
 *         description: Server error
 */
router.post("/:id/restore-deleted", protect, restoreDeletedFile);

router.post("/:id/permanent-delete", protect, permanentlyDeleteFile);

/**
 * @swagger
 * /api/files/{id}/comments:
 *   post:
 *     summary: Add a comment to a file
 *     description: Requires view permission on the folder.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 */
router.post("/:id/comments", protect, requireFolderPermission("view"), addComment);

/**
 * @swagger
 * /api/files/{id}/comments:
 *   get:
 *     summary: Get file comments
 *     description: Requires view permission on the folder.
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: Comments fetched successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 */
router.get("/:id/comments", protect, requireFolderPermission("view"), getFileComments);

/**
 * @swagger
 * /api/files/{id}/comments/{commentId}:
 *   delete:
 *     summary: Soft delete a comment
 *     description: Requires view permission (ownership check handled internally).
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Access denied
 */
router.delete("/:id/comments/:commentId", protect, requireFolderPermission("view"), deleteComment);

/**
 * @swagger
 * /api/files/{id}/activity:
 *   get:
 *     summary: Get file activity logs
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
 *         description: File ID
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
router.get("/:id/activity", protect, requireFolderPermission("view"), getFileActivityLogs);

module.exports = router;
