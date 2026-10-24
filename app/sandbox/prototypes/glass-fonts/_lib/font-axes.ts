export type FontFamilyId = "satoshi" | "inter" | "commissioner";

export type AxisId = "wght" | "opsz" | "FLAR" | "VOLM" | "slnt";

export type AxisDefinition = {
  id: AxisId;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: string;
};

export const FONT_FAMILIES: Array<{
  id: FontFamilyId;
  name: string;
  className: string;
  note: string;
}> = [
  {
    id: "satoshi",
    name: "Satoshi",
    className: "font-satoshi",
    note: "Default Organic LLM body voice",
  },
  {
    id: "inter",
    name: "Inter",
    className: "[font-family:var(--font-inter)]",
    note: "Neutral interface benchmark",
  },
  {
    id: "commissioner",
    name: "Commissioner",
    className: "font-commissioner",
    note: "Editorial display candidate",
  },
];

export const FAMILY_AXIS_DEFINITIONS: Record<FontFamilyId, AxisDefinition[]> = {
  satoshi: [
    {
      id: "wght",
      label: "Weight",
      min: 300,
      max: 900,
      step: 100,
      defaultValue: 400,
      description: "Static weight steps available in local Satoshi files.",
    },
  ],
  inter: [
    {
      id: "wght",
      label: "Weight",
      min: 100,
      max: 900,
      step: 1,
      defaultValue: 400,
      description: "Primary readability contrast axis.",
    },
    {
      id: "opsz",
      label: "Optical size",
      min: 14,
      max: 32,
      step: 0.1,
      defaultValue: 14,
      description: "Fine-tunes rhythm at different display sizes.",
    },
  ],
  commissioner: [
    {
      id: "wght",
      label: "Weight",
      min: 100,
      max: 900,
      step: 1,
      defaultValue: 360,
      description: "Sets overall darkness and typographic authority.",
    },
    {
      id: "FLAR",
      label: "Flare",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 0,
      description: "Adds stem flare and more expressive terminals.",
    },
    {
      id: "VOLM",
      label: "Volume",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 0,
      description: "Builds wedge-like volume onto flared details.",
    },
    {
      id: "slnt",
      label: "Slant",
      min: -12,
      max: 0,
      step: 0.1,
      defaultValue: 0,
      description: "Leans glyphs for tempo and emphasis.",
    },
  ],
};

export type FamilyAxisValues = Partial<Record<AxisId, number>>;

export function defaultAxisValuesForFamily(family: FontFamilyId): FamilyAxisValues {
  const axes = FAMILY_AXIS_DEFINITIONS[family];

  return Object.fromEntries(axes.map((axis) => [axis.id, axis.defaultValue]));
}

export function buildFontVariationSettings(
  family: FontFamilyId,
  values: FamilyAxisValues | undefined
): string | undefined {
  if (!values) return undefined;
  const defs = FAMILY_AXIS_DEFINITIONS[family];
  const parts = defs
    .filter((axis) => values[axis.id] !== undefined)
    .map((axis) => `"${axis.id}" ${values[axis.id]}`);

  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function familyClassName(family: FontFamilyId): string {
  return FONT_FAMILIES.find((item) => item.id === family)?.className ?? "font-satoshi";
}

export function familyDisplayName(family: FontFamilyId): string {
  return FONT_FAMILIES.find((item) => item.id === family)?.name ?? "Satoshi";
}
