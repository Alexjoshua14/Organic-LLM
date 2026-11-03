"use client";

import type { ReactNode } from "react";

import { useAuth } from "@clerk/nextjs";
import { createContext, createElement, useContext } from "react";
import useSWR from "swr";

import { getGatewayVisibilityForCurrentUser } from "@/data/supabase/gateway-visibility";

const GATEWAY_REVALIDATION_WINDOW_MS = 60_000;
const GATEWAY_RETRY_INTERVAL_MS = 5_000;
const GATEWAY_RETRY_COUNT = 2;

type GatewayVisibilityKey = readonly ["gateway-visibility", string, string];

const fetchVisibility = ([, userId, sessionId]: GatewayVisibilityKey) =>
  getGatewayVisibilityForCurrentUser({ userId, sessionId });

/** The server's answer for the signed-in user at render time (see `resolveInitialGatewayVisibility`). */
export type InitialGatewayVisibility = { userId: string; visible: boolean };

const InitialGatewayVisibilityContext = createContext<InitialGatewayVisibility | null>(null);

/**
 * Seeds `useGatewayVisibility` with the root layout's server read, so admin-only UI renders on
 * the first paint. The client still revalidates, which corrects a stale seed.
 */
export function GatewayVisibilityProvider({
  initial,
  children,
}: {
  initial: InitialGatewayVisibility | null;
  children: ReactNode;
}) {
  return createElement(InitialGatewayVisibilityContext.Provider, { value: initial }, children);
}

/** Shared per-session UI hint. Protected operations must authorize independently on the server. */
export function useGatewayVisibility() {
  const { isLoaded, userId, sessionId } = useAuth();
  const initial = useContext(InitialGatewayVisibilityContext);
  const key: GatewayVisibilityKey | null =
    isLoaded && userId && sessionId ? ["gateway-visibility", userId, sessionId] : null;
  // Only trust the seed for the user it was read for; after a sign-in switch it's ignored.
  const seed = key && initial && initial.userId === userId ? initial.visible : undefined;
  const { data, error, isValidating, mutate } = useSWR<boolean, Error>(key, fetchVisibility, {
    fallbackData: seed,
    dedupingInterval: GATEWAY_REVALIDATION_WINDOW_MS,
    focusThrottleInterval: GATEWAY_REVALIDATION_WINDOW_MS,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    refreshInterval: 0,
    keepPreviousData: false,
    errorRetryCount: GATEWAY_RETRY_COUNT,
    errorRetryInterval: GATEWAY_RETRY_INTERVAL_MS,
  });

  return {
    visible: key ? (error ? false : (data ?? null)) : false,
    error,
    isValidating,
    refresh: mutate,
  };
}
