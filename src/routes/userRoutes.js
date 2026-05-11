const express = require("express");

const {
    createUser,
    getUsers,
    getPermissionUsers,
    updateUserStatus,
    deleteUser,
    updateUserRole,
    changeMyPassword,
    resetUserPassword,
} = require("../controllers/userController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

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

module.exports = router;