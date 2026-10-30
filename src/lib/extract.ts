import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { fetchJobWithClaude } from "./fetch-with-claude";

export type JobDetails = {
  company?: string;
  role?: string;
  location?: string;
  source?: string;
  description?: string;
};

const SOURCES: [RegExp, string][] = [
  [/greenhouse\.io$/, "Greenhouse"],
  [/lever\.co$/, "Lever"],
  [/ashbyhq\.com$/, "Ashby"],
  [/myworkdayjobs\.com$/, "Workday"],
  [/linkedin\.com$/, "LinkedIn"],
  [/indeed\.com$/, "Indeed"],
  [/joinhandshake\.com$/, "Handshake"],
  [/wellfound\.com$/, "Wellfound"],
  [/simplify\.jobs$/, "Simplify"],
  [/smartrecruiters\.com$/, "SmartRecruiters"],
];

// Drop tracking parameters and "apply" suffixes so the same job pasted twice is recognized.
export function canonicalJobUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.*|ref|source|src|gh_src|lever-.*)$/i.test(key)) url.searchParams.delete(key);
  }
  if (url.hostname === "jobs.lever.co" || url.hostname === "jobs.ashbyhq.com") {
    url.pathname = url.pathname.replace(/\/(apply|application)\/?$/, "");
  }
  return url.toString();
}

class BlockedUrlError extends Error {}

// Turn a URL into job details. Reads the page directly first (free and fast); if that comes up short,
// asks Claude to fetch it with its web tools, which gets past JavaScript-only pages and many bot blocks.
export async function extractJob(rawUrl: string): Promise<JobDetails> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Link must start with http:// or https://");
  const source = SOURCES.find(([re]) => re.test(url.hostname))?.[1] ?? "Company site";

  let direct: JobDetails = {};
  let directError: unknown;
  try {
    direct = await readDirectly(url);
  } catch (e) {
    if (e instanceof BlockedUrlError) throw e;
    directError = e;
  }
  if (direct.company && direct.role && direct.description) return { source, ...direct };
  if (!process.env.ANTHROPIC_API_KEY) {
    if (directError) throw directError;
    return { source, ...direct };
  }

  try {
    return { source, ...direct, ...stripEmpty(await fetchJobWithClaude(url.toString(), direct)) };
  } catch (e) {
    console.error(`Claude couldn't read ${url}:`, e);
    // Keep whatever the direct read found; otherwise report Claude's reason, which is usually more specific.
    if (direct.role) return { source, ...direct };
    throw e;
  }
}

async function readDirectly(url: URL): Promise<JobDetails> {
  const fromApi = stripEmpty((await fromAtsApi(url).catch(() => undefined)) ?? {});
  if (fromApi.role && fromApi.company) return fromApi;

  const html = await fetchText(url);
  const fromPage = fromJsonLd(html) ?? fromMeta(html);
  return { ...fromPage, ...fromApi };
}

async function fromAtsApi(url: URL): Promise<JobDetails | undefined> {
  const parts = url.pathname.split("/").filter(Boolean);

  // boards.greenhouse.io/{board}/jobs/{id} or job-boards.greenhouse.io/{board}/jobs/{id}
  if (url.hostname.endsWith("greenhouse.io") && parts[1] === "jobs" && parts[2]) {
    const job = JSON.parse(await fetchText(new URL(`https://boards-api.greenhouse.io/v1/boards/${parts[0]}/jobs/${parts[2]}`), "application/json"));
    return {
      company: job.company_name ?? titleize(parts[0]),
      role: job.title,
      location: job.location?.name,
      description: htmlToText(job.content),
    };
  }

  // jobs.lever.co/{company}/{id}
  if (url.hostname === "jobs.lever.co" && parts[1]) {
    const job = JSON.parse(await fetchText(new URL(`https://api.lever.co/v0/postings/${parts[0]}/${parts[1]}`), "application/json"));
    const lists = (job.lists ?? []).map((l: { text: string; content: string }) => `${l.text}\n${htmlToText(l.content)}`);
    return {
      company: titleize(parts[0]),
      role: job.text,
      location: job.categories?.location,
      description: [job.descriptionPlain, ...lists, job.additionalPlain].filter(Boolean).join("\n\n"),
    };
  }

  // jobs.ashbyhq.com/{company}/{id}
  if (url.hostname === "jobs.ashbyhq.com" && parts[1]) {
    const board = JSON.parse(await fetchText(new URL(`https://api.ashbyhq.com/posting-api/job-board/${parts[0]}`), "application/json"));
    const job = board.jobs?.find((j: { id: string }) => j.id === parts[1]);
    if (job) {
      return {
        company: titleize(parts[0]),
        role: job.title,
        location: job.isRemote ? `${job.location} (Remote)` : job.location,
        description: job.descriptionPlain,
      };
    }
  }

  return undefined;
}

