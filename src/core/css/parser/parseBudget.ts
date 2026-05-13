import { systemNow } from "../../../shared/clock";
import type { ParseBudgetOptions, ParseBudgetState } from "./types";

export function createParseBudget(options: ParseBudgetOptions): ParseBudgetState {
	return {
		deadlineMs: options.startedAt + Math.max(0, Math.trunc(options.maxMs)),
		now: options.now ?? systemNow,
		exceeded: false,
	};
}

export function isParseBudgetExceeded(budget?: ParseBudgetState): boolean {
	if (!budget) return false;
	if (budget.exceeded) return true;
	budget.exceeded = budget.now() > budget.deadlineMs;
	return budget.exceeded;
}
