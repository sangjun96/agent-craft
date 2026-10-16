import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "cn";
import { fetchResourceFile, resourceFileUrl, type Resource } from "@/resources/api";
import { useResources } from "@/resources/use-resources";

type ResourcePickerProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  className?: string;
};

/** Loads the images stored on the resources page and hands the picked one over as a File. */
export function ResourcePicker({ onSelect, disabled, className }: ResourcePickerProps) {
  const { resources, loading, error } = useResources();
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
        저장된 리소스가 없습니다.{" "}
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
          <li key={resource.id} className="shrink-0">
            <button
              type="button"
              title={resource.name}
              aria-label={`${resource.name} 선택`}
              disabled={disabled || pickingId !== undefined}
              onClick={() => pick(resource)}
              className="relative block size-14 overflow-hidden rounded-md border bg-muted outline-none hover:ring-2 hover:ring-ring/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <img
                src={resourceFileUrl(resource.id)}
                alt={resource.name}
                loading="lazy"
                className="size-full object-cover"
              />
              {pickingId === resource.id && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                </span>
              )}
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
