import { useState } from "react";
import { FileSpreadsheetIcon, LoaderCircleIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "cn";
import { formatDate } from "@/agents/format";
import { formatBytes } from "@/components/image-upload";
import { fetchResourceFile, resourceFileUrl, type Resource } from "@/resources/api";
import { useResources } from "@/resources/use-resources";

type ResourcePickerProps = {
  onSelect: (file: File) => void;
  /** What to offer: images (default) or CSVs. */
  kind?: "image" | "csv";
  /** With `kind="csv"`, offers only CSVs whose header hashes to this value. */
  shapeHash?: string;
  disabled?: boolean;
  className?: string;
};

/** Loads the images or CSVs stored on the resources page and hands the picked one over as a File. */
export function ResourcePicker({
  onSelect,
  kind = "image",
  shapeHash,
  disabled,
  className,
}: ResourcePickerProps) {
  const { resources: stored, loading, error } = useResources();
  const resources = stored.filter((resource) =>
    kind === "csv"
      ? resource.shapeHash !== null && (!shapeHash || resource.shapeHash === shapeHash)
      : resource.shapeHash === null,
  );
  const [pickingId, setPickingId] = useState<string>();
  const [pickError, setPickError] = useState<string>();

  const pick = async (resource: Resource) => {
    setPickingId(resource.id);
    setPickError(undefined);
    try {
      onSelect(await fetchResourceFile(resource));
    } catch (err) {
      setPickError(err instanceof Error ? err.message : String(err));
    } finally {
      setPickingId(undefined);
    }
  };

  let body;
  if (loading) {
    body = <p className="text-xs text-muted-foreground">저장된 리소스를 불러오는 중…</p>;
  } else if (error) {
    body = <p className="text-xs text-destructive">리소스를 불러오지 못했습니다: {error}</p>;
  } else if (resources.length === 0) {
    body = (
      <p className="text-xs text-muted-foreground">
        {kind === "csv" ? "맞는 CSV 리소스가 없습니다." : "저장된 리소스가 없습니다."}{" "}
        <Link to="/resources" className="underline underline-offset-4 hover:text-foreground">
          리소스 페이지
        </Link>
        에서 업로드하세요.
      </p>
    );
  } else {
    body = (
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {resources.map((resource) => (
          <li key={resource.id} className="w-48 shrink-0">
            <button
              type="button"
              title={resource.name}
              aria-label={`${resource.name} 선택`}
              disabled={disabled || pickingId !== undefined}
              onClick={() => pick(resource)}
              className="flex w-full items-center gap-2 rounded-md border p-1.5 text-left outline-none hover:ring-2 hover:ring-ring/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
                {kind === "csv" ? (
                  <FileSpreadsheetIcon className="size-5 text-muted-foreground" />
                ) : (
                  <img
                    src={resourceFileUrl(resource.id)}
                    alt={resource.name}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
                {pickingId === resource.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium">{resource.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatBytes(resource.size)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatDate(resource.createdAt)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div data-slot="resource-picker" className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">저장된 리소스에서 선택</span>
      {body}
      {pickError && <p className="text-xs text-destructive">{pickError}</p>}
    </div>
  );
}
