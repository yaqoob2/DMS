const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("../models/User");

dotenv.config();

const resetAdminPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const user = await User.findOne({
            email: "admin@docrepo.com",
        }).select("+password");

        if (!user) {
            console.log("Old admin user not found");
            process.exit(1);
        }

        user.email = "admin@connecthub.com";
        user.password = "Admin@12345";
        user.isActive = true;
        user.role = "superadmin";

        await user.save();

        console.log("Admin email and password reset successfully");
        process.exit(0);
    } catch (error) {
        console.error("Reset failed:", error.message);
        process.exit(1);
    }
};

resetAdminPassword();