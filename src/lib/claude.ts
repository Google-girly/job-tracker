import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Set MATCH_MODEL in .env.local to use a different model (e.g. claude-haiku-5-5 is much cheaper).
export const MODEL = process.env.MATCH_MODEL || "claude-opus-5-5";

// Errors with a message that's safe and useful to show in the UI.
export class ClaudeError extends Error {}

export function claudeClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError("No API key yet. Add ANTHROPIC_API_KEY to .env.local in the job-tracker folder, then restart the dev server.");
  }
  return new Anthropic();
}

export function toClaudeError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError) return new ClaudeError("Your API key was rejected. Check ANTHROPIC_API_KEY.");
  if (error instanceof Anthropic.PermissionDeniedError) return new ClaudeError("Your API key doesn't have access to this model.");
  if (error instanceof Anthropic.RateLimitError) return new ClaudeError("Rate limited by the API. Wait a minute and try again.");
  if (error instanceof Anthropic.BadRequestError && /credit/i.test(error.message)) {
    return new ClaudeError("Your Anthropic account is out of credit. Add some at console.anthropic.com.");
  }
  if (error instanceof Anthropic.APIError) return new ClaudeError(`The API returned an error (${error.status ?? "network"}). Try again.`);
  return error;
}
