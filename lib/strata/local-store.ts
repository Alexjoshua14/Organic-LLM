"use client";

import {
  buildDefaultStrataSections,
  buildStrataPageDefaults,
  type StrataPage,
  type StrataPageWithSections,
  type StrataSectionKey,
} from "@/lib/schemas/strata";
import {
  decryptStrataSectionFromLocalStorage,
  encryptStrataSectionForLocalStorage,
} from "@/lib/crypto/strata-local-encryption";

const LOCAL_PAGES_KEY = "strata:pages:v1";
const LOCAL_PAGE_DATA_PREFIX = "strata:page-data:v1:";
const LOCAL_ZDR_MODE_PREFIX = "strata:zdr-mode:v1:";

type LocalPageData = {
  page: StrataPage;
  sections: Record<StrataSectionKey, { content: string; contentJson: Record<string, unknown> | null }>;
};

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readLocalPagesIndex(): StrataPage[] {
  return safeParse<StrataPage[]>(globalThis.localStorage.getItem(LOCAL_PAGES_KEY)) ?? [];
}

function writeLocalPagesIndex(pages: StrataPage[]) {
  globalThis.localStorage.setItem(LOCAL_PAGES_KEY, JSON.stringify(pages));
}

function pageStorageKey(pageId: string): string {
  return `${LOCAL_PAGE_DATA_PREFIX}${pageId}`;
}

export function getLocalOnlyMode(pageId: string): boolean {
  return globalThis.localStorage.getItem(`${LOCAL_ZDR_MODE_PREFIX}${pageId}`) === "1";
}

export function setLocalOnlyMode(pageId: string, enabled: boolean): void {
  globalThis.localStorage.setItem(`${LOCAL_ZDR_MODE_PREFIX}${pageId}`, enabled ? "1" : "0");
}

export async function listLocalStrataPages(): Promise<StrataPage[]> {
  return readLocalPagesIndex().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function createLocalStrataPage(title?: string): Promise<StrataPageWithSections> {
  const pageId = `local-${crypto.randomUUID()}`;
  const pageDefaults = buildStrataPageDefaults(pageId, title?.trim() || "Untitled Strata page");
  await saveLocalStrataPage(pageDefaults);
  return pageDefaults;
}

export async function getLocalStrataPage(pageId: string): Promise<StrataPageWithSections | null> {
  const raw = safeParse<LocalPageData>(globalThis.localStorage.getItem(pageStorageKey(pageId)));
  if (!raw) return null;

  const sections = buildDefaultStrataSections();
  for (const key of Object.keys(sections) as StrataSectionKey[]) {
    const stored = raw.sections[key];
    if (!stored) continue;
    const decryptedContent = await decryptStrataSectionFromLocalStorage(stored.content, {
      pageId,
      sectionKey: key,
    });
    sections[key] = {
      key,
      content: decryptedContent,
      contentJson: stored.contentJson ?? null,
    };
  }

  return {
    page: raw.page,
    sections,
  };
}

export async function saveLocalStrataPage(page: StrataPageWithSections): Promise<void> {
  const encryptedSections = {} as LocalPageData["sections"];
  for (const key of Object.keys(page.sections) as StrataSectionKey[]) {
    const section = page.sections[key];
    encryptedSections[key] = {
      content: await encryptStrataSectionForLocalStorage(section.content, {
        pageId: page.page.id,
        sectionKey: key,
      }),
      contentJson: section.contentJson ?? null,
    };
  }

  const now = new Date().toISOString();
  const nextPage: StrataPage = {
    ...page.page,
    updated_at: now,
  };

  globalThis.localStorage.setItem(
    pageStorageKey(page.page.id),
    JSON.stringify({
      page: nextPage,
      sections: encryptedSections,
    } satisfies LocalPageData)
  );

  const pages = readLocalPagesIndex();
  const withoutCurrent = pages.filter((p) => p.id !== nextPage.id);
  writeLocalPagesIndex([nextPage, ...withoutCurrent]);
}
