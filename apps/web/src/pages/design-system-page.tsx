import { type Editor, Tiptap, useRichEditor, useTiptap, useTiptapState } from "editor";
import { CodeBlock } from "editor/extensions/code-block";
import { Markdown } from "editor/extensions/markdown";
import { RichRenderer } from "editor/renderer";
import {
  ArrowRightIcon,
  BoldIcon,
  Heading2Icon,
  InfoIcon,
  ItalicIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  SquareCodeIcon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Prose, proseVariants, Typography } from "@/components/typography";
import { cn } from "@/lib/utils";

const COLOR_TOKENS = [
  "background",
  "foreground",
  "primary",
  "secondary",
  "muted",
  "muted-foreground",
  "accent",
  "border",
  "ring",
  "link",
  "destructive",
] as const;

const BLUE_SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const MODELS = [
  { label: "Claude Opus", value: "opus" },
  { label: "Claude Sonnet", value: "sonnet" },
  { label: "Claude Haiku", value: "haiku" },
];

const EDITOR_SAMPLE = `## 실험 노트

**bbox-agent** 프롬프트를 바꿔서 *박스 정확도*를 비교했다.

\`\`\`ts
const answers = await systemOne.decide(photo, {
  product: { type: "box", instructions: "상품 사진 속의 상품" },
});
\`\`\`

- 툴바나 마크다운 단축키(\`**굵게**\`, \`## 제목\`, \`- 목록\`)로 편집해 보세요.`;

