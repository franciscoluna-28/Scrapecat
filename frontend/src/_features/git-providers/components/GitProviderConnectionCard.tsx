"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { GitProviderConnectForm } from "@/src/_features/git-providers/components/GitProviderConnectForm";

export function GitProviderConnectionCard() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base">Git Connection</CardTitle>
      </CardHeader>
      <CardContent>
        <GitProviderConnectForm />
      </CardContent>
    </Card>
  );
}
