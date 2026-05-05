'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitCommit, Calendar, GitBranch, FileText, Users, TrendingUp } from "lucide-react";
import { useState } from "react";

interface ReportClientPageProps {
  commits: any[];
  repository: any;
  startDate: string;
  endDate: string;
  branch: string;
  technicalReport: string;
  executiveSummary: string;
}

export default function ReportClientPage({ 
  commits, 
  repository, 
  startDate, 
  endDate, 
  branch,
  technicalReport,
  executiveSummary
}: ReportClientPageProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'technical'>('summary');
  
  const handleBack = () => {
    window.history.back();
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for MVP
    return content
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2">$1</h3>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n\n/gim, '</p><p class="mb-4">')
      .replace(/\n/gim, '<br/>');
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
              {/* Tab Navigation */}
              <div className="flex space-x-1 mb-6 border-b">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'summary'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Executive Summary
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('technical')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'technical'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Technical Report
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === 'summary' && (
                  <div className="prose prose-sm max-w-none">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: `<p class="mb-4">${renderMarkdown(executiveSummary)}</p>` 
                      }} 
                    />
                  </div>
                )}

                {activeTab === 'technical' && (
                  <div className="prose prose-sm max-w-none">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: `<p class="mb-4">${renderMarkdown(technicalReport)}</p>` 
                      }} 
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
