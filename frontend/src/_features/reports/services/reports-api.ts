"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, errorMessage, unwrap } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { paths } from "@/src/shared/api/types";

export type ReportSchedule =
  paths["/api/v1/report-schedules"]["get"]["responses"][200]["content"]["application/json"]["schedules"][number];

export type ReportSummary =
  paths["/api/v1/reports"]["get"]["responses"][200]["content"]["application/json"]["reports"][number];

export type ReportDetail =
  paths["/api/v1/reports/{id}"]["get"]["responses"][200]["content"]["application/json"];

export type CreateReportScheduleInput =
  paths["/api/v1/report-schedules"]["post"]["requestBody"]["content"]["application/json"];

export type UpdateReportScheduleInput =
  paths["/api/v1/report-schedules/{id}"]["patch"]["requestBody"]["content"]["application/json"];

export function useReportSchedules() {
  const query = useQuery({
    queryKey: queryKeys.reportSchedules.list,
    queryFn: () =>
      unwrap(apiClient.GET("/api/v1/report-schedules")),
    refetchInterval: (query) => {
      const schedules = query.state.data?.schedules ?? [];
      return schedules.some((schedule) => schedule.lastStatus === "running")
        ? 3000
        : false;
    },
  });

  return {
    schedules: query.data?.schedules ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useReports(limit = 20) {
  const query = useQuery({
    queryKey: queryKeys.reports.list,
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/reports", {
          params: { query: { limit } },
        }),
      ),
  });

  return {
    reports: query.data?.reports ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}

export function useReport(id: string | null) {
  const query = useQuery({
    queryKey: queryKeys.reports.detail(id ?? ""),
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/reports/{id}", {
          params: { path: { id: id ?? "" } },
        }),
      ),
    enabled: !!id,
  });

  return {
    report: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}

export function useCreateReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReportScheduleInput) =>
      unwrap(
        apiClient.POST("/api/v1/report-schedules", {
          body: input,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reportSchedules.all,
      });
      toast.success("Schedule created");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to create schedule"));
    },
  });
}

export function useUpdateReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      id: string;
      schedule: UpdateReportScheduleInput;
    }) =>
      unwrap(
        apiClient.PATCH("/api/v1/report-schedules/{id}", {
          params: { path: { id: input.id } },
          body: input.schedule,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reportSchedules.all,
      });
      toast.success("Schedule updated");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to update schedule"));
    },
  });
}

export function useDeleteReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.DELETE("/api/v1/report-schedules/{id}", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reportSchedules.all,
      });
      toast.success("Schedule deleted");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to delete schedule"));
    },
  });
}

export function useRunReportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        apiClient.POST("/api/v1/report-schedules/{id}/run", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reportSchedules.all,
      });
      toast.success("Summary run started");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Failed to run schedule"));
    },
  });
}
