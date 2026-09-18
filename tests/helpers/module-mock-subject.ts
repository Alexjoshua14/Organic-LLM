/**
 * Stand-in module for `tests/unit/module-mock.test.ts`. Nothing else imports it, so mocking
 * it cannot disturb another test file even if the restore under test regresses.
 */
export function subjectGreeting(): string {
  return "real-greeting";
}

export function subjectFarewell(): string {
  return "real-farewell";
}
