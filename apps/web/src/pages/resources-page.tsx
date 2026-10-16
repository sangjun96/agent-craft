import { useState, type FormEvent } from "react";
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { formatTime } from "@/agents/format";
import { formatBytes, ImageUpload } from "@/components/image-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Typography } from "@/components/typography";
import {
  deleteResource,
  renameResource,
  resourceFileUrl,
  uploadResource,
  type Resource,
} from "@/resources/api";
import { useResources } from "@/resources/use-resources";

export function ResourcesPage() {
  const { resources, loading, error, reload } = useResources();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <Typography variant="h2" render={<h1 />}>
          리소스
        </Typography>
        <Typography variant="muted">
          에이전트 실행에 쓸 이미지를 저장합니다. 업로드하면 LLM이 내용을 보고 파일명을 붙입니다.
        </Typography>
      </div>

      <UploadCard onUploaded={reload} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>리소스를 불러오지 못했습니다: {error}</AlertDescription>
        </Alert>
      )}
      {loading && resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : resources.length === 0 ? (
        !error && <p className="text-sm text-muted-foreground">아직 저장된 리소스가 없습니다.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceCard resource={resource} onChanged={reload} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      await uploadResource(file);
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>이미지 업로드</CardTitle>
        <CardDescription>PNG, JPEG, WEBP, GIF · 최대 10MB</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-image" className="sr-only">
              이미지
            </Label>
            <ImageUpload id="resource-image" value={file} onChange={setFile} disabled={uploading} />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="self-end" disabled={uploading || !file}>
            {uploading ? "업로드하고 이름 짓는 중…" : "업로드"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ResourceCard({ resource, onChanged }: { resource: Resource; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(resource.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const rename = (event: FormEvent) => {
    event.preventDefault();
    void run(() => renameResource(resource.id, name));
  };

  const remove = () => {
    if (window.confirm(`"${resource.name}"을(를) 삭제할까요?`)) {
      void run(() => deleteResource(resource.id));
    }
  };

  return (
    <Card size="sm" className="h-full pt-0">
      <a
        href={resourceFileUrl(resource.id)}
        target="_blank"
        rel="noreferrer"
        className="block aspect-video overflow-hidden bg-muted"
      >
        <img
          src={resourceFileUrl(resource.id)}
          alt={resource.name}
          loading="lazy"
          className="size-full object-contain"
        />
      </a>
      <CardContent className="flex flex-col gap-1">
        {editing ? (
          <form onSubmit={rename} className="flex items-center gap-1">
            <Input
              aria-label="이름"
              value={name}
              autoFocus
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="이름 저장"
              disabled={busy || !name.trim()}
            >
              <CheckIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="취소"
              disabled={busy}
              onClick={() => {
                setName(resource.name);
                setEditing(false);
              }}
            >
              <XIcon />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={resource.name}>
              {resource.name}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="이름 변경"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="삭제"
              disabled={busy}
              onClick={remove}
            >
              <Trash2Icon />
            </Button>
          </div>
        )}
        <span className="truncate text-xs text-muted-foreground" title={resource.originalName}>
          원본: {resource.originalName}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(resource.size)} · {formatTime(resource.createdAt)}
        </span>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </CardContent>
    </Card>
  );
}
