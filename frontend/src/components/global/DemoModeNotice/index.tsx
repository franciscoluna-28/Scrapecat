import { Card, CardContent } from "@/src/components/ui/card";

type Props = {
  title: string;
  description: string;
};

export function DemoModeNotice({ title, description }: Props) {
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
