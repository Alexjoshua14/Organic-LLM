import type { z } from "zod";

/**
 * A branch is one schema-bound step of an orchestrated LLM pattern: it takes a specific input,
 * validates it, does whatever it does inside (an LLM call, a Jev decision, plain math), and
 * returns a validated output. Pipelines compose branches and decide which ones run; the trace
 * records what ran, what was skipped and why, so a reducer's result can be explained.
 */
export type Branch<I, O> = {
  name: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  run: (input: I, context: BranchContext) => Promise<O>;
};

export type BranchTraceEntry = {
  branch: string;
  status: "ran" | "skipped" | "failed";
  ms: number;
  /** Why a branch was skipped or failed; Jev gates put their reason here. */
  reason?: string;
};

export type BranchContext = {
  signal?: AbortSignal;
  trace: BranchTraceEntry[];
};

export class BranchError extends Error {
  constructor(
    readonly branch: string,
    readonly stage: "input" | "run" | "output",
    cause: unknown
  ) {
    super(
      `Branch ${branch} failed at ${stage}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "BranchError";
  }
}

export function defineBranch<I, O>(branch: Branch<I, O>): Branch<I, O> {
  return branch;
}

export function createBranchContext(signal?: AbortSignal): BranchContext {
  return { signal, trace: [] };
}

/** Validates the input, runs the branch, validates the output, and records the trace entry. */
export async function runBranch<I, O>(
  branch: Branch<I, O>,
  input: I,
  context: BranchContext
): Promise<O> {
  const started = performance.now();
  const fail = (stage: "input" | "run" | "output", cause: unknown): never => {
    const error = new BranchError(branch.name, stage, cause);

    context.trace.push({
      branch: branch.name,
      status: "failed",
      ms: Math.round(performance.now() - started),
      reason: error.message.slice(0, 300),
    });
    throw error;
  };

  const parsedInput = branch.input.safeParse(input);

  if (!parsedInput.success) return fail("input", parsedInput.error);

  let raw: unknown;

  try {
    context.signal?.throwIfAborted();
    raw = await branch.run(parsedInput.data, context);
  } catch (error) {
    return fail("run", error);
  }

  const parsedOutput = branch.output.safeParse(raw);

  if (!parsedOutput.success) return fail("output", parsedOutput.error);

  context.trace.push({
    branch: branch.name,
    status: "ran",
    ms: Math.round(performance.now() - started),
  });

  return parsedOutput.data;
}

export function skipBranch(name: string, reason: string, context: BranchContext): null {
  context.trace.push({ branch: name, status: "skipped", ms: 0, reason });

  return null;
}
