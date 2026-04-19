const mongoose = require("mongoose");
const Program = require("../models/Program");
const Student = require("../models/Student");
const HttpError = require("../utils/httpError");

async function buildProgramRecommendations(studentId) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new HttpError(400, "Invalid studentId.");
  }

  const student = await Student.findById(studentId).lean();
  if (!student) throw new HttpError(404, "Student not found.");

  const {
    targetCountries = [],
    interestedFields = [],
    maxBudgetUsd = Infinity,
    preferredIntake,
    englishTest,
  } = student;

  const ieltsScore = englishTest?.score || 0;

  // Build match score via MongoDB Aggregation
  const recommendations = await Program.aggregate([
    // Stage 1: Pre-filter to reduce documents
    {
      $match: {
        ...(targetCountries.length ? { country: { $in: targetCountries } } : {}),
        ...(maxBudgetUsd ? { tuitionFeeUsd: { $lte: maxBudgetUsd } } : {}),
        minimumIelts: { $lte: ieltsScore || 100 },
      },
    },

    // Stage 2: Compute score components
    {
      $addFields: {
        countryScore: {
          $cond: [{ $in: ["$country", targetCountries] }, 35, 0],
        },
        fieldScore: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: interestedFields,
                      as: "f",
                      cond: {
                        $regexMatch: {
                          input: "$field",
                          regex: { $concat: ["(?i)", "$$f"] },
                        },
                      },
                    },
                  },
                },
                0,
              ],
            },
            30,
            0,
          ],
        },
        budgetScore: {
          $cond: [
            maxBudgetUsd
              ? { $lte: ["$tuitionFeeUsd", maxBudgetUsd] }
              : true,
            20,
            0,
          ],
        },
        intakeScore: preferredIntake
          ? { $cond: [{ $in: [preferredIntake, "$intakes"] }, 10, 0] }
          : 0,
        ieltsScore: {
          $cond: [{ $lte: ["$minimumIelts", ieltsScore] }, 5, 0],
        },
        scholarshipBonus: {
          $cond: ["$scholarshipAvailable", 5, 0],
        },
      },
    },

    // Stage 3: Sum total score and build reasons array
    {
      $addFields: {
        matchScore: {
          $add: ["$countryScore", "$fieldScore", "$budgetScore", "$intakeScore", "$ieltsScore", "$scholarshipBonus"],
        },
        reasons: {
          $filter: {
            input: [
              { $cond: [{ $gt: ["$countryScore", 0] }, { $concat: ["Country match: ", "$country"] }, null] },
              { $cond: [{ $gt: ["$fieldScore", 0] }, { $concat: ["Field alignment: ", "$field"] }, null] },
              { $cond: [{ $gt: ["$budgetScore", 0] }, "Within your budget", null] },
              { $cond: [{ $gt: ["$intakeScore", 0] }, { $concat: ["Preferred intake available: ", preferredIntake || ""] }, null] },
              { $cond: [{ $gt: ["$ieltsScore", 0] }, "IELTS score meets requirement", null] },
              { $cond: [{ $gt: ["$scholarshipBonus", 0] }, "Scholarship available", null] },
            ],
            as: "r",
            cond: { $ne: ["$$r", null] },
          },
        },
      },
    },

    // Stage 4: Only return programs with some match
    { $match: { matchScore: { $gt: 0 } } },

    // Stage 5: Sort and limit
    { $sort: { matchScore: -1, tuitionFeeUsd: 1 } },
    { $limit: 10 },

    // Stage 6: Lookup university info
    {
      $lookup: {
        from: "universities",
        localField: "university",
        foreignField: "_id",
        as: "universityInfo",
      },
    },
    { $unwind: { path: "$universityInfo", preserveNullAndEmptyArrays: true } },

    // Stage 7: Clean up projection
    {
      $project: {
        countryScore: 0, fieldScore: 0, budgetScore: 0,
        intakeScore: 0, ieltsScore: 0, scholarshipBonus: 0,
      },
    },
  ]);

  return {
    data: {
      student: {
        id: student._id,
        fullName: student.fullName,
        targetCountries,
        interestedFields,
        maxBudgetUsd,
        preferredIntake,
        ieltsScore,
      },
      recommendations,
      total: recommendations.length,
    },
    meta: {
      engine: "mongodb-aggregation",
      scoringFactors: {
        countryMatch: 35,
        fieldAlignment: 30,
        withinBudget: 20,
        intakeMatch: 10,
        ieltsMatch: 5,
        scholarshipBonus: 5,
      },
    },
  };
}

module.exports = { buildProgramRecommendations };
