"use client";

import { Suspense } from "react";

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}