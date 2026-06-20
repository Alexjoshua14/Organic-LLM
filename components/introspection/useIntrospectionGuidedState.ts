"use client";

import { useCallback, useState } from "react";

import type { IntrospectionGuidedState } from "@/lib/schemas/introspection";

export function useIntrospectionGuidedState(initial: IntrospectionGuidedState) {
  const [guidedState, setGuidedState] = useState<IntrospectionGuidedState>(initial);

  const applyViewUpdate = useCallback((next: IntrospectionGuidedState) => {
    setGuidedState(next);
  }, []);

  const stepIndex = guidedState.steps?.findIndex((s) => s.id === guidedState.currentStepId) ?? -1;

  const canGoBack = stepIndex > 0;
  const canGoNext =
    guidedState.stepComplete &&
    guidedState.steps != null &&
    stepIndex >= 0 &&
    stepIndex < guidedState.steps.length - 1;

  const goBack = useCallback(() => {
    if (!guidedState.steps || stepIndex <= 0) return;

    const prev = guidedState.steps[stepIndex - 1];

    setGuidedState((s) => ({
      ...s,
      currentStepId: prev.id,
      stepComplete: false,
      breadcrumb: s.breadcrumb.slice(0, -1),
    }));
  }, [guidedState.steps, stepIndex]);

  const goNext = useCallback(() => {
    if (!guidedState.steps || !canGoNext) return;

    const nextStep = guidedState.steps[stepIndex + 1];

    setGuidedState((s) => ({
      ...s,
      currentStepId: nextStep.id,
      stepComplete: false,
      breadcrumb: [...s.breadcrumb.slice(0, 1), nextStep.title],
    }));
  }, [canGoNext, guidedState.steps, stepIndex]);

  return {
    guidedState,
    applyViewUpdate,
    stepIndex,
    canGoBack,
    canGoNext,
    goBack,
    goNext,
  };
}
