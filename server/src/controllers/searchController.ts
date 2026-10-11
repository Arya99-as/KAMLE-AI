import type { Request, Response } from "express";
import findMatches from "../services/matchingService.js";
import { heuristicParse } from "../services/aiService.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import type { SearchBody } from "../validators/search.js";

/** Structured search endpoint. Deterministic; never relies on the LLM. */
export async function search(req: Request<unknown, unknown, SearchBody>, res: Response) {
  const body = req.body;

  let category = body.category ?? null;
  let skills = body.skills ?? [];
  let location = body.location ?? "";
  let budget = body.budget ?? null;

  // If the customer typed a free-text query but gave no structure, parse it locally.
  if (body.query && body.query.trim() && !category && skills.length === 0) {
    const parsed = heuristicParse({
      messages: [{ role: "user", content: body.query, at: new Date() }],
    });
    category = category ?? parsed.requirements.service_category;
    skills = skills.length ? skills : parsed.requirements.required_skills;
    location = location || parsed.requirements.location || "";
    budget = budget ?? parsed.requirements.budget;
  }

  const result = await findMatches(
    { category, skills, location, budget, urgency: body.urgency, text: body.query || null },
    { page: body.page, limit: body.limit },
  );

  const paginated = buildPaginated(result.workers, result.total, getPagination(body as unknown as Record<string, unknown>, 12));
  res.json({
    ...paginated,
    appliedFilters: { category, skills, location, budget },
    weightsUsed: result.weightsUsed,
  });
}
