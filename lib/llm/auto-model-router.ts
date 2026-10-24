import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { LanguageModelUsage } from "ai";

import { generateObject } from "ai";
import { z } from "zod";

import {
  JEV_GATEWAY_MODEL_ID,
  ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS,
  assertJevRequiresZdr,
  jevRouterCallConfig,
} from "@/lib/llm/subagents/orchestrator/router-zdr";
import {
  AUTO_CHAT_MODEL_ID,
  AUTO_RESOLVED_SONNET_MODEL_ID,
  ChatModelCatalog,
  DEFAULT_CHAT_MODEL,
  chatModelById,
  models,
  type ChatModel,
  type GatewayModelId,
} from "@/lib/schemas/chat";

/** Task complexity tier for tier → gateway routing (Delphi Auto path, etc.). */
export type TaskComplexityTier = "reflex" | "reasoning";

/**
 * Fine-grained composer activity state tracked while the user composes a message.
 * - `typing`: active keystrokes arriving within the typing window
 * - `thinking`: paused mid-draft (~900ms+) while formulating or refining a thought
 * - `reviewing`: cursor movement / text selection / inspection after a pause
 * - `idle`: no interaction for 6s+ (or empty composer at rest)
 * - `disconnected`: browser offline (`navigator.onLine === false`)
 */
export type UserComposerActivityState =
  | "typing"
  | "thinking"
  | "reviewing"
  | "idle"
  | "disconnected";

/** Semantic domain classification for Stage 1 change gate & Stage 2 model selection. */
export type AutoModelDomainShift =
  | "none"
  | "trivial"
  | "coding"
  | "research"
  | "math_science"
  | "creative"
  | "architecture";

export const AUTO_MODEL_DOMAIN_VALUES = [
  "none",
  "trivial",
  "coding",
  "research",
  "math_science",
  "creative",
  "architecture",
] as const;

export const USER_COMPOSER_ACTIVITY_STATES = [
  "typing",
  "thinking",
  "reviewing",
  "idle",
  "disconnected",
] as const;

/** Stage 2 lightweight ZDR picker model (Gemini Flash-Lite). */
export const AUTO_PICKER_GATEWAY_MODEL_ID = models.google.flashLite.id;

export const AUTO_ROUTER_ZDR_PROVIDER_OPTIONS = {
  gateway: {
    zeroDataRetention: true,
  } satisfies GatewayProviderOptions,
} as const;

const REASONING_KEYWORDS =
  /\b(why|how come|analyze|analyse|compare|contrast|prove|justify|implications|trade-?offs?|step by step|deep dive|reason through|elaborate|critique|evaluate)\b/i;

const REASONING_MIN_LEN = 280;

