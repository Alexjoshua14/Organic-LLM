/**
 * Canon for the fictional project every feature demo shares. Demos import these facts rather
 * than restating them, so the memory in one page matches the plan in another. The visitor is
 * "you" — there is no named persona. Keep every claim accurate and every detail fictional
 * about the user; the places and astronomy are real.
 */

export const SHOWCASE_STORY = {
  project: "First Milky Way shoot",
  premise: "You're planning your first night photographing the Milky Way.",
  home: "San Francisco",
  gear: {
    camera: "full-frame mirrorless camera",
    lens: "24mm f/1.4 lens",
    focalLengthMm: 24,
  },
  /** Long-term memories the assistant has about you — the same list in every demo. */
  memories: [
    "Shoots on a full-frame mirrorless camera with a 24mm f/1.4 lens.",
    "New to astrophotography — prefers settings explained step by step.",
    "Based in San Francisco; keeps road trips under about four hours each way.",
    "Gets cold at night — always wants an extra warm layer on packing lists.",
  ],
  /** Dark-sky candidates for the plan. Drive times are approximate, from San Francisco. */
  sites: [
    {
      id: "pinnacles",
      name: "Pinnacles National Park",
      driveHours: 2.5,
      note: "International Dark Sky Park",
    },
    {
      id: "lassen",
      name: "Lassen Volcanic National Park",
      driveHours: 4.5,
      note: "International Dark Sky Park; longest drive",
    },
    {
      id: "point-reyes",
      name: "Point Reyes National Seashore",
      driveHours: 1.5,
      note: "Closest, with more Bay Area skyglow",
    },
  ],
  /** The plan the demos converge on. */
  choice: "pinnacles",
  timing: "the next new-moon weekend",
  /** Starting exposure the assistant recommends — consistent across voice, chat, and plans. */
  settings: {
    shutter: "about 20 seconds",
    shutterReason: "the 500 rule: 500 ÷ 24 mm ≈ 20 s before stars start to trail",
    aperture: "f/1.4 to f/2",
    iso: "ISO 3200",
    focus: "manual focus on a bright star, magnified in live view",
    format: "RAW",
  },
  /** Facts the research demo can draw on. */
  science: {
    coreDistance: "about 26,000 light-years away, toward Sagittarius",
    coreSeason: "roughly March through October from the Northern Hemisphere",
    moon: "a new moon keeps moonlight from washing out the fainter structure",
    bortle: "the Bortle scale rates sky darkness from 1 (darkest) to 9 (inner city)",
    skyglow:
      "skyglow is artificial light scattered by the atmosphere, which hides faint stars near cities",
  },
} as const;
