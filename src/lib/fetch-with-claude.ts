import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ClaudeError, claudeClient, MODEL, toClaudeError } from "./claude";
import type { JobDetails } from "./extract";

const PostingSchema = z.object({
  found: z.boolean().describe("True only if you read the actual job posting at this link (or the same posting elsewhere)"),
  company: z.string().describe("Hiring company's common name, e.g. 'Shield AI' rather than a legal entity name. Empty if not found"),
  role: z.string().describe("Job title exactly as posted. Empty if not found"),
  location: z.string().describe("Location(s) and remote/hybrid status as posted. Empty if not stated"),
  description: z
    .string()
    .describe("The posting's text in its own words: about the role, responsibilities, qualifications, and any pay, location, sponsorship, or clearance details. Don't summarize or add anything. Empty if not found"),
  reason: z.string().describe("If not found, a short reason (login required, page blocked, posting closed, not a job page). Otherwise empty"),
});

const PROMPT = (url: string, hint: string) => `Read the job posting at this link and extract its details: ${url}
${hint ? `\nThe page's title says: "${hint}". Use it to search for the posting if you can't open the link.\n` : ""}
Fetch that exact URL with web_fetch first. If it fails, or the page doesn't contain the posting (a login wall, a block page, or an empty shell that loads the job with JavaScript), you may use web_search to find the same posting on the company's careers site or its job board, and fetch that instead. Only use a result you're confident is the same job: same company, same title, same location. If you can't read the posting, set found to false and say why.`;

// Fallback for pages the app can't read directly: Claude fetches them from Anthropic's servers, like claude.ai does.
// `known` is whatever the direct read found (e.g. a title from a page that blocked the rest), used as a search hint.
export async function fetchJobWithClaude(url: string, known: JobDetails = {}): Promise<JobDetails> {
  const client = claudeClient();
  const hint = [known.role, known.company, known.location].filter(Boolean).join(" · ");
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: PROMPT(url, hint) }];

  try {
    // Server-side tools can pause a long turn; resume by sending the paused turn back (no extra user message).
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools: [
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, max_content_tokens: 30000 },
          { type: "web_search_20260209", name: "web_search", max_uses: 2 },
        ],
        output_config: { effort: "low", format: betaZodOutputFormat(PostingSchema) },
        messages,
      });

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal") throw new ClaudeError("The model declined to read this page.");

      const posting = response.parsed_output;
      if (!posting) throw new ClaudeError("Got an unexpected response while reading the page.");
      if (!posting.found || !posting.role) {
        throw new ClaudeError(`Couldn't read the job from that page${posting.reason ? ` (${posting.reason.replace(/\.$/, "")})` : ""}.`);
      }
      return { company: posting.company, role: posting.role, location: posting.location, description: posting.description };
    }
  } catch (error) {
    throw toClaudeError(error);
  }
  throw new ClaudeError("Reading the page took too long. Try again.");
}
