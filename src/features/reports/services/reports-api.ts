import { useState, useEffect } from "react";

interface Report {
  id: string;
  githubRepositoryName: string;
  githubProjectId: number;
  startDate: string;
  endDate: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
}

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function fetchReports() {
      try {
        setIsFetching(true);
        setHasError(false);
        
        const response = await fetch("/api/reports");
        
        if (!response.ok) {
          throw new Error(`Failed to fetch reports: ${response.statusText}`);
        }
        
        const data = await response.json();
        setReports(data);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setHasError(true);
      } finally {
        setIsFetching(false);
      }
    }

    fetchReports();
  }, []);

  return { reports, isFetching, hasError };
}
