"use server";

import type {
  FeedbackMutationInput,
  FeedbackNoteInput,
  RecordMemoryFeedbackInput,
  ShareFeedbackMemoryInput,
} from "@/lib/schemas/memory-quality";

import { feedbackService, withFeedbackUser } from "@/lib/memory/feedback";

export async function actionRecordMemoryFeedback(input: RecordMemoryFeedbackInput) {
  return withFeedbackUser((userId) => feedbackService.vote(userId, input));
}

export async function actionApproveFeedbackNote(input: FeedbackNoteInput) {
  return withFeedbackUser((userId) => feedbackService.approveNote(userId, input));
}

export async function actionRemoveFeedbackNote(input: FeedbackMutationInput) {
  return withFeedbackUser((userId) => feedbackService.removeNote(userId, input));
}

export async function actionRemoveMemoryFeedback(input: FeedbackMutationInput) {
  return withFeedbackUser((userId) => feedbackService.remove(userId, input));
}

export async function actionPreviewFeedbackMemory(input: FeedbackMutationInput) {
  return withFeedbackUser((userId) => feedbackService.previewMemory(userId, input));
}

export async function actionShareFeedbackMemory(input: ShareFeedbackMemoryInput) {
  return withFeedbackUser((userId) => feedbackService.shareMemory(userId, input));
}

export async function actionRemoveSharedFeedbackMemory(input: FeedbackMutationInput) {
  return withFeedbackUser((userId) => feedbackService.removeSharedMemory(userId, input));
}
