import { Logo } from "../Logo";

interface ApplicationLayoutProps {
  children: React.ReactNode;
}

/**
 * Global layout that includes the logo in the bottom right corner and the background
 * Should not be confused by SectionLayout
 */
export function ApplicationLayout({ children }: ApplicationLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute bottom-8 right-8">
        <Logo />
      </div>
      {children}
    </div>
  );
}
