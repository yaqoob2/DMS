const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { logActivity } = require("../services/activityService");

// @desc Login user
// @route POST /api/auth/login
const loginUser = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase().trim();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated",
            });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = generateToken(user._id);

        await logActivity({
            userId: user._id,
            action: "login",
            targetType: "auth",
            message: `${user.name} logged in`,
            req
        });

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Login failed",
            error: error.message,
        });
    }
};

// @desc Get logged-in user
// @route GET /api/auth/me
const getMe = async (req, res) => {
    res.json({
        success: true,
        user: req.user,
    });
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
    loginUser,
    getMe,
};