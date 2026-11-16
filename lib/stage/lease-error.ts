/** A Stage writer's lease expired or passed to another worker, so its save was refused. */
export class StageLeaseLostError extends Error {
  constructor() {
    super("Stage generation lease expired");
    this.name = "StageLeaseLostError";
  }
}
