type Props = {
  children: React.ReactNode;
};

/**
 * Responsible for the container and padding of a section
 */
export function SectionLayout({ children }: Props) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">{children}</div>
  );
}
