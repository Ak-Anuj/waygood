const express = require("express");
const { getRecommendations } = require("../controllers/recommendationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:studentId", requireAuth, getRecommendations);
// Convenience: get recommendations for logged-in user
router.get("/", requireAuth, (req, res, next) => {
  req.params.studentId = req.user._id.toString();
  next();
}, getRecommendations);

module.exports = router;
