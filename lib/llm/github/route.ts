import {
  GITHUB_DISTILLERS,
  GITHUB_FIDELITIES,
  GITHUB_JEV_MIN_CONFIDENCE,
  GITHUB_PASSTHROUGH_CHARS,
  type GithubDistiller,
  type GithubFidelity,
  type GithubFidelityRequest,
} from "@/lib/github/policy";

const CODE_EXT =
  /\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|rb|php|cs|cpp|c|h|swift|sql|sh|toml|ya?ml)$/i;
const PROSE_EXT = /\.(md|mdx|txt|rst)$/i;

export type GithubJevRoute = {
  fidelity: GithubFidelity | null;
  fidelityConfidence: number | null;
  distiller: GithubDistiller | null;
  distillerConfidence: number | null;
};

export type GithubResolvedRoute = {
  fidelity: GithubFidelity;
  distiller: GithubDistiller;
  router: "passthrough" | "caller" | "jev" | "heuristic";
  /** When true, return clipped source instead of calling a distiller. */
  skipModel: boolean;
};

export function looksLikeCode(path: string, text: string): boolean {
  if (CODE_EXT.test(path)) return true;
  if (PROSE_EXT.test(path)) return false;
  const markers = text.match(/[{};]/g);

  return (markers?.length ?? 0) > 12;
}

export function heuristicGithubRoute(input: {
  requested: GithubFidelityRequest;
  path: string;
  question: string;
  text: string;
}): Pick<GithubResolvedRoute, "fidelity" | "distiller"> {
  const wantsExact =
    /\b(show|paste|quote|exact|implementation|function|class|method|snippet|diff|patch|code)\b/i.test(
      input.question
    );
  const wantsArchitecture = /\b(architect|design|review|security|trade-?off|refactor)\b/i.test(
    input.question
  );
  const fidelity: GithubFidelity =
    input.requested !== "auto" ? input.requested : wantsExact ? "excerpts" : "summary";
  const code = looksLikeCode(input.path, input.text);

  let distiller: GithubDistiller = "luna";

  if (wantsArchitecture) distiller = "terra";
  else if (code && fidelity === "excerpts") distiller = "kimi";
  else if (fidelity === "summary" && input.question.trim().length < 80) distiller = "haiku";

  return { fidelity, distiller };
}

export function resolveGithubRoute(input: {
  requested: GithubFidelityRequest;
  path: string;
  question: string;
  text: string;
  jev: GithubJevRoute | null;
}): GithubResolvedRoute {
  const heuristic = heuristicGithubRoute(input);

  if (input.requested === "auto" && input.text.length <= GITHUB_PASSTHROUGH_CHARS) {
    return {
      fidelity: "raw",
      distiller: heuristic.distiller,
      router: "passthrough",
      skipModel: true,
    };
  }

  let fidelity = heuristic.fidelity;
  let distiller = heuristic.distiller;
  let router: GithubResolvedRoute["router"] = input.requested === "auto" ? "heuristic" : "caller";

  if (input.jev && input.requested === "auto") {
    if (input.jev.fidelity && (input.jev.fidelityConfidence ?? 0) >= GITHUB_JEV_MIN_CONFIDENCE) {
      fidelity = input.jev.fidelity;
      router = "jev";
    }
  }

  if (input.jev?.distiller && (input.jev.distillerConfidence ?? 0) >= GITHUB_JEV_MIN_CONFIDENCE) {
    distiller = input.jev.distiller;
    router = "jev";
  }

  return {
    fidelity,
    distiller,
    router,
    skipModel: fidelity === "raw",
  };
}

function isFidelity(value: string): value is GithubFidelity {
  return (GITHUB_FIDELITIES as readonly string[]).includes(value);
}

function isDistiller(value: string): value is GithubDistiller {
  return (GITHUB_DISTILLERS as readonly string[]).includes(value);
}

function readChoice(answer: unknown): { choice: string | null; confidence: number | null } {
  if (!answer || typeof answer !== "object") return { choice: null, confidence: null };
  const record = answer as { choice?: unknown; probabilities?: unknown };
  const choice = typeof record.choice === "string" ? record.choice : null;
  const probabilities = record.probabilities;

  if (!choice || !probabilities || typeof probabilities !== "object") {
    return { choice, confidence: null };
  }

  const probability = (probabilities as Record<string, unknown>)[choice];

  return {
    choice,
    confidence:
      typeof probability === "number" && Number.isFinite(probability) ? probability : null,
  };
}

/** Parse a gateway `/v1/evaluate` JSON body. Unknown shapes yield null fields. */
export function parseJevEvaluateResponse(body: unknown): GithubJevRoute {
  const answers =
    body && typeof body === "object" ? (body as { answers?: unknown }).answers : undefined;
  const record = answers && typeof answers === "object" ? (answers as Record<string, unknown>) : {};
  const fidelity = readChoice(record.fidelity);
  const distiller = readChoice(record.distiller);

  return {
    fidelity: fidelity.choice && isFidelity(fidelity.choice) ? fidelity.choice : null,
    fidelityConfidence: fidelity.confidence,
    distiller: distiller.choice && isDistiller(distiller.choice) ? distiller.choice : null,
    distillerConfidence: distiller.confidence,
  };
}
