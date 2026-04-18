import type { EncryptionContext, EncryptionFieldName } from "@/lib/crypto/message-encryption";
import { decryptFromStorage, encryptForStorage } from "@/lib/crypto/message-encryption";
import type { StrataSectionKey } from "@/lib/schemas/strata";

const FIELD_BY_SECTION: Record<StrataSectionKey, EncryptionFieldName> = {
  raw_text: "strata_sections.raw_text",
  refined_text: "strata_sections.refined_text",
  elaborated: "strata_sections.elaborated",
  design_instructions: "strata_sections.design_instructions",
  ai_instructions: "strata_sections.ai_instructions",
};

function strataEncryptionContext(ownerId: string, pageId: string, sectionKey: StrataSectionKey): EncryptionContext {
  return {
    userId: ownerId,
    threadId: pageId,
    fieldName: FIELD_BY_SECTION[sectionKey],
  };
}

export function decryptStrataSectionContent(
  stored: string,
  ownerId: string,
  pageId: string,
  sectionKey: StrataSectionKey
): string {
  return decryptFromStorage(stored, strataEncryptionContext(ownerId, pageId, sectionKey));
}

export function encryptStrataSectionContent(
  plaintext: string,
  ownerId: string,
  pageId: string,
  sectionKey: StrataSectionKey
): string {
  return encryptForStorage(plaintext, strataEncryptionContext(ownerId, pageId, sectionKey));
}
