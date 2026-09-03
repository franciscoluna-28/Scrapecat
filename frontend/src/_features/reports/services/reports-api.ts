"use client";

import { useEffect, useState } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, API_URL } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { ReportDetail, ReportJob, ReportSummary, StoredCommit } from "@/src/shared/types";

export function useReports(projectId?: string, startDate?: string, endDate?: string) {
  const params: Record<string, string> = {};
  if (projectId) params.projectId = projectId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const query = Object.keys(params).length > 0 ? params : undefined;
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.reports.list(projectId, startDate, endDate),
    queryFn: () =>
      apiClient
        .GET("/api/v1/reports", {
          params: { query },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
  });

  return {
    reports: (data?.reports ?? []) as ReportSummary[],
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useReport(id: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.reports.detail(id),
    queryFn: () =>
      apiClient
        .GET("/api/v1/reports/{id}", {
          params: { path: { id } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!id,
  });

  return {
    report: (data ?? null) as ReportDetail | null,
    isLoading,
    error: error ?? null,
  };
}

/**
 * Live job status over SSE. SSE frames are written into the shared job query
 * cache, and a slow polling backstop refetches the persisted status so a
 * missed terminal event (e.g. a transition that raced the listener attach)
 * can never leave the UI stuck.
 */
export function useReportJobStream(jobId?: string) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const source = new EventSource(`${API_URL}/api/v1/reports/jobs/${jobId}/stream`);

    source.onopen = () => setConnected(true);
    source.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data) as ReportJob;
        queryClient.setQueryData(queryKeys.reports.job(jobId), state);
        if (state.status === "succeeded" || state.status === "failed") {
          source.close();
          setConnected(false);
        }
      } catch {
        // ignore malformed frames
      }
    };
    source.onerror = () => setConnected(false);

    return () => {
      source.close();
    };
  }, [jobId, queryClient]);

  const { data } = useQuery({
    queryKey: queryKeys.reports.job(jobId),
    queryFn: () =>
      apiClient
        .GET("/api/v1/reports/jobs/{jobId}", {
          params: { path: { jobId: jobId! } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "succeeded" || status === "failed" ? false : 5000;
    },
  });

  const job = (data ?? null) as ReportJob | null;

  // Only surface events for the requested job — a stale frame from a previous
  // job (or a disabled hook) must never be mistaken for the active one.
  const activeJob = job && job.jobId === jobId ? job : null;

  return { job: activeJob, connected: activeJob ? connected : false };
}

export function useReportCommitsInfinite(id: string, q?: string) {
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.reports.commits(id, q),
    queryFn: ({ pageParam }) =>
      apiClient
        .GET("/api/v1/reports/{id}/commits", {
          params: {
            path: { id },
            query: {
              limit: 50,
              ...(q ? { q } : {}),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!id,
  });

  return {
    commits: (data?.pages.flatMap((p) => p.commits) ?? []) as StoredCommit[],
    total: data?.pages[0]?.total ?? null,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: error ?? null,
  };
}
