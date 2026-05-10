const express = require("express");
const {
    getStorageSummary,
    getLargestFiles,
    getMonthlyActivity,
} = require("../controllers/storageController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Storage
 *   description: System storage and monitoring
 */

router.get(
    "/summary",
    protect,
    authorizeRoles("superadmin", "owner"),
    getStorageSummary
);

router.get(
    "/largest-files",
    protect,
    authorizeRoles("superadmin", "owner"),
    getLargestFiles
);

router.get(
    "/monthly-activity",
    protect,
    authorizeRoles("superadmin", "owner"),
    getMonthlyActivity
);

module.exports = router;