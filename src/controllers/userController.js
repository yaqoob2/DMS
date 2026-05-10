const User = require("../models/User");

// @desc Superadmin creates user
// @route POST /api/users
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

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

// @desc List all users for User Management
// @route GET /api/users
// @access Superadmin only
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

// @desc Safe user list for folder permission assignment
// @route GET /api/users/permission-options
// @access Superadmin and Owner
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

// @desc Update user status activate/deactivate
// @route PATCH /api/users/:id/status
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

// @desc Delete user
// @route DELETE /api/users/:id
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

// @desc Update user role
// @route PATCH /api/users/:id/role
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

module.exports = {
    createUser,
    getUsers,
    getPermissionUsers,
    updateUserStatus,
    deleteUser,
    updateUserRole,
};