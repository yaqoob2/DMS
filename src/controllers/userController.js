const User = require("../models/User");

const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const r2Client = new S3Client({
    region: "auto",
    endpoint:
        process.env.R2_ENDPOINT ||
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const getSignedProfileImageUrl = async (profileImageKey) => {
    if (!profileImageKey) return "";

    const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: profileImageKey,
    });

    return getSignedUrl(r2Client, command, {
        expiresIn: Number(process.env.R2_SIGNED_URL_EXPIRES_SECONDS || 3600),
    });
};

const cleanFileName = (fileName = "profile.jpg") => {
    return fileName
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .toLowerCase();
};

const uploadProfileImageToR2 = async ({ userId, file }) => {
    const timestamp = Date.now();
    const safeFileName = cleanFileName(file.originalname);
    const profileImageKey = `profile-pics/${userId}-${timestamp}-${safeFileName}`;

    await r2Client.send(
        new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: profileImageKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        })
    );

    return profileImageKey;
};

const deleteOldProfileImageFromR2 = async (profileImageKey) => {
    if (!profileImageKey) return;

    try {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: profileImageKey,
            })
        );
    } catch (error) {
        console.error("Failed to delete old profile image from R2:", error.message);
    }
};

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

        const usersWithSignedImages = await Promise.all(
            users.map(async (user) => {
                const plainUser = user.toObject();

                plainUser.profileImageUrl = plainUser.profileImageKey
                    ? await getSignedProfileImageUrl(plainUser.profileImageKey)
                    : "";

                return plainUser;
            })
        );

        res.json({
            success: true,
            count: usersWithSignedImages.length,
            users: usersWithSignedImages,
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

const updateUserProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Profile image file is required",
            });
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: "Only JPG, PNG, and WEBP images are allowed",
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const oldProfileImageKey = user.profileImageKey;

        const profileImageKey = await uploadProfileImageToR2({
            userId: user._id.toString(),
            file: req.file,
        });

        user.profileImageKey = profileImageKey;
        user.profileImageUrl = "";

        await user.save();

        if (oldProfileImageKey) {
            await deleteOldProfileImageFromR2(oldProfileImageKey);
        }

        const signedProfileImageUrl = await getSignedProfileImageUrl(profileImageKey);

        const safeUser = user.toObject();
        delete safeUser.password;

        safeUser.profileImageUrl = signedProfileImageUrl;

        res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully",
            user: safeUser,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update profile image",
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
    updateUserProfileImage,
};