import type { Severity } from "../../shared/types";

export function severityFromScore(score: number): Severity {
  if (score >= 12) return "critical";
  if (score >= 9) return "high";
  if (score >= 6) return "medium";
  if (score >= 3) return "low";
  return "info";
}

export function confidenceFromScore(score: number): number {
  return Math.max(30, Math.min(99, 40 + score * 6));
}
