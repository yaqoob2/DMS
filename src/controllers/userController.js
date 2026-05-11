const User = require("../models/User");

// @desc Superadmin creates user
// @route POST /api/users
const createUser = async (req, res) => {
    try {
        const name = req.body.name?.trim();
        const email = req.body.email?.toLowerCase().trim();
        const password = req.body.password;
        const role = req.body.role;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required",
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists",
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || "owner",
            isActive: true,
        });

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "User creation failed",
            error: error.message,
        });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch users",
            error: error.message,
        });
    }
};

const getPermissionUsers = async (req, res) => {
    try {
        const users = await User.find({
            isActive: true,
            _id: { $ne: req.user._id },
        })
            .select("name email role isActive")
            .sort({ name: 1 });

        res.json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch permission users",
            error: error.message,
        });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { isActive } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        user.isActive = isActive;
        await user.save();

        res.json({
            success: true,
            message: `User ${isActive ? "activated" : "deactivated"} successfully`,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Status update failed",
            error: error.message,
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        await user.deleteOne();

        res.json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "User deletion failed",
            error: error.message,
        });
    }
};

const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        if (!["superadmin", "owner"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Role must be 'superadmin' or 'owner'.",
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        user.role = role;
        await user.save();

        res.json({
            success: true,
            message: "User role updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Role update failed",
            error: error.message,
        });
    }
};

// @desc Logged-in user changes own password
// @route PATCH /api/users/change-password
const changeMyPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters",
            });
        }

        const user = await User.findById(req.user._id).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const isMatch = await user.matchPassword(currentPassword);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect",
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Password change failed",
            error: error.message,
        });
    }
};

// @desc Superadmin resets any user's password
// @route PATCH /api/users/:id/reset-password
const resetUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password is required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters",
            });
        }

        const user = await User.findById(req.params.id).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: "User password reset successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Password reset failed",
            error: error.message,
        });
    }
};

module.exports = {
    createUser,
    getUsers,
    getPermissionUsers,
    updateUserStatus,
    deleteUser,
    updateUserRole,
    changeMyPassword,
    resetUserPassword,
};