const EDITOR_TOOLS = [
  {
    label: "굵게",
    icon: BoldIcon,
    isActive: (editor: Editor) => editor.isActive("bold"),
    toggle: (editor: Editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: "기울임",
    icon: ItalicIcon,
    isActive: (editor: Editor) => editor.isActive("italic"),
    toggle: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "제목",
    icon: Heading2Icon,
    isActive: (editor: Editor) => editor.isActive("heading", { level: 2 }),
    toggle: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "코드 블록",
    icon: SquareCodeIcon,
    isActive: (editor: Editor) => editor.isActive("codeBlock"),
    toggle: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

export function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-12 sm:px-6">
      <Hero />
      <ColorsSection />
      <TypographySection />
      <EditorSection />
      <ComponentsSection />
    </main>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-start gap-4">
      <Badge variant="outline">Design system demo</Badge>
      <Typography variant="h1">간결하고 깔끔한 기본 스타일</Typography>
      <Typography variant="lead" className="max-w-2xl">
        Tailwind CSS · shadcn/ui · Base UI · CSS 토큰으로 구성된 스타일 가이드입니다. 색상,
        타이포그래피, 컴포넌트가 한 화면에서 어떻게 어우러지는지 확인하세요.
      </Typography>
      <div className="flex flex-wrap gap-2">
        <Button size="lg">
          시작하기 <ArrowRightIcon data-icon="inline-end" />
        </Button>
        <Button size="lg" variant="outline">
          문서 보기
        </Button>
      </div>
    </section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Typography variant="h2">{title}</Typography>
        <Typography variant="muted">{description}</Typography>
      </div>
      {children}
    </section>
  );
}

function ColorsSection() {
  return (
    <Section
      title="Colors"
      description="src/index.css의 시맨틱 토큰. 다크 모드 토글로 함께 확인하세요."
    >
      <div className="flex flex-col gap-2">
        <Typography variant="small">Point · Santorini blue</Typography>
        <div className="grid grid-cols-5 overflow-hidden rounded-lg border sm:grid-cols-10">
          {BLUE_SCALE.map((step) => (
            <div key={step} className="flex flex-col">
              <div className="h-12" style={{ background: `var(--blue-${step})` }} />
              <Typography variant="muted" className="py-1 text-center text-xs">
                {step}
              </Typography>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {COLOR_TOKENS.map((token) => (
          <div key={token} className="flex items-center gap-3 rounded-lg border p-2">
            <div
              className="size-10 shrink-0 rounded-md border"
              style={{ background: `var(--${token})` }}
            />
            <Typography variant="code" className="truncate bg-transparent px-0 text-xs">
              --{token}
            </Typography>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TypographySection() {
  return (
    <Section
      title="Typography"
      description="UI 텍스트는 <Typography variant>, 장문 콘텐츠는 <Prose>(@tailwindcss/typography)."
    >
      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">Typography</TabsTrigger>
          <TabsTrigger value="prose">Prose</TabsTrigger>
        </TabsList>
        <TabsContent value="variants" className="pt-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <Typography variant="h1">h1 · 제목 Heading</Typography>
              <Typography variant="h2" className="border-b pb-2">
                h2 · 섹션 제목
              </Typography>
              <Typography variant="h3">h3 · 소제목</Typography>
              <Typography variant="h4">h4 · 작은 제목</Typography>
              <Typography variant="lead">
                lead · 도입 문단은 조금 더 크고 차분하게 보입니다.
              </Typography>
              <Typography>
                p · 본문 텍스트입니다. The quick brown fox jumps over the lazy dog. 다람쥐 헌
                쳇바퀴에 타고파. 인라인 코드는 <Typography variant="code">pnpm dev</Typography>처럼
                표현합니다.
              </Typography>
              <Typography variant="blockquote">blockquote · 단순함은 궁극의 정교함이다.</Typography>
              <Typography variant="large">large · 강조 텍스트</Typography>
              <Typography variant="small">small · 라벨 텍스트</Typography>
              <Typography variant="muted">muted · 보조 설명 텍스트</Typography>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="prose" className="pt-4">
          <Card>
            <CardContent>
              <Prose>
                <h2>Prose로 감싼 콘텐츠</h2>
                <p>
                  마크다운 렌더링 결과나 블로그 글처럼 <strong>구조화된 장문</strong>은{" "}
                  <code>&lt;Prose&gt;</code>로 감싸기만 하면 됩니다. 색상은 CSS 토큰을 따르므로{" "}
                  <a href="#">링크</a>와 본문 모두 다크 모드에 자동으로 맞춰집니다.
                </p>
                <h3>특징</h3>
                <ul>
                  <li>@tailwindcss/typography 기반의 일관된 리듬과 간격</li>
                  <li>
                    <code>size</code> prop으로 sm / base / lg 조절
                  </li>
                  <li>
                    <code>prose-invert</code> 없이 토큰만으로 테마 전환
                  </li>
                </ul>
                <blockquote>좋은 기본값은 대부분의 결정을 대신 내려줍니다.</blockquote>
                <pre>
                  <code>{`<Prose size="sm">\n  {markdownHtml}\n</Prose>`}</code>
                </pre>
                <table>
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>용도</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Typography</td>
                      <td>제목, 라벨, 설명 등 UI 텍스트</td>
                    </tr>
                    <tr>
                      <td>Prose</td>
                      <td>문서, 마크다운, 아티클</td>
                    </tr>
                  </tbody>
                </table>
              </Prose>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Section>
  );
}

const EDITOR_EXTENSIONS = [CodeBlock, Markdown];
const EDITOR_PROSE = proseVariants({ size: "sm" });

function EditorSection() {
  const editor = useRichEditor({
    extensions: EDITOR_EXTENSIONS,
    content: EDITOR_SAMPLE,
    contentType: "markdown",
    className: cn(EDITOR_PROSE, "min-h-64 px-4 py-3 outline-none"),
  });

  return (
    <Section
      title="Editor"
      description="editor 패키지(Tiptap). prose는 className으로 주입하고, CodeBlock · Markdown extension을 조합했습니다. 오른쪽은 같은 extension으로 그린 Preview입니다."
    >
      <Tiptap editor={editor}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="gap-0 py-0">
            <EditorToolbar />
            <Tiptap.Content />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>editor.getJSON()을 에디터 인스턴스 없이 렌더링</CardDescription>
            </CardHeader>
            <CardContent>
              <RenderedOutput />
            </CardContent>
          </Card>
        </div>
      </Tiptap>
    </Section>
  );
}

function EditorToolbar() {
  const { editor } = useTiptap();
  const active = useTiptapState(({ editor }) => EDITOR_TOOLS.map((tool) => tool.isActive(editor)));

  return (
    <div role="toolbar" aria-label="서식" className="flex gap-1 border-b p-1">
      {EDITOR_TOOLS.map((tool, index) => (
        <Button
          key={tool.label}
          size="icon-sm"
          variant={active[index] ? "secondary" : "ghost"}
          aria-label={tool.label}
          aria-pressed={active[index]}
          onClick={() => tool.toggle(editor)}
        >
          <tool.icon />
        </Button>
      ))}
    </div>
  );
}

function RenderedOutput() {
  const content = useTiptapState(({ editor }) => editor.getJSON());
  return <RichRenderer content={content} extensions={EDITOR_EXTENSIONS} className={EDITOR_PROSE} />;
}

function ComponentsSection() {
  return (
    <Section title="Components" description="shadcn/ui (Base UI 기반) 컴포넌트 샘플.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buttons & Badges</CardTitle>
            <CardDescription>variant와 size 조합</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="추가">
                <PlusIcon />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
            <CardDescription>입력 요소와 레이블</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-name">이름</Label>
              <Input id="demo-name" placeholder="홍길동" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>모델</Label>
              <Select items={MODELS} defaultValue="sonnet">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-prompt">프롬프트</Label>
              <Textarea id="demo-prompt" placeholder="무엇을 도와드릴까요?" />
            </div>
            <div className="flex items-center justify-between">
              <Label>
                <Checkbox defaultChecked /> 약관에 동의합니다
              </Label>
              <Label>
                스트리밍 <Switch defaultChecked />
              </Label>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline">취소</Button>
            <Button>저장</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overlays</CardTitle>
            <CardDescription>Dialog · Dropdown menu · Tooltip</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>Dialog 열기</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>변경 사항을 저장할까요?</DialogTitle>
                  <DialogDescription>
                    저장하지 않으면 지금까지 입력한 내용이 사라집니다.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
                  <DialogClose render={<Button />}>저장</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>메뉴</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>내 계정</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <UserIcon /> 프로필
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon /> 설정
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <LogOutIcon /> 로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="정보" />}>
                <InfoIcon />
              </TooltipTrigger>
              <TooltipContent>툴팁 텍스트</TooltipContent>
            </Tooltip>

            <div className="ml-auto flex -space-x-2">
              {["SY", "AC", "UI"].map((initials) => (
                <Avatar key={initials} className="ring-2 ring-background">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Alert>
            <InfoIcon />
            <AlertTitle>알림</AlertTitle>
            <AlertDescription>기본 Alert는 카드 배경과 테두리만으로 구분됩니다.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>오류가 발생했습니다</AlertTitle>
            <AlertDescription>destructive 토큰 하나로 위험 상태를 표현합니다.</AlertDescription>
          </Alert>
        </div>
      </div>
    </Section>
  );
}
