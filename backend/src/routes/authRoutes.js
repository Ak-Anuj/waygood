const express = require("express");
const { login, me, register, updateProfile } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter.middleware(), register);
router.post("/login", authLimiter.middleware(), login);
router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateProfile);

module.exports = router;
