/**
 * True, sourced tidbits the assistant may share when asked or clearly invited. Each one was
 * checked against its source on 2026-09-30. Add facts only with a source; never paraphrase a
 * fact into something stronger than its source says.
 */
export type SourcedFact = { fact: string; source: string };

export const ACRYLIC_FACTS: readonly SourcedFact[] = [
  {
    fact: "Three of the Grumbacher Academy tubes on this palette — Raw Umber, Grumbacher Red and Ultramarine Blue — contain ivory black (PBk9) in their formulas, which is why they read deeper than single-pigment versions.",
    source: "https://www.dickblick.com/items/grumbacher-academy-acrylics-raw-umber-90-ml-tube/",
  },
  {
    fact: "Grumbacher Red is naphthol red AS-D (PR112). Naphthol reds came out of the German chemical company Hoechst before World War I and reached artists' paints in the 1920s.",
    source:
      "https://www.dickblick.com/items/grumbacher-academy-acrylics-grumbacher-red-90-ml-tube/",
  },
  {
    fact: "Umber is a natural earth of iron and manganese oxides and one of the oldest pigments known. Its name is traced either to Umbria in Italy or to the Latin umbra, 'shadow' — scholars disagree.",
    source: "https://en.wikipedia.org/wiki/Umber",
  },
  {
    fact: "In 1824 the French Société d'Encouragement offered 6,000 francs for a synthetic ultramarine to replace pigment ground from lapis lazuli. Jean-Baptiste Guimet won it with his process in 1828.",
    source: "https://en.wikipedia.org/wiki/Jean-Baptiste_Guimet",
  },
  {
    fact: "Quinacridone was first synthesised in 1896, but DuPont only recognised it as a pigment in the 1950s and began selling quinacridone pigments in 1958 — first for car paint, later for artists.",
    source: "https://en.wikipedia.org/wiki/Quinacridone",
  },
  {
    fact: "Magenta is named after the Battle of Magenta in Italy (1859), the year the aniline dye of that colour appeared.",
    source: "https://en.wikipedia.org/wiki/Magenta",
  },
  {
    fact: "Phthalocyanine pigments came from accidental laboratory discoveries in the late 1920s, including at Scottish Dyes in Grangemouth; industrial production of the blue began in 1935. Phthalo green is the same molecule with most of its hydrogen replaced by chlorine.",
    source: "https://en.wikipedia.org/wiki/Phthalocyanine",
  },
  {
    fact: "Artists' acrylics began as Magna, a solvent-based acrylic resin paint that Leonard Bocour and Sam Golden developed in the late 1940s. Water-based acrylic artists' paint followed in the mid-1950s with Liquitex.",
    source: "https://en.wikipedia.org/wiki/Acrylic_paint",
  },
  {
    fact: "Wet acrylic looks lighter than it dries because the emulsion binder is milky when wet and clears as it dries — the 'colour shift' every acrylic painter mixes around.",
    source: "https://goldenartistcolors.com/resources/color-mixing-guide",
  },
  {
    fact: "Total solar eclipses happen because the Sun is about 400 times wider than the Moon but also about 400 times farther away, so both look about half a degree across.",
    source: "https://apod.nasa.gov/apod/ap990818.html",
  },
  {
    fact: "The red-pink rim seen around the Moon at totality is the Sun's chromosphere ('sphere of colour'), glowing in the hydrogen-alpha line at 656.3 nm. It is normally drowned out and only shows during a total eclipse — so a red rim on an eclipse has real physics behind it.",
    source: "https://en.wikipedia.org/wiki/Chromosphere",
  },
];
