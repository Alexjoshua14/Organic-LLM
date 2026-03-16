"use server";

import { getChats } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { Result } from "@/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/remy/thread-matching.ts");

/**
 * Normalizes text for comparison by:
 * - Converting to lowercase
 * - Removing special characters
 * - Removing extra whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts date from text (e.g., "1/8/25", "1/8/2025", "January 8, 2025")
 * Returns the matched date string if found, null otherwise
 */
function extractDate(text: string): string | null {
  // Try to match common date patterns
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/, // 1/8/25 or 1/8/2025
    /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/, // 1-8-25
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i, // January 8, 2025
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);

    if (match) {
      // Return the first capturing group or the full match
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * Normalizes a date string for comparison
 * Converts various formats to a standard format (M/D/YY)
 */
function normalizeDate(dateStr: string): string {
  // Try to parse and normalize the date
  try {
    // Handle formats like "1/8/25" or "1/8/2025"
    const parts = dateStr.split(/[\/\-]/);

    if (parts.length === 3) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);

      // Convert 4-digit year to 2-digit
      if (year > 100) {
        year = year % 100;
      }

      return `${month}/${day}/${year}`;
    }
  } catch (e) {
    // If parsing fails, return original
  }

  return dateStr;
}

/**
 * Formats current date to match common patterns in thread titles
 */
function getCurrentDateFormats(): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const shortYear = year % 100;

  return [
    `${month}/${day}/${shortYear}`, // 1/8/25
    `${month}/${day}/${year}`, // 1/8/2025
    `${month}-${day}-${shortYear}`, // 1-8-25
    `${month}-${day}-${year}`, // 1-8-2025
  ];
}

/**
 * Calculates semantic similarity between two strings
 * Returns a score between 0 and 1
 */
function calculateSimilarity(text1: string, text2: string): number {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }

  // Split into words and calculate word overlap
  const words1 = new Set(normalized1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(normalized2.split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  // Jaccard similarity
  const jaccard = intersection.size / union.size;

  // Boost score if key words match
  const keyWords1 = Array.from(words1).filter(
    (w) => !["the", "for", "with", "and", "or", "but"].includes(w)
  );
  const keyWords2 = Array.from(words2).filter(
    (w) => !["the", "for", "with", "and", "or", "but"].includes(w)
  );

  const keyWordMatches = keyWords1.filter((w) => keyWords2.includes(w)).length;
  const maxKeyWords = Math.max(keyWords1.length, keyWords2.length);
  const keyWordScore = maxKeyWords > 0 ? keyWordMatches / maxKeyWords : 0;

  // Combine Jaccard and keyword scores
  return Math.max(jaccard, keyWordScore * 0.7);
}

/**
 * Checks if a thread title semantically matches a query
 * Considers:
 * - Text similarity
 * - Date matching (if dates are present)
 */
export async function matchesThread(
  threadTitle: string | null,
  query: string,
  currentDate?: Date
): Promise<boolean> {
  if (!threadTitle) {
    return false;
  }

  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(threadTitle);

  // Check text similarity
  const similarity = calculateSimilarity(normalizedQuery, normalizedTitle);

  // Check date matching if dates are present
  const queryDate = extractDate(query);
  const titleDate = extractDate(threadTitle);

  if (queryDate && titleDate) {
    // If both have dates, normalize and compare them
    const normalizedQueryDate = normalizeDate(queryDate);
    const normalizedTitleDate = normalizeDate(titleDate);

    if (normalizedQueryDate === normalizedTitleDate) {
      // Dates match, require lower similarity threshold
      return similarity >= 0.4;
    } else {
      // Dates don't match, require higher similarity
      return similarity >= 0.7;
    }
  } else if (titleDate && currentDate) {
    // If title has a date, check if it matches today
    const currentDateFormats = getCurrentDateFormats();
    const normalizedTitleDate = normalizeDate(titleDate);
    const titleMatchesToday = currentDateFormats.some((fmt) => {
      const normalizedFmt = normalizeDate(fmt);

      return normalizedTitleDate === normalizedFmt;
    });

    if (titleMatchesToday) {
      // Title date matches today, require lower similarity
      return similarity >= 0.5;
    } else {
      // Title date doesn't match today, require higher similarity
      return similarity >= 0.7;
    }
  } else {
    // No dates in either, just check similarity
    return similarity >= 0.6;
  }
}

/**
 * Fetches all Remy-related threads
 * For now, fetches all threads (we can refine this later to filter by persona)
 */
export async function getRemyThreads(): Promise<Result<Thread[]>> {
  try {
    const result = await getChats();

    if (result.error) {
      logger.error("getRemyThreads", `Error fetching threads: ${result.error.message}`);

      return result;
    }

    // For now, return all threads
    // TODO: Filter by persona or add a way to identify Remy threads
    return {
      data: result.data ?? [],
      error: null,
    };
  } catch (error) {
    logger.error(
      "getRemyThreads",
      `Error fetching Remy threads: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}

/**
 * Finds a matching thread for a given query
 * Returns the thread ID if a match is found, null otherwise
 */
export async function findMatchingThread(
  query: string,
  currentDate?: Date
): Promise<Result<string | null>> {
  try {
    const threadsResult = await getRemyThreads();

    if (threadsResult.error || !threadsResult.data) {
      return {
        data: null,
        error: threadsResult.error ?? new Error("Failed to fetch threads"),
      };
    }

    const threads = threadsResult.data;
    const date = currentDate ?? new Date();

    // Find the best matching thread
    let bestMatch: { thread: Thread; score: number } | null = null;

    for (const thread of threads) {
      if (await matchesThread(thread.title ?? null, query, date)) {
        const similarity = calculateSimilarity(
          normalizeText(query),
          normalizeText(thread.title ?? "")
        );

        if (!bestMatch || similarity > bestMatch.score) {
          bestMatch = { thread, score: similarity };
        }
      }
    }

    if (bestMatch) {
      logger.log(
        "findMatchingThread",
        `Found matching thread: ${bestMatch.thread.id} (${bestMatch.thread.title}) with score ${bestMatch.score}`
      );

      return {
        data: bestMatch.thread.id,
        error: null,
      };
    }

    return {
      data: null,
      error: null,
    };
  } catch (error) {
    logger.error(
      "findMatchingThread",
      `Error finding matching thread: ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
    };
  }
}
