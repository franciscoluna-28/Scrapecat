'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitCommit, Calendar, GitBranch } from "lucide-react";

interface ReportClientPageProps {
  commits: any[];
  repository: any;
  startDate: string;
  endDate: string;
  branch: string;
}

export default function ReportClientPage({ 
  commits, 
  repository, 
  startDate, 
  endDate, 
  branch 
}: ReportClientPageProps) {
  
  const handleBack = () => {
    window.history.back();
  };

  if (!repository) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <GitCommit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No repository selected</h3>
            <p className="text-muted-foreground mb-4">
              Please select a repository first to generate a report.
            </p>
            <Button onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
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
            <h1 className="text-2xl font-semibold mb-2">Commit Report</h1>
            <p className="text-muted-foreground text-sm">
              Report for {repository.name} on {branch} branch
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Repository</p>
                  <p className="text-base">{repository.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Date Range</p>
                  <p className="text-base">
                    {startDate} to {endDate || 'Present'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Branch</p>
                  <p className="text-base">{branch}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t">
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-4">Commits ({commits.length})</h3>
              </div>
              
              <div className="space-y-4">
                {commits.length === 0 ? (
                  <div className="text-center py-8">
                    <GitCommit className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No commits found in this date range</p>
                  </div>
                ) : (
                  commits.map((commit: any, index: number) => (
                    <Card key={commit.sha || index} className="border-l-4 border-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0">
                            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                              <GitCommit className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-sm">{commit.commit?.author?.name || 'Unknown'}</p>
                              <span className="text-muted-foreground text-xs">
                                {new Date(commit.commit?.author?.date || commit.commit?.committer?.date).toLocaleDateString()}
                              </span>
                            </div>
                            
                            <h4 className="font-medium text-sm mb-2 text-blue-600">
                              {commit.commit?.message?.split('\n')[0] || 'No commit message'}
                            </h4>
                            
                            {commit.commit?.message?.split('\n').length > 1 && (
                              <p className="text-muted-foreground text-xs mt-1">
                                {commit.commit?.message?.split('\n').slice(1).join('\n')}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                              <div className="flex items-center gap-1">
                                <GitCommit className="h-3 w-3" />
                                <span>{commit.sha?.substring(0, 7)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(commit.commit?.author?.date || commit.commit?.committer?.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
