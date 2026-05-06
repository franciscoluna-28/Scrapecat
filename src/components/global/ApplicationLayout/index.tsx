import { Logo } from "../Logo";

interface ApplicationLayoutProps {
  children: React.ReactNode;
}

export function ApplicationLayout({ children }: ApplicationLayoutProps) {
  return (
    <div>
      <div className="min-h-screen bg-background relative">
        <div className="absolute bottom-8 right-8">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
