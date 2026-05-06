"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormStore } from "@/store/form";
import { GitHubRepository, GitHubCommit } from "../../actions/github";
import { GitBranch, ArrowLeft, Book, Loader2 } from "lucide-react";
import { processCommitsForAiReport } from "@/lib/utils";

interface SettingsClientPageProps {
  initialBranches: string[];
  initialRepository: GitHubRepository | null;
  initialCommits: GitHubCommit[];
}

// TODO: Update types and remove unused props
export default function SettingsClientPage({
  initialBranches,
  initialRepository,
  initialCommits,
}: SettingsClientPageProps) {
  const router = useRouter();
  const {
    selectedRepository,
    selectedBranch,
    branches,
    startDate,
    endDate,
    isLoading,
    setSelectedRepository,
    setSelectedBranch,
    setBranches,
    setDateRange,
    setIsLoading,
  } = useFormStore();

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialRepository) {
      setSelectedRepository(initialRepository);
    }
    if (initialBranches.length > 0) {
      setBranches(initialBranches);

      if (initialBranches.includes("main")) {
        setSelectedBranch("main");
      } else if (initialBranches.includes("master")) {
        setSelectedBranch("master");
      } else {
        setSelectedBranch(initialBranches[0]);
      }
    }
  }, [
    initialRepository,
    initialBranches,
    setSelectedRepository,
    setBranches,
    setSelectedBranch,
  ]);

  useEffect(() => {
    if (!endDate) {
      const today = new Date().toISOString().split("T")[0];
      setDateRange(startDate, today);
    }
  }, [startDate, endDate, setDateRange]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!startDate) {
      errors.startDate = "Start date is required";
    }

    if (endDate && startDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        errors.endDate = "End date must be after or equal to start date";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerateReport = async () => {
    if (!validateForm()) {
      return;
    }

    if (!selectedRepository || !selectedBranch) {
      alert("Please select a branch");
      return;
    }

    setIsLoading(true);

    try {
      const finalEndDate = endDate || new Date().toISOString().split("T")[0];
      console.log("Generating report with data:", {
        repository: selectedRepository.name,
        startDate,
        endDate: finalEndDate,
        branch: selectedBranch,
      });

      try {
        const commitsResponse = await fetch(
          `/api/commits?owner=${selectedRepository.owner.login}&repo=${selectedRepository.name}&limit=100&startDate=${startDate}&endDate=${finalEndDate}`
        );
        
        if (!commitsResponse.ok) {
          throw new Error('Failed to fetch commits');
        }
        
        const { commits } = await commitsResponse.json() as { commits: GitHubCommit[] };

        console.log("Sending report request with data:", {
          repository: selectedRepository.name,
          branch: selectedBranch,
          startDate,
          endDate: finalEndDate,
          commitsCount: commits.length,
          commits: commits.slice(0, 3).map(c => ({ author: c.commit.author?.name, message: c.commit.message.split('\n')[0] }))
        });

        // Generate business report
        const response = await fetch("/api/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              repository: selectedRepository.name,
              branch: selectedBranch,
              startDate,
              endDate: finalEndDate,
              commits: processCommitsForAiReport(commits),
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API response not ok:", errorText);
          throw new Error(`Failed to generate report: ${errorText}`);
        }

        const data = await response.json();
        console.log("Report generation successful:", data);

        if (selectedRepository) {
          router.push(
            `/new/report?reportId=${data.reportId}`,
          );
        }
      } catch (error) {
        console.error("Report generation error:", error);
        throw new Error(`Failed to generate report: ${error.message}`);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/new");
  };

  if (!selectedRepository) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No repository selected</h3>
            <p className="text-muted-foreground mb-4">
              Please select a repository first.
            </p>
            <Button onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Repository Selection
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleBack} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold mb-2">Report Settings</h1>
            <p className="text-muted-foreground text-sm">
              Configure the report for {selectedRepository.name}
            </p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-muted rounded-full">
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm text-muted-foreground">
                    Selected Repository
                  </p>
                  <p className="text-base font-medium">
                    {selectedRepository.name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => {
                      setDateRange(e.target.value, endDate);
                      if (formErrors.startDate) {
                        setFormErrors((prev: Record<string, string>) => {
                          const newErrors = { ...prev };
                          delete newErrors.startDate;
                          return newErrors;
                        });
                      }
                    }}
                    className={`w-full p-2 border rounded-md bg-background mt-2 ${
                      formErrors.startDate ? "border-red-500" : "border-input"
                    }`}
                  />
                  {formErrors.startDate && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.startDate}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="endDate"
                    className="text-muted-foreground text-xs"
                  >
                    End Date (optional, defaults to today)
                  </Label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => {
                      setDateRange(startDate, e.target.value);
                      if (formErrors.endDate) {
                        setFormErrors((prev: Record<string, string>) => {
                          const newErrors = { ...prev };
                          delete newErrors.endDate;
                          return newErrors;
                        });
                      }
                    }}
                    className={`w-full p-2 border rounded-md bg-background mt-2 ${
                      formErrors.endDate ? "border-red-500" : "border-input"
                    }`}
                  />
                  {formErrors.endDate && (
                    <p className="text-red-500 text-sm mt-1">
                      {formErrors.endDate}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="branch">Select Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="mt-2 min-w-64">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 mx-auto w-fit">
              <Button
                onClick={handleGenerateReport}
                disabled={!startDate || !selectedBranch || isLoading}
                className="max-w-72"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Book className="mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
