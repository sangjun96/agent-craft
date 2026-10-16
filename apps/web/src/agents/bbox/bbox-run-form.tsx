import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RunFormProps } from "../catalog.ts";

const MAX_SIDE = 1024;

export function BboxRunForm({ agent, onSubmitted }: RunFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const busy = submitting || agent.state?.status === "running";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const image = await toJpegDataUrl(file);
      const runId = await agent.call<string>("run", [{ image, target }]);
      onSubmitted?.(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="bbox-image">이미지</Label>
        <Input
          id="bbox-image"
          type="file"
          accept="image/*"
          required
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bbox-target">찾을 대상</Label>
        <Input
          id="bbox-target"
          placeholder="예: 빨간 머그컵"
          required
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={busy || !file || !target.trim()}>
        {busy ? "실행 중…" : "실행"}
      </Button>
    </form>
  );
}

/** Shrinks the image to keep the RPC message and the stored row small. */
async function toJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 처리할 수 없습니다");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
