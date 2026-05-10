const express = require("express");
const {
    createUser,
    getUsers,
    getPermissionUsers,
    updateUserStatus,
    deleteUser,
    updateUserRole,
} = require("../controllers/userController");

const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.post("/", protect, authorizeRoles("superadmin"), createUser);

// Safe list for Permissions page
router.get(
    "/permission-options",
    protect,
    authorizeRoles("superadmin", "owner"),
    getPermissionUsers
);

router.get("/", protect, authorizeRoles("superadmin"), getUsers);

router.patch("/:id/status", protect, authorizeRoles("superadmin"), updateUserStatus);

router.delete("/:id", protect, authorizeRoles("superadmin"), deleteUser);

router.patch("/:id/role", protect, authorizeRoles("superadmin"), updateUserRole);

module.exports = router;