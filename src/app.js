const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./config/swagger");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const folderRoutes = require("./routes/folderRoutes");
const fileRoutes = require("./routes/fileRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const activityRoutes = require("./routes/activityRoutes");
const storageRoutes = require("./routes/storageRoutes");
const searchRoutes = require("./routes/searchRoutes");
const safetyRoutes = require("./routes/safetyRoutes");

const app = express();

app.use(helmet());

app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    })
);

// BODY PARSERS MUST BE BEFORE ROUTES
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(morgan("dev"));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
});
app.use(limiter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/safety", safetyRoutes);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "DocRepo Backend API is running",
    });
});

module.exports = app;