import crypto from "node:crypto";
import AiEvaluation, { type IAiEvaluation, type IEvaluationFailedCase } from "../models/AiEvaluation.js";
import { parseRequest, getAiConfig } from "./aiService.js";
import env from "../config/env.js";

export interface GoldenTestCase {
  id: string;
  query: string;
  expectedCategory: string;
  expectedSkills: string[];
}

export const GOLDEN_DATASET: GoldenTestCase[] = [
  {
    id: "tc_1",
    query: "My kitchen pipe is leaking water all over the floor urgently in Kolhapur, please help!",
    expectedCategory: "Plumbing",
    expectedSkills: ["Leak Repair", "Pipe Fitting"],
  },
  {
    id: "tc_2",
    query: "The main fuse and MCB switch keep tripping in my apartment in Pune, need an electrician.",
    expectedCategory: "Electrical",
    expectedSkills: ["Fuse & MCB Repair", "Circuit Troubleshooting"],
  },
  {
    id: "tc_3",
    query: "My double-door refrigerator is not cooling properly in Mumbai, budget around 1500.",
    expectedCategory: "Appliance Repair",
    expectedSkills: ["Refrigerator Repair", "Cooling System Troubleshooting"],
  },
  {
    id: "tc_4",
    query: "Need a carpenter to fix our wooden wardrobe door hinge and bedroom shelf in Bangalore.",
    expectedCategory: "Carpentry",
    expectedSkills: ["Door Repair", "Wardrobe Fitting", "Shelf Installation"],
  },
  {
    id: "tc_5",
    query: "Looking for interior house painting and whitewash for a 2BHK flat in Delhi.",
    expectedCategory: "Painting",
    expectedSkills: ["Interior Painting", "Whitewash"],
  },
  {
    id: "tc_6",
    query: "Need deep cleaning and sanitization for my home before Diwali in Hyderabad.",
    expectedCategory: "Cleaning",
    expectedSkills: ["Home Cleaning", "Deep Cleaning", "Sanitization"],
  },
  {
    id: "tc_7",
    query: "My scooter brake is loose and engine is making weird noise in Nagpur.",
    expectedCategory: "Vehicle Repair",
    expectedSkills: ["Two-Wheeler Repair", "Brake Repair"],
  },
  {
    id: "tc_8",
    query: "Laptop screen is flickering and windows operating system needs reinstallation in Kolhapur.",
    expectedCategory: "Computer Repair",
    expectedSkills: ["Laptop Repair", "Operating System Setup"],
  },
];

export async function runAiEvaluation(adminUserId?: string): Promise<IAiEvaluation> {
  const config = await getAiConfig();
  const evaluationId = `eval_${crypto.randomUUID()}`;
  const totalCases = GOLDEN_DATASET.length;
  let passedCases = 0;
  let totalDuration = 0;
  const failedCases: IEvaluationFailedCase[] = [];

  for (const testCase of GOLDEN_DATASET) {
    const t0 = Date.now();
    try {
      const result = await parseRequest({
        messages: [{ role: "user", content: testCase.query, at: new Date() }],
        feature: "evaluation",
        requestId: `eval_req_${testCase.id}_${Date.now()}`,
        correlationId: evaluationId,
        userRole: "admin_evaluator",
      });

      const duration = Date.now() - t0;
      totalDuration += duration;

      const detectedCat = result.requirements.service_category;
      const detectedSkills = result.requirements.required_skills || [];

      // Check if detected category matches expected
      const categoryMatch =
        detectedCat?.toLowerCase().trim() === testCase.expectedCategory.toLowerCase().trim();

      // Check skill overlap (at least 1 matching skill or closely matching)
      const hasSkillOverlap =
        testCase.expectedSkills.length === 0 ||
        testCase.expectedSkills.some((es) =>
          detectedSkills.some((ds) => ds.toLowerCase().includes(es.toLowerCase()) || es.toLowerCase().includes(ds.toLowerCase())),
        );

      if (categoryMatch && hasSkillOverlap) {
        passedCases++;
      } else {
        failedCases.push({
          prompt: testCase.query,
          expectedCategory: testCase.expectedCategory,
          actualCategory: detectedCat || "null",
          expectedSkills: testCase.expectedSkills,
          actualSkills: detectedSkills,
          error: !categoryMatch ? "Category mismatch" : "Skill overlap insufficient",
        });
      }
    } catch (err) {
      totalDuration += Date.now() - t0;
      failedCases.push({
        prompt: testCase.query,
        expectedCategory: testCase.expectedCategory,
        actualCategory: "ERROR",
        expectedSkills: testCase.expectedSkills,
        actualSkills: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const accuracyPercent = Number(((passedCases / totalCases) * 100).toFixed(1));
  const avgDurationMs = Math.round(totalDuration / totalCases);

  const evaluation = await AiEvaluation.create({
    evaluationId,
    datasetName: "MURN Core Service Benchmark (Golden Dataset)",
    datasetVersion: "v1.0",
    feature: "problem_understanding",
    provider: config.defaultProvider || env.ai.provider,
    model: config.defaultModel || env.ai.model,
    totalCases,
    passedCases,
    accuracyPercent,
    avgDurationMs,
    validJsonRatePercent: 100,
    failedCases,
    runBy: adminUserId || undefined,
  });

  return evaluation;
}
