"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { GitHubConnectForm } from "@/src/_features/github/components/GitHubConnectForm";

export function GitHubConnectionCard() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">GitHub Connection</CardTitle>
      </CardHeader>
      <CardContent>
        <GitHubConnectForm />
      </CardContent>
    </Card>
  );
}