const CODING_PATTERNS =
  /```|`[^`]+`|\b(function|const|let|var|import|export|interface|type|class|struct|impl|fn|def|async|await|return|refactor|typescript|javascript|python|rust|react|nextjs|tailwind|css|html|sql|Prisma|supabase|component|hook|useEffect|useState|compile|linter|unit test|bug|stack trace|exception|regex|api route|handler|schema)\b/i;

const ARCHITECTURE_PATTERNS =
  /\b(architect(?:ure|ural)?|system design|distributed|microservice|scalability|throughput|latency|consensus|kafka|postgres|database schema|trade-?offs?|high availability|load balanc(?:er|ing)|caching|orchestrat(?:or|ion)|subagent|state machine|migration|adr|design doc|infrastructure|topology|multi-tenant|event-driven)\b/i;

const MATH_SCIENCE_PATTERNS =
  /(\\[a-zA-Z]+|\b(prove|proof|theorem|lemma|corollary|integral|derivative|differential|equation|eigen(?:value|vector)?|matrix|matrices|linear algebra|calculus|probability|bayesian|stochastic|hamiltonian|lagrangian|quantum|thermodynamics|relativity|kinematics|signed[- ]distance|sdf|raycast(?:er|ing)?|inverse[- ]square|fresnel|fourier|laplace|manifold|tensor|convex|optimization)\b|[∑∫∇∂√≈≠≤≥∀∃])/i;

const RESEARCH_PATTERNS =
  /\b(research|literature|citations?|sources?|compare and contrast|comprehensive|survey|benchmark|market analysis|historical|deep dive|synthesize|meta-analysis|state of the art|whitepaper|peer[- ]reviewed|empirical|findings|investigate|evidence| chronology)\b/i;

const CREATIVE_PATTERNS =
  /\b(story|poem|sonnet|haiku|screenplay|monologue|narrative|fiction|metaphor|lyrics|prose|character study|worldbuilding|dialogue|creative writing|fable|allegory)\b/i;

const TRIVIAL_GREETING_PATTERNS =
  /^(hey|hi|hello|yo|sup|howdy|greetings|good (morning|afternoon|evening)|thanks|thank you|thx|ok|okay|got it|cool|nice|yes|no|sure|ping|test)([!.?,\s]*)$/i;

/**
 * v1 classifier preserved for existing callers (`resolveChatModelId`, Delphi, etc.).
 * Long drafts or reasoning-ish keywords route to the heavier tier.
 */
export function classifyTaskTier(input: string): TaskComplexityTier {
  const t = input.trim();

  if (t.length >= REASONING_MIN_LEN) return "reasoning";
  if (REASONING_KEYWORDS.test(t)) return "reasoning";

  return "reflex";
}

function firstGatewayModel(predicate: (c: ChatModel) => boolean): GatewayModelId {
  const m = ChatModelCatalog.find(predicate);
  const fallback = ChatModelCatalog[0] ?? DEFAULT_CHAT_MODEL;

  return (m ?? fallback).id as GatewayModelId;
}

function firstZdrModelId(): GatewayModelId {
  return firstGatewayModel((c) => c.supportsZeroDataRetention !== false);
}

function firstAnyModelId(): GatewayModelId {
  return firstGatewayModel(() => true);
}

/** Fast, cheap gateway ids for short turns. */
export const REFLEX_IDS_ZDR: GatewayModelId[] = [
  models.google.flashLite.id as GatewayModelId,
  models.anthropic.haiku.id as GatewayModelId,
  models.openai.luna.id as GatewayModelId,
];

/** Heavier ids when ZDR is required. */
export const REASONING_IDS_ZDR: GatewayModelId[] = [
  models.anthropic.opus.id as GatewayModelId,
  models.google.flash.id as GatewayModelId,
  models.openai.sol.id as GatewayModelId,
];

/** When ZDR is off, non-ZDR reasoning models are allowed. */
export const REASONING_IDS_ANY: GatewayModelId[] = [
  models.anthropic.opus.id as GatewayModelId,
  models.perplexity.pro.id as GatewayModelId,
  models.openai.sol.id as GatewayModelId,
];

function pickFirstAllowed(ids: GatewayModelId[], zdr: boolean): GatewayModelId {
  for (const id of ids) {
    const row = chatModelById(id);

    if (!row || row.id === AUTO_CHAT_MODEL_ID) continue;
    if (zdr && row.supportsZeroDataRetention === false) continue;

    return id;
  }

  return zdr ? firstZdrModelId() : firstAnyModelId();
}

/**
 * Maps task tier + ZDR flag to a concrete gateway model id present in {@link ChatModelCatalog}.
 */
export function tierToGatewayModelId(tier: TaskComplexityTier, zdr: boolean): GatewayModelId {
  if (tier === "reflex") {
    return pickFirstAllowed(REFLEX_IDS_ZDR, zdr);
  }

  return pickFirstAllowed(zdr ? REASONING_IDS_ZDR : REASONING_IDS_ANY, zdr);
}

export function chatModelForGatewayId(id: GatewayModelId): ChatModel {
  return chatModelById(id) ?? DEFAULT_CHAT_MODEL;
}

/** True when a model selector id represents Auto mode (`"auto"` or `"organic-llm/auto"`). */
export function isAutoModelSelectorId(modelId: string | undefined | null): boolean {
  return modelId === "auto" || modelId === AUTO_CHAT_MODEL_ID;
}

/**
 * Converts a full catalog model title (e.g. `"Claude Sonnet 5.5"`, `"Gemini 3.5 Flash Lite"`)
 * into the compact display label rendered inside the Auto Lumen pill (`"Sonnet 5.5"`, `"Flash Lite"`).
 */
export function formatCompactModelLabel(fullTitle: string): string {
  const trimmed = fullTitle.trim();

  if (!trimmed) return "Sonnet 5.5";

  if (/^Gemini\s+\d+(?:\.\d+)?\s+Flash\s+Lite$/i.test(trimmed)) {
    return "Flash Lite";
  }

  const stripped = trimmed.replace(/^(Claude|Anthropic|OpenAI)\s+/i, "");

  return stripped || trimmed;
}

function tokenizeDraft(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_+#.\\]+/)
    .filter((tok) => tok.length >= 2);
}

function computeTokenJaccardDistance(prevText: string, nextText: string): number {
  const prevTokens = new Set(tokenizeDraft(prevText));
  const nextTokens = new Set(tokenizeDraft(nextText));

  if (prevTokens.size === 0 && nextTokens.size === 0) return 0;
  if (prevTokens.size === 0 || nextTokens.size === 0) return 1;

  let intersection = 0;

  for (const t of nextTokens) {
    if (prevTokens.has(t)) intersection += 1;
  }

  const union = prevTokens.size + nextTokens.size - intersection;

  return union === 0 ? 0 : 1 - intersection / union;
}

/**
 * Deterministic domain classification for a user draft.
 */
export function detectDraftDomain(
  text: string,
  options?: { webSearch?: boolean; experience?: string }
): AutoModelDomainShift {
  const trimmed = text.trim();

  if (!trimmed) return "none";

  if (TRIVIAL_GREETING_PATTERNS.test(trimmed)) {
    return "trivial";
  }

  const hasCodeFence = trimmed.includes("```");
  const mathMatches = MATH_SCIENCE_PATTERNS.test(trimmed);
  const archMatches = ARCHITECTURE_PATTERNS.test(trimmed);
  const codingMatches = CODING_PATTERNS.test(trimmed);
  const researchMatches = RESEARCH_PATTERNS.test(trimmed);
  const creativeMatches = CREATIVE_PATTERNS.test(trimmed);

  // Explicit math / physics / formal proof cues
  if (mathMatches && !hasCodeFence) {
    return "math_science";
  }

  // System architecture / design tradeoffs
  if (archMatches && (!hasCodeFence || /\b(design|architecture|trade-?offs?)\b/i.test(trimmed))) {
    return "architecture";
  }

  // Code fences or clear programming constructs
  if (hasCodeFence || codingMatches) {
    return "coding";
  }

  // Deep research / synthesis or web-search-backed analytical queries
  if (
    researchMatches ||
    (options?.webSearch &&
      trimmed.length >= 90 &&
      /\b(what|how|why|compare|latest|sources|evidence|analyze|overview|state of)\b/i.test(trimmed))
  ) {
    return "research";
  }

  if (creativeMatches) {
    return "creative";
  }

  if (trimmed.length >= REASONING_MIN_LEN || REASONING_KEYWORDS.test(trimmed)) {
    return options?.webSearch ? "research" : "architecture";
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount <= 8 && trimmed.length <= 56) {
    return "trivial";
  }

  return "trivial";
}

export interface AutoModelChangeGateInput {
  text: string;
  previousText?: string;
  previousDomain?: AutoModelDomainShift;
  activityState?: UserComposerActivityState;
  previousActivityState?: UserComposerActivityState;
  webSearch?: boolean;
  previousWebSearch?: boolean;
  memory?: boolean;
  previousMemory?: boolean;
  hasAttachments?: boolean;
  previousHasAttachments?: boolean;
  lastRoutedAtMs?: number;
  nowMs?: number;
  cooldownMs?: number;
}

export interface AutoModelChangeGateResult {
  shouldReroute: boolean;
  domainShift: AutoModelDomainShift;
  confidence: number;
  localDelta: {
    charDelta: number;
    tokenDistance: number;
    structuralShift: boolean;
    toolShift: boolean;
    activityTransition: boolean;
    passedNoiseThreshold: boolean;
  };
  jevCallConfig: ReturnType<typeof jevRouterCallConfig>;
  usedJevLive: boolean;
  zdr: true;
}

const JevGateSchema = z.object({
  shouldReroute: z.boolean(),
  domainShift: z.enum(AUTO_MODEL_DOMAIN_VALUES),
  confidence: z.number().min(0).max(1),
});

export type JevGateGenerateFn = (args: {
  model: typeof JEV_GATEWAY_MODEL_ID;
  system: string;
  prompt: string;
  providerOptions: typeof ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS;
  schema: typeof JevGateSchema;
}) => Promise<{
  object: z.infer<typeof JevGateSchema>;
  usage?: LanguageModelUsage;
}>;

export interface EvaluateAutoModelChangeGateOptions {
  /** Optional injected generator or live Jev caller. Always receives mandatory ZDR config. */
  generateGate?: JevGateGenerateFn;
  /** When true without a custom `generateGate`, invokes AI SDK `generateObject` against Jev. */
  useLiveJev?: boolean;
}

const JEV_GATE_SYSTEM_PROMPT = `You are Jev, Organic LLM's ultra-fast ZDR change gate for Auto model routing.
Determine whether the user's draft change constitutes a material semantic shift that warrants updating the routed model.
Return structured JSON with shouldReroute, domainShift, and confidence.`;

export type SyncAndAsyncResult<T extends object> = Promise<T> & T;

function attachSyncFields<T extends object>(
  promise: Promise<T>,
  syncValue: T
): SyncAndAsyncResult<T> {
  return Object.assign(promise, syncValue);
}

/**
 * Synchronous local + deterministic Stage 1 gate evaluation.
 * Validates Jev mandatory ZDR configuration (`jevRouterCallConfig()`) on every invocation.
 */
export function evaluateAutoModelChangeGateSync(
  input: AutoModelChangeGateInput
): AutoModelChangeGateResult {
  assertJevRequiresZdr();
  const jevConfig = jevRouterCallConfig();

  const text = input.text ?? "";
  const prevText = input.previousText ?? "";
  const trimmed = text.trim();
  const prevTrimmed = prevText.trim();

  const activity = input.activityState ?? "typing";
  const prevActivity = input.previousActivityState ?? activity;

  const charDelta = Math.abs(trimmed.length - prevTrimmed.length);
  const tokenDistance = computeTokenJaccardDistance(prevTrimmed, trimmed);

  const prevFence = prevTrimmed.includes("```");
  const nextFence = trimmed.includes("```");
  const prevQuestion = prevTrimmed.includes("?");
  const nextQuestion = trimmed.includes("?");

  const detectedDomain = detectDraftDomain(trimmed, { webSearch: input.webSearch });
  const prevDomain =
    input.previousDomain ??
    detectDraftDomain(prevTrimmed, { webSearch: input.previousWebSearch ?? input.webSearch });

  const structuralShift =
    prevFence !== nextFence || prevQuestion !== nextQuestion || detectedDomain !== prevDomain;

  const toolShift =
    (input.previousWebSearch !== undefined && input.previousWebSearch !== input.webSearch) ||
    (input.previousMemory !== undefined && input.previousMemory !== input.memory) ||
    Boolean(input.hasAttachments) !== Boolean(input.previousHasAttachments);

  const activityTransition =
    prevActivity !== activity &&
    (activity === "thinking" || activity === "reviewing") &&
    trimmed.length >= 12;

  const withinCooldown =
    typeof input.lastRoutedAtMs === "number" &&
    typeof input.nowMs === "number" &&
    input.nowMs - input.lastRoutedAtMs < (input.cooldownMs ?? 350) &&
    !structuralShift &&
    !toolShift;

  // Offline / disconnected never triggers network rerouting unless local domain flipped
  if (activity === "disconnected" && prevTrimmed === trimmed) {
    return {
      shouldReroute: false,
      domainShift: detectedDomain,
      confidence: 0.95,
      localDelta: {
        charDelta,
        tokenDistance,
        structuralShift: false,
        toolShift: false,
        activityTransition: false,
        passedNoiseThreshold: false,
      },
      jevCallConfig: jevConfig,
      usedJevLive: false,
      zdr: true,
    };
  }

  // Empty draft following empty draft is a no-op
  if (!trimmed && !prevTrimmed && !toolShift) {
    return {
      shouldReroute: false,
      domainShift: "none",
      confidence: 1,
      localDelta: {
        charDelta: 0,
        tokenDistance: 0,
        structuralShift: false,
        toolShift: false,
        activityTransition: false,
        passedNoiseThreshold: false,
      },
      jevCallConfig: jevConfig,
      usedJevLive: false,
      zdr: true,
    };
  }

  const isInitialMeaningfulDraft = !prevTrimmed && trimmed.length >= 2;
  const passedNoiseThreshold =
    !withinCooldown &&
    (isInitialMeaningfulDraft ||
      structuralShift ||
      toolShift ||
      activityTransition ||
      charDelta >= 14 ||
      (charDelta >= 5 && tokenDistance >= 0.35));

  const shouldReroute =
    passedNoiseThreshold &&
    (isInitialMeaningfulDraft ||
      detectedDomain !== prevDomain ||
      structuralShift ||
      toolShift ||
      activityTransition ||
      tokenDistance >= 0.45);

  const confidence = shouldReroute
    ? structuralShift || detectedDomain !== prevDomain
      ? 0.92
      : 0.78
    : 0.9;

  return {
    shouldReroute,
    domainShift: detectedDomain,
    confidence,
    localDelta: {
      charDelta,
      tokenDistance,
      structuralShift,
      toolShift,
      activityTransition,
      passedNoiseThreshold,
    },
    jevCallConfig: jevConfig,
    usedJevLive: false,
    zdr: true,
  };
}

/**
 * Stage 1 — Material Change & Jev ZDR Gate.
 *
 * 1. Runs a zero-cost local semantic delta check (character/token distance, structural shift,
 *    attachment/tool toggles, or activity transition e.g. `typing` → `thinking`/`reviewing`).
 * 2. When the draft has changed past the local noise threshold, calls Jev (`JEV_GATEWAY_MODEL_ID`)
 *    with mandatory ZDR (`providerOptions: { gateway: { zeroDataRetention: true } }`) when live
 *    generation is enabled/injected, with an instant deterministic fallback.
 */
export function evaluateAutoModelChangeGate(
  input: AutoModelChangeGateInput,
  options?: EvaluateAutoModelChangeGateOptions
): SyncAndAsyncResult<AutoModelChangeGateResult> {
  const syncResult = evaluateAutoModelChangeGateSync(input);

  if (!syncResult.localDelta.passedNoiseThreshold || input.activityState === "disconnected") {
    return attachSyncFields(Promise.resolve(syncResult), syncResult);
  }

  const generateGate =
    options?.generateGate ??
    (options?.useLiveJev
      ? async (args) => {
          const res = await generateObject({
            model: args.model,
            instructions: args.system,
            prompt: args.prompt,
            schema: args.schema,
            providerOptions: args.providerOptions,
            maxOutputTokens: 120,
          });

          return { object: res.object, usage: res.usage };
        }
      : undefined);

  if (!generateGate) {
    return attachSyncFields(Promise.resolve(syncResult), syncResult);
  }

  const asyncPromise = (async (): Promise<AutoModelChangeGateResult> => {
    try {
      const jevConfig = syncResult.jevCallConfig;

      if (jevConfig.providerOptions.gateway.zeroDataRetention !== true) {
        throw new Error("Jev gate requires mandatory ZDR");
      }

      const prompt = [
        `Activity state: ${input.activityState ?? "typing"} (prev: ${input.previousActivityState ?? "typing"})`,
        `Web search: ${Boolean(input.webSearch)}`,
        `Previous draft: ${(input.previousText ?? "").slice(-400)}`,
        `Current draft: ${input.text.slice(-600)}`,
      ].join("\n");

      const { object } = await generateGate({
        model: jevConfig.model,
        system: JEV_GATE_SYSTEM_PROMPT,
        prompt,
        providerOptions: jevConfig.providerOptions,
        schema: JevGateSchema,
      });

      return {
        ...syncResult,
        shouldReroute: object.shouldReroute,
        domainShift: object.domainShift,
        confidence: object.confidence,
        usedJevLive: true,
        zdr: true,
      };
    } catch {
      return syncResult;
    }
  })();

  return attachSyncFields(asyncPromise, syncResult);
}

export interface AutoModelRouteInput {
  text: string;
  previousText?: string;
  previousModelId?: string;
  activityState?: UserComposerActivityState;
  previousActivityState?: UserComposerActivityState;
  experience?: string;
  webSearch?: boolean;
  previousWebSearch?: boolean;
  memory?: boolean;
  previousMemory?: boolean;
  hasAttachments?: boolean;
  domainOverride?: AutoModelDomainShift;
  changedMaterially?: boolean;
}

export interface AutoModelRouteDecision {
  selectedSelectorId: "auto";
  routedModelId: string;
  routedModelLabel: string;
  routedModelFullTitle: string;
  activityState: UserComposerActivityState;
  domain: AutoModelDomainShift;
  reason: string;
  zdr: true;
  changedMaterially: boolean;
}

const PickerSchema = z.object({
  routedModelId: z.string(),
  domain: z.enum(AUTO_MODEL_DOMAIN_VALUES),
  reason: z.string().min(1).max(200),
});

export type AutoPickerGenerateFn = (args: {
  model: string;
  system: string;
  prompt: string;
  providerOptions: typeof AUTO_ROUTER_ZDR_PROVIDER_OPTIONS;
  schema: typeof PickerSchema;
}) => Promise<{
  object: z.infer<typeof PickerSchema>;
  usage?: LanguageModelUsage;
}>;

export interface SelectAutoRouteModelOptions {
  generatePicker?: AutoPickerGenerateFn;
  useLivePicker?: boolean;
}

function buildDecisionForModel(
  targetModel: ChatModel,
  params: {
    activityState: UserComposerActivityState;
    domain: AutoModelDomainShift;
    reason: string;
    changedMaterially: boolean;
  }
): AutoModelRouteDecision {
  const safeModel =
    targetModel.id === AUTO_CHAT_MODEL_ID || targetModel.supportsZeroDataRetention === false
      ? models.anthropic.sonnet
      : targetModel;

  return {
    selectedSelectorId: "auto",
    routedModelId: safeModel.id,
    routedModelLabel: formatCompactModelLabel(safeModel.name),
    routedModelFullTitle: safeModel.name,
    activityState: params.activityState,
    domain: params.domain,
    reason: params.reason,
    zdr: true,
    changedMaterially: params.changedMaterially,
  };
}

/**
 * Deterministic Stage 2 model selection over Organic's ZDR-capable model catalog.
 */
export function selectAutoRouteModelSync(input: AutoModelRouteInput): AutoModelRouteDecision {
  const activityState: UserComposerActivityState = input.activityState ?? "typing";
  const trimmed = (input.text ?? "").trim();
  const domain =
    input.domainOverride ??
    detectDraftDomain(trimmed, { webSearch: input.webSearch, experience: input.experience });
  const changedMaterially = input.changedMaterially ?? true;

  // Disconnected state: hold previous ZDR model if valid, or fall back locally without network calls
  if (activityState === "disconnected" && input.previousModelId) {
    const prevModel = chatModelById(input.previousModelId);

    if (
      prevModel &&
      prevModel.id !== AUTO_CHAT_MODEL_ID &&
      prevModel.supportsZeroDataRetention !== false
    ) {
      return buildDecisionForModel(prevModel, {
        activityState,
        domain: domain === "none" ? "trivial" : domain,
        reason: "Offline / disconnected — holding previously routed ZDR model",
        changedMaterially: false,
      });
    }
  }

  // Empty draft at rest
  if (!trimmed || domain === "none") {
    const defaultModel = chatModelById(AUTO_RESOLVED_SONNET_MODEL_ID) ?? models.anthropic.sonnet;

    return buildDecisionForModel(defaultModel, {
      activityState,
      domain: "none",
      reason: "Default balanced Auto route when composer draft is empty",
      changedMaterially,
    });
  }

  switch (domain) {
    case "trivial": {
      const quickModel =
        input.experience === "delphi" ? models.google.flashLite : models.anthropic.haiku;

      return buildDecisionForModel(quickModel, {
        activityState,
        domain,
        reason: "Fast, low-latency ZDR model for concise conversational turn",
        changedMaterially,
      });
    }

    case "coding": {
      return buildDecisionForModel(models.anthropic.sonnet, {
        activityState,
        domain,
        reason:
          "Claude Sonnet selected for code generation, debugging, and implementation accuracy",
        changedMaterially,
      });
    }

    case "architecture": {
      const archModel =
        (activityState === "reviewing" || activityState === "thinking") && trimmed.length >= 420
          ? models.anthropic.opus
          : models.anthropic.sonnet;

      return buildDecisionForModel(archModel, {
        activityState,
        domain,
        reason:
          archModel.id === models.anthropic.opus.id
            ? "Claude Opus selected for deep multi-constraint architectural synthesis"
            : "Claude Sonnet selected for system design and architectural trade-offs",
        changedMaterially,
      });
    }

    case "math_science": {
      return buildDecisionForModel(models.anthropic.opus, {
        activityState,
        domain,
        reason: "Claude Opus selected for formal mathematics, physics, and multi-step derivation",
        changedMaterially,
      });
    }

    case "research": {
      return buildDecisionForModel(models.google.pro, {
        activityState,
        domain,
        reason: "Gemini Pro selected for long-context synthesis and multi-source research",
        changedMaterially,
      });
    }

    case "creative": {
      const creativeModel =
        activityState === "reviewing" ? models.openai.flagship : models.anthropic.sonnet;

      return buildDecisionForModel(creativeModel, {
        activityState,
        domain,
        reason: "Selected expressive ZDR model for nuanced creative writing and tone control",
        changedMaterially,
      });
    }
  }
}

/**
 * Stage 2 — ZDR Model Picker.
 * Picks the optimal catalog model from Organic's ZDR-compatible catalog while preserving
 * `selectedSelectorId: "auto"`.
 */
export function selectAutoRouteModel(
  input: AutoModelRouteInput,
  options?: SelectAutoRouteModelOptions
): SyncAndAsyncResult<AutoModelRouteDecision> {
  const syncDecision = selectAutoRouteModelSync(input);

  if (input.activityState === "disconnected") {
    return attachSyncFields(Promise.resolve(syncDecision), syncDecision);
  }

  const generatePicker =
    options?.generatePicker ??
    (options?.useLivePicker
      ? async (args) => {
          const res = await generateObject({
            model: args.model,
            instructions: args.system,
            prompt: args.prompt,
            schema: args.schema,
            providerOptions: args.providerOptions,
            maxOutputTokens: 160,
          });

          return { object: res.object, usage: res.usage };
        }
      : undefined);

  if (!generatePicker) {
    return attachSyncFields(Promise.resolve(syncDecision), syncDecision);
  }

  const asyncPromise = (async (): Promise<AutoModelRouteDecision> => {
    try {
      const allowedCandidates = [
        models.anthropic.haiku,
        models.google.flashLite,
        models.anthropic.sonnet,
        models.anthropic.opus,
        models.google.pro,
        models.openai.flagship,
        models.openai.sol,
      ].filter((m) => m.supportsZeroDataRetention !== false);

      const system = [
        "You are Organic LLM's Stage-2 ZDR Auto-Model Picker.",
        "Select the single best model id from the allowed list based on the user's draft, activity state, and active tools.",
        "Allowed models:",
        ...allowedCandidates.map((m) => `- ${m.id} (${m.name})`),
      ].join("\n");

      const prompt = [
        `Activity state: ${input.activityState ?? "typing"}`,
        `Web search: ${Boolean(input.webSearch)}`,
        `Memory: ${Boolean(input.memory)}`,
        `Experience: ${input.experience ?? "main"}`,
        `Previous model: ${input.previousModelId ?? "none"}`,
        `Draft: ${input.text.slice(-800)}`,
      ].join("\n");

      const { object } = await generatePicker({
        model: AUTO_PICKER_GATEWAY_MODEL_ID,
        system,
        prompt,
        providerOptions: AUTO_ROUTER_ZDR_PROVIDER_OPTIONS,
        schema: PickerSchema,
      });

      const picked = chatModelById(object.routedModelId);

      if (
        !picked ||
        picked.id === AUTO_CHAT_MODEL_ID ||
        picked.supportsZeroDataRetention === false
      ) {
        return syncDecision;
      }

      return buildDecisionForModel(picked, {
        activityState: input.activityState ?? "typing",
        domain: object.domain,
        reason: object.reason,
        changedMaterially: input.changedMaterially ?? true,
      });
    } catch {
      return syncDecision;
    }
  })();

  return attachSyncFields(asyncPromise, syncDecision);
}

export interface RouteAutoModelOptions
  extends EvaluateAutoModelChangeGateOptions,
    SelectAutoRouteModelOptions {}

/**
 * Full Two-Stage ZDR Auto-Model Pipeline:
 * - Runs Stage 1 (`evaluateAutoModelChangeGate`) to check if the draft shifted materially.
 * - If `shouldReroute` is false and a valid `previousModelId` exists, holds the previous model
 *   with `changedMaterially: false`.
 * - Otherwise runs Stage 2 (`selectAutoRouteModel`) to pick the optimal ZDR catalog model.
 */
export function routeAutoModel(
  input: AutoModelRouteInput,
  options?: RouteAutoModelOptions
): SyncAndAsyncResult<AutoModelRouteDecision> {
  const gateSync = evaluateAutoModelChangeGateSync({
    text: input.text,
    previousText: input.previousText,
    activityState: input.activityState,
    previousActivityState: input.previousActivityState,
    webSearch: input.webSearch,
    previousWebSearch: input.previousWebSearch,
    memory: input.memory,
    previousMemory: input.previousMemory,
    hasAttachments: input.hasAttachments,
  });

  let syncDecision: AutoModelRouteDecision;

  if (!gateSync.shouldReroute && input.previousModelId) {
    const prevModel = chatModelById(input.previousModelId);

    if (
      prevModel &&
      prevModel.id !== AUTO_CHAT_MODEL_ID &&
      prevModel.supportsZeroDataRetention !== false
    ) {
      syncDecision = buildDecisionForModel(prevModel, {
        activityState: input.activityState ?? "typing",
        domain: gateSync.domainShift,
        reason: "Held current Auto route (draft change below material threshold)",
        changedMaterially: false,
      });
    } else {
      syncDecision = selectAutoRouteModelSync({
        ...input,
        domainOverride: gateSync.domainShift,
        changedMaterially: gateSync.shouldReroute,
      });
    }
  } else {
    syncDecision = selectAutoRouteModelSync({
      ...input,
      domainOverride: gateSync.domainShift,
      changedMaterially: gateSync.shouldReroute,
    });
  }

  if (
    !options?.generateGate &&
    !options?.useLiveJev &&
    !options?.generatePicker &&
    !options?.useLivePicker
  ) {
    return attachSyncFields(Promise.resolve(syncDecision), syncDecision);
  }

  const asyncPromise = (async (): Promise<AutoModelRouteDecision> => {
    const gate = await evaluateAutoModelChangeGate(
      {
        text: input.text,
        previousText: input.previousText,
        activityState: input.activityState,
        previousActivityState: input.previousActivityState,
        webSearch: input.webSearch,
        previousWebSearch: input.previousWebSearch,
        memory: input.memory,
        previousMemory: input.previousMemory,
        hasAttachments: input.hasAttachments,
      },
      options
    );

    if (!gate.shouldReroute && input.previousModelId) {
      const prevModel = chatModelById(input.previousModelId);

      if (
        prevModel &&
        prevModel.id !== AUTO_CHAT_MODEL_ID &&
        prevModel.supportsZeroDataRetention !== false
      ) {
        return buildDecisionForModel(prevModel, {
          activityState: input.activityState ?? "typing",
          domain: gate.domainShift,
          reason: "Held current Auto route (draft change below material threshold)",
          changedMaterially: false,
        });
      }
    }

    return selectAutoRouteModel(
      {
        ...input,
        domainOverride: gate.domainShift,
        changedMaterially: gate.shouldReroute,
      },
      options
    );
  })();

  return attachSyncFields(asyncPromise, syncDecision);
}
