const express = require("express");
const { listPopularUniversities, listUniversities, getUniversity } = require("../controllers/universityController");
const router = express.Router();

router.get("/popular", listPopularUniversities);
router.get("/", listUniversities);
router.get("/:id", getUniversity);

module.exports = router;
