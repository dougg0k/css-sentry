import type { FrameReport } from "../../shared/types";
import type { Now } from "../../shared/clock";
import { systemNow } from "../../shared/clock";
import { getOrigin } from "../../shared/url";
import { createPartialFrameSummary } from "./coverageSummary";

export interface SubframeNavigationCoverageInput {
  tabId: number;
  topLevelUrl: string;
  frameId: number;
  parentFrameId: number;
  frameUrl: string;
  now?: Now;
}

export function createCrossOriginSubframePartialReport(input: SubframeNavigationCoverageInput): FrameReport | null {
  const now = input.now ?? systemNow;
  if (input.frameId === 0) return null;
  if (!isHttpLikeUrl(input.topLevelUrl) || !isHttpLikeUrl(input.frameUrl)) return null;

  const topLevelOrigin = getOrigin(input.topLevelUrl);
  const frameOrigin = getOrigin(input.frameUrl);
  if (!topLevelOrigin || !frameOrigin || topLevelOrigin === frameOrigin) return null;

  return {
    frameId: input.frameId,
    parentFrameId: input.parentFrameId,
    frameUrl: input.frameUrl,
    frameOrigin,
    summary: createPartialFrameSummary(input.topLevelUrl, input.frameUrl, now),
    updatedAt: now(),
  };
}

function isHttpLikeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:";
  } catch {
    return false;
  }
}
