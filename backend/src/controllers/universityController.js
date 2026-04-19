const University = require("../models/University");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");

function parseBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

const listUniversities = asyncHandler(async (req, res) => {
  const { country, partnerType, q, scholarshipAvailable, sortBy = "popular", page = 1, limit = 10 } = req.query;

  const filters = {};
  if (country) filters.country = country;
  if (partnerType) filters.partnerType = partnerType;

  const scholarshipFlag = parseBoolean(scholarshipAvailable);
  if (typeof scholarshipFlag === "boolean") filters.scholarshipAvailable = scholarshipFlag;

  if (q) {
    filters.$or = [
      { name: { $regex: q, $options: "i" } },
      { country: { $regex: q, $options: "i" } },
      { city: { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } },
    ];
  }

  const pageNumber = Math.max(Number(page), 1);
  const pageSize = Math.min(Math.max(Number(limit), 1), 50);

  const sortMap = {
    name: { name: 1 },
    ranking: { qsRanking: 1, popularScore: -1 },
    popular: { popularScore: -1, qsRanking: 1 },
  };

  // Cache for simple no-filter or country-only queries
  const isCacheable = !q && !partnerType && typeof scholarshipFlag !== "boolean";
  const cacheKey = isCacheable ? `universities:${country || "all"}:${sortBy}:${pageNumber}:${pageSize}` : null;

  if (cacheKey) {
    const cached = cacheService.get(cacheKey);
    if (cached) {
      return res.json({ success: true, ...cached, meta: { ...cached.meta, cache: "hit" } });
    }
  }

  const [items, total] = await Promise.all([
    University.find(filters)
      .sort(sortMap[sortBy] || sortMap.popular)
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    University.countDocuments(filters),
  ]);

  const payload = {
    data: items,
    meta: { page: pageNumber, limit: pageSize, total, totalPages: Math.ceil(total / pageSize), cache: "miss" },
  };

  if (cacheKey) cacheService.set(cacheKey, payload, 120); // 2 min TTL

  res.json({ success: true, ...payload });
});

const listPopularUniversities = asyncHandler(async (req, res) => {
  const cacheKey = "popular-universities";
  const cached = cacheService.get(cacheKey);

  if (cached) {
    return res.json({ success: true, data: cached, meta: { cache: "hit" } });
  }

  const universities = await University.find()
    .sort({ popularScore: -1, qsRanking: 1 })
    .limit(6)
    .lean();

  cacheService.set(cacheKey, universities);
  res.json({ success: true, data: universities, meta: { cache: "miss" } });
});

const getUniversity = asyncHandler(async (req, res) => {
  const university = await University.findById(req.params.id).lean();
  if (!university) {
    const HttpError = require("../utils/httpError");
    throw new HttpError(404, "University not found.");
  }
  res.json({ success: true, data: university });
});

module.exports = { listPopularUniversities, listUniversities, getUniversity };
