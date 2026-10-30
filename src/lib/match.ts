import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Set MATCH_MODEL in .env.local to use a different model (e.g. claude-haiku-5-5 is much cheaper).
const MODEL = process.env.MATCH_MODEL || "claude-opus-5-5";

const MatchSchema = z.object({
  score: z.number().int().describe("0-100 fit score, calibrated as described in the instructions"),
  verdict: z.string().describe("One sentence: the overall fit and the main reason"),
  level: z
    .enum(["new_grad", "entry", "mid", "senior", "unclear"])
    .describe("The experience level this role is really hiring for, judged from requirements rather than the title alone"),
  matched_skills: z.array(z.string()).describe("Requirements the resume clearly shows, most important first"),
  missing_skills: z.array(z.string()).describe("Requirements the resume does not show, most important first"),
  red_flags: z
    .array(z.string())
    .describe("Dealbreakers or serious concerns: years of experience above new grad, seniority, clearance or citizenship, no visa sponsorship, degree level, relocation. Empty if none"),
  tailoring_tips: z
    .array(z.string())
    .describe("2-4 specific, actionable tips for tailoring the resume and cover letter to this job, citing real items from the resume"),
});

export type Match = z.infer<typeof MatchSchema>;

const SYSTEM = `You help a computer science new grad decide which jobs to apply to. You compare their resume with a job posting and judge how well they fit.

Be honest and calibrated; an inflated score wastes their time. Score guide:
- 85-100: strong fit. Clearly new-grad or entry level, and the resume covers most core requirements.
- 70-84: good fit. Worth applying; a few gaps.
- 50-69: stretch. Real gaps, or the level is a bit above new grad.
- 0-49: poor fit. Wrong field, or clearly requires substantial professional experience.

A requirement of 3+ years of professional experience, or a senior/staff title, should keep the score below 50 regardless of skill overlap. Internships, research, and substantial projects count as relevant experience but not as years of full-time experience. Treat closely related skills sensibly (for example, React experience partially covers "modern frontend frameworks"). Judge only from what the resume actually says; never assume skills it doesn't mention.`;

export class MatchError extends Error {}

export async function scoreMatch(resume: string, job: { company: string; role: string; description: string }): Promise<Match> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MatchError("No API key yet. Add ANTHROPIC_API_KEY to .env.local in the job-tracker folder, then restart the dev server.");
  }

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Re-runs the request on Anthropic's recommended model if a safety classifier declines it.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(MatchSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          // Resume first: it's the same for every job.
          content: `<resume>\n${resume}\n</resume>\n\n<job company="${job.company}" title="${job.role}">\n${job.description}\n</job>\n\nHow well does this resume fit this job?`,
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new MatchError("Your API key was rejected. Check ANTHROPIC_API_KEY in .env.local.");
    if (error instanceof Anthropic.PermissionDeniedError) throw new MatchError("Your API key doesn't have access to this model.");
    if (error instanceof Anthropic.RateLimitError) throw new MatchError("Rate limited by the API. Wait a minute and try again.");
    if (error instanceof Anthropic.BadRequestError && /credit/i.test(error.message)) {
      throw new MatchError("Your Anthropic account is out of credit. Add some at console.anthropic.com.");
    }
    if (error instanceof Anthropic.APIError) throw new MatchError(`The API returned an error (${error.status ?? "network"}). Try again.`);
    throw error;
  }

  if (response.stop_reason === "refusal") throw new MatchError("The model declined to score this posting.");
  if (!response.parsed_output) throw new MatchError("Got an unexpected response from the model. Try again.");
  const match = response.parsed_output;
  return { ...match, score: Math.max(0, Math.min(100, Math.round(match.score))) };
}
