import { useEffect, useState, type DragEvent } from "react";
import { FileSpreadsheetIcon, ImageUpIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type ImageUploadProps = {
  id?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  /** Also accepts CSV files, shown with an icon instead of a preview. */
  allowCsv?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Image picker with click or drag-and-drop, showing a preview once a file is chosen. */
export function ImageUpload({
  id,
  value,
  onChange,
  allowCsv,
  disabled,
  className,
}: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const isImage = value?.type.startsWith("image/");
  const preview = useObjectUrl(isImage ? value : null);

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || (allowCsv && /\.csv$/i.test(file.name)))) {
      onChange(file);
    }
  };

  if (value) {
    return (
      <div
        data-slot="image-upload"
        className={cn("flex items-center gap-3 rounded-lg border p-2", className)}
      >
        <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            !isImage && (
              <div className="flex size-full items-center justify-center">
                <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
              </div>
            )
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{value.name}</span>
          <span className="text-xs text-muted-foreground">{formatBytes(value.size)}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={allowCsv ? "파일 제거" : "이미지 제거"}
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      data-slot="image-upload"
      data-dragging={dragging || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center transition-colors hover:bg-muted/50 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-50 data-dragging:border-primary data-dragging:bg-primary/5",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <ImageUpIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">
          {allowCsv ? "클릭하거나 파일을 끌어다 놓으세요" : "클릭하거나 이미지를 끌어다 놓으세요"}
        </span>
        <span className="text-xs text-muted-foreground">
          {allowCsv ? "PNG, JPG, WEBP 등 이미지 또는 CSV 파일" : "PNG, JPG, WEBP 등 이미지 파일"}
        </span>
      </div>
      <input
        id={id}
        type="file"
        accept={allowCsv ? "image/*,.csv,text/csv" : "image/*"}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          // Lets the same file be picked again after it is removed.
          event.target.value = "";
        }}
      />
    </label>
  );
}

function useObjectUrl(file: File | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) return setUrl(undefined);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
