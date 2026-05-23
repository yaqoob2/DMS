const express = require("express");
const multer = require("multer");

const {
    createUser,
    getUsers,
    getPermissionUsers,
    updateUserStatus,
    deleteUser,
    updateUserRole,
    changeMyPassword,
    resetUserPassword,
    updateUserProfileImage,
} = require("../controllers/userController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024,
    },
});

router.post("/", protect, authorizeRoles("superadmin"), createUser);

router.patch("/change-password", protect, changeMyPassword);

router.get(
    "/permission-options",
    protect,
    authorizeRoles("superadmin", "owner"),
    getPermissionUsers
);

router.get("/", protect, authorizeRoles("superadmin"), getUsers);

router.patch(
    "/:id/status",
    protect,
    authorizeRoles("superadmin"),
    updateUserStatus
);

router.delete(
    "/:id",
    protect,
    authorizeRoles("superadmin"),
    deleteUser
);

router.patch(
    "/:id/role",
    protect,
    authorizeRoles("superadmin"),
    updateUserRole
);

router.patch(
    "/:id/reset-password",
    protect,
    authorizeRoles("superadmin"),
    resetUserPassword
);

/**
 * @swagger
 * /api/users/{id}/profile-image:
 *   patch:
 *     summary: Upload user profile image
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - profileImage
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: Profile image file. JPG, PNG, or WEBP only.
 *     responses:
 *       200:
 *         description: Profile image uploaded successfully
 *       400:
 *         description: Invalid or missing image file
 *       404:
 *         description: User not found
 */
router.patch(
    "/:id/profile-image",
    protect,
    authorizeRoles("superadmin"),
    upload.single("profileImage"),
    updateUserProfileImage
);

module.exports = router;