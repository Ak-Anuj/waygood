const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");
const Student = require("../models/Student");
const env = require("../config/env");

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, role, targetCountries, interestedFields, preferredIntake, maxBudgetUsd, englishTest } = req.body;

  if (!fullName || !email || !password) throw new HttpError(400, "fullName, email, and password are required.");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");

  const existing = await Student.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw new HttpError(409, "An account with this email already exists.");

  const student = await Student.create({
    fullName, email, password,
    role: role || "student",
    targetCountries: targetCountries || [],
    interestedFields: interestedFields || [],
    preferredIntake, maxBudgetUsd, englishTest,
    profileComplete: !!(targetCountries?.length && interestedFields?.length && maxBudgetUsd),
  });

  const token = signToken(student._id);
  res.status(201).json({
    success: true,
    data: { token, user: { id: student._id, fullName: student.fullName, email: student.email, role: student.role, profileComplete: student.profileComplete } },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, "email and password are required.");

  const student = await Student.findOne({ email: email.toLowerCase().trim() });
  if (!student) throw new HttpError(401, "Invalid email or password.");

  const isMatch = await student.comparePassword(password);
  if (!isMatch) throw new HttpError(401, "Invalid email or password.");

  const token = signToken(student._id);
  res.json({
    success: true,
    data: { token, user: { id: student._id, fullName: student.fullName, email: student.email, role: student.role, profileComplete: student.profileComplete } },
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ["fullName", "targetCountries", "interestedFields", "preferredIntake", "maxBudgetUsd", "englishTest"];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const merged = { ...req.user.toObject(), ...updates };
  updates.profileComplete = !!(merged.targetCountries?.length && merged.interestedFields?.length && merged.maxBudgetUsd);
  const updated = await Student.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select("-password");
  res.json({ success: true, data: updated });
});

module.exports = { register, login, me, updateProfile };
