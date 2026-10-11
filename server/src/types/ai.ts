export type Urgency = "low" | "normal" | "high" | "emergency";

/**
 * Structured requirements that the AI layer produces from a free-text request.
 * Validated on the server before it is trusted (see validators/ai.ts).
 */
export interface ExtractedRequirements {
  service_category: string | null;
  required_skills: string[];
  location: string | null;
  budget: number | null;
  urgency: Urgency;
  missing_information: string[];
  search_ready: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: Date;
}

export interface AiParseResult {
  reply: string;
  requirements: ExtractedRequirements;
}
