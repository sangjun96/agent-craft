import { useState, type FormEvent } from "react";
import { FileSpreadsheetIcon, XIcon } from "lucide-react";
import { CURRICULUM_SHAPE_HASH, LEVELS } from "../../../worker/agents/curriculum/constants.ts";
import { ImageUpload } from "@/components/image-upload";
import { ResourcePicker } from "@/components/resource-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RunFormProps } from "../catalog.ts";

const MAX_SIDE = 1024;

export function CurriculumRunForm({ agent, onSubmitted }: RunFormProps) {
  const [image, setImage] = useState<File | null>(null);
  const [csv, setCsv] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const busy = submitting || agent.state?.status === "running";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!image || !csv) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const runId = await agent.call<string>("run", [
        { image: await toJpegDataUrl(image), curriculumCsv: await csv.text() },
      ]);
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
        <Label htmlFor="curriculum-image">시험지 이미지</Label>
        <ImageUpload id="curriculum-image" value={image} onChange={setImage} disabled={busy} />
        {!image && <ResourcePicker onSelect={setImage} disabled={busy} />}
      </div>
      <div className="flex flex-col gap-2">
        <Label>커리큘럼 CSV</Label>
        {csv ? (
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2 truncate">
              <FileSpreadsheetIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{csv.name}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="CSV 제거"
              disabled={busy}
              onClick={() => setCsv(null)}
            >
              <XIcon />
            </Button>
          </div>
        ) : (
          <ResourcePicker
            kind="csv"
            shapeHash={CURRICULUM_SHAPE_HASH}
            onSelect={setCsv}
            disabled={busy}
          />
        )}
        <p className="text-xs text-muted-foreground">
          컬럼: {LEVELS.join(", ")} (세부유형 1개당 1행)
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={busy || !image || !csv}>
        {busy ? "실행 중…" : "실행"}
      </Button>
    </form>
  );
}

/** Shrinks the image to keep the RPC message small. */
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
