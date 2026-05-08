import { Card } from "@/components/ui/card";

export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <Card className="p-12 text-center">
        <div className="text-sm text-muted-foreground">Sección en construcción para esta demo.</div>
      </Card>
    </div>
  );
}