// Many career pages embed schema.org JobPosting data for Google Jobs.
function fromJsonLd(html: string): JobDetails | undefined {
  for (const [, body] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const posting = findJobPosting(data);
    if (!posting) continue;

    const locations = [posting.jobLocation].flat().map((l) => {
      const a = l?.address ?? {};
      return [a.addressLocality, a.addressRegion, a.addressCountry?.name ?? a.addressCountry].filter(Boolean).join(", ");
    });
    if (posting.jobLocationType === "TELECOMMUTE") locations.push("Remote");

    return stripEmpty({
      // Workday uses legal entity names like "2100 NVIDIA USA".
      company: decode(posting.hiringOrganization?.name)?.replace(/^\d+\s+/, ""),
      role: decode(posting.title),
      location: [...new Set(locations.filter(Boolean))].join(" / "),
      description: htmlToText(posting.description),
    });
  }
  return undefined;
}

type JobPosting = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: Record<string, string & { name?: string }> } | { address?: Record<string, string & { name?: string }> }[];
  jobLocationType?: string;
};

function findJobPosting(data: unknown): JobPosting | undefined {
  if (Array.isArray(data)) return data.map(findJobPosting).find(Boolean);
  if (!data || typeof data !== "object") return undefined;
  const obj = data as JobPosting & { "@graph"?: unknown };
  if ([obj["@type"]].flat().includes("JobPosting")) return obj;
  return obj["@graph"] ? findJobPosting(obj["@graph"]) : undefined;
}

// Last resort: Open Graph tags and <title>.
function fromMeta(html: string): JobDetails {
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
  const title = decode(meta("og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
  // LinkedIn: "New Grad Software Engineer at Acme — New York, NY | LinkedIn Jobs"
  const linkedIn = title?.match(/^(.+?) at (.+?)(?: [—-] (.+?))? \| LinkedIn/);
  if (linkedIn) return stripEmpty({ role: linkedIn[1], company: linkedIn[2], location: linkedIn[3] });
  return stripEmpty({ company: decode(meta("og:site_name")), role: title });
}

// Fetch with a timeout, following redirects manually so every hop can be checked against private addresses.
async function fetchText(url: URL, accept = "text/html"): Promise<string> {
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
        // Some sites (Workday) serve JSON instead of the page if JSON is acceptable at all.
        Accept: accept,
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new Error(`The site responded with ${res.status}`);
    return (await res.text()).slice(0, 3_000_000);
  }
  throw new Error("Too many redirects");
}

async function assertPublicHost(hostname: string) {
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
  for (const { address } of addresses) {
    const blocked =
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(address) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
      /^(::1$|f[cd]|fe80:)/i.test(address) ||
      address.startsWith("::ffff:127.");
    if (blocked) throw new BlockedUrlError("That link points to a private address");
  }
}

function titleize(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function decode(text?: string) {
  return text
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function htmlToText(html?: string) {
  if (!html) return undefined;
  // Decode first: Greenhouse returns its HTML entity-escaped.
  const text = decode(html)!
    .replace(/<\s*(br|\/p|\/div|\/h\d|\/ul|\/ol|\/tr)[^>]*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "");
  return decode(text)!
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripEmpty(details: JobDetails): JobDetails {
  return Object.fromEntries(
    Object.entries(details)
      .map(([k, v]) => [k, v?.replace(/[ \t\u00a0]*\n[ \t\u00a0]*/g, "\n").replace(/\n{3,}/g, "\n\n").trim()])
      .filter(([, v]) => v),
  ) as JobDetails;
}
