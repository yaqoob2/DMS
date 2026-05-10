const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { logActivity } = require("../services/activityService");

// @desc Login user
// @route POST /api/auth/login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

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

module.exports = {
    loginUser,
    getMe,
};