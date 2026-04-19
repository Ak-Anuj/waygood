const express = require("express");
const { createApplication, listApplications, updateApplicationStatus, getApplication } = require("../controllers/applicationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth); // all routes require auth
router.get("/", listApplications);
router.post("/", createApplication);
router.get("/:id", getApplication);
router.patch("/:id/status", updateApplicationStatus);

module.exports = router;
