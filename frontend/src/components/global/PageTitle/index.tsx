"use client";

import { useRouter } from "next/navigation";
import { Button } from "../../ui/button";
import { ArrowLeft } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  hasBack?: boolean;
  children?: React.ReactNode;
};

export function PageTitle({ title, description, hasBack = false, children }: Props) {
  const router = useRouter();

  const handleBack = () => router.push("/new");

  return (
   
   <div className="text-center mt-8">
    {hasBack && (
        <Button variant="ghost" className="text-sm mb-4" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      )}
      <h1 className="text-2xl font-semibold mb-4">{title}</h1>
      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}
      {children}
    </div>
  );
}
