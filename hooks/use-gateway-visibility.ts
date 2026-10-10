"use client";

import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";

import { getGatewayVisibilityForCurrentUser } from "@/data/supabase/gateway-visibility";

const GATEWAY_REVALIDATION_WINDOW_MS = 60_000;
const GATEWAY_RETRY_INTERVAL_MS = 5_000;
const GATEWAY_RETRY_COUNT = 2;

type GatewayVisibilityKey = readonly ["gateway-visibility", string, string];

const fetchVisibility = ([, userId, sessionId]: GatewayVisibilityKey) =>
  getGatewayVisibilityForCurrentUser({ userId, sessionId });

/** Shared per-session UI hint. Protected operations must authorize independently on the server. */
export function useGatewayVisibility() {
  const { isLoaded, userId, sessionId } = useAuth();
  const key: GatewayVisibilityKey | null =
    isLoaded && userId && sessionId ? ["gateway-visibility", userId, sessionId] : null;
  const { data, error, isValidating, mutate } = useSWR<boolean, Error>(key, fetchVisibility, {
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
