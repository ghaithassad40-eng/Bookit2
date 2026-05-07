import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props<T> {
  title: string;
  description?: string;
  value: T;
  onSave: (next: T) => void | Promise<void>;
  saving?: boolean;
}

export function JsonConfigEditor<T extends object>({
  title,
  description,
  value,
  onSave,
  saving,
}: Props<T>) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    try {
      const parsed = JSON.parse(text) as T;
      setError(null);
      void onSave(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <Badge variant="destructive">Invalid JSON</Badge>
          ) : (
            <Badge variant="success">Valid</Badge>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-border">
          <Editor
            height="320px"
            language="json"
            theme="vs-dark"
            value={text}
            onChange={(v) => {
              const next = v ?? "";
              setText(next);
              try {
                JSON.parse(next);
                setError(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Invalid JSON");
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              tabSize: 2,
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        </div>
        {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
