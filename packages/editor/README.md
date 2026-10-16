# editor

Tiptap 기반 리치 텍스트 에디터. extension은 이 패키지가 관리하고, 쓰는 쪽은 필요한 것만 골라 조합한다. 스타일은 포함하지 않는다: 편집 영역 클래스는 쓰는 쪽에서 `className`으로 주입한다.

```tsx
import { type JSONContent, Tiptap, useRichEditor, useTiptap, useTiptapState } from "editor";
import { CodeBlock } from "editor/extensions/code-block";
import { Markdown } from "editor/extensions/markdown";
import { proseVariants } from "@/components/typography";

function NoteEditor({ initial, onSave }: { initial: string; onSave: (doc: JSONContent) => void }) {
  const editor = useRichEditor({
    extensions: [CodeBlock, Markdown],
    content: initial,
    contentType: "markdown", // Markdown을 조합했을 때만
    // className은 래퍼가 아니라 contenteditable 요소 자체에 붙는다 → prose의 first/last-child 규칙이 그대로 맞는다.
    className: proseVariants({ size: "sm" }),
    onUpdate: ({ editor }) => onSave(editor.getJSON()), // 마크다운이 필요하면 editor.getMarkdown()
  });

  // 툴바·메뉴는 <Tiptap> 안에 형제로 조립한다. 에디터 본체를 고치지 않고 붙였다 뗄 수 있다.
  return (
    <Tiptap editor={editor}>
      <Toolbar />
      <Tiptap.Content />
    </Tiptap>
  );
}

function Toolbar() {
  const { editor } = useTiptap();
  // 트랜잭션마다 리렌더하지 않으므로, 상태가 필요한 UI는 useTiptapState로 필요한 값만 구독한다.
  const isBold = useTiptapState(({ editor }) => editor.isActive("bold"));
  return (
    <button aria-pressed={isBold} onClick={() => editor.chain().focus().toggleBold().run()}>
      B
    </button>
  );
}
```

## 제공 extension

StarterKit(문단, 제목, 목록, 인용, 링크, 굵게/기울임 등)은 항상 들어간다. 나머지는 `editor/extensions/*`에서 골라 `extensions`에 넣는다.

| import                         | 내용                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor/extensions/code-block` | `CodeBlock`: highlight.js common 언어 하이라이팅. StarterKit 코드블록을 대체한다. 토큰은 `hljs-*` 클래스만 붙으므로 테마 CSS는 앱이 넣는다. |
| `editor/extensions/markdown`   | `Markdown`: `contentType: "markdown"`으로 불러오고 `editor.getMarkdown()`으로 내보낸다.                                                     |

## 읽기 전용 렌더링

`RichRenderer`는 에디터 인스턴스 없이 `editor.getJSON()` 문서를 React로 그린다(SSR 가능). 목록·상세 화면처럼 편집하지 않는 곳에 쓴다. 에디터와 같은 extension·className을 넘겨야 같은 모양이 나온다.

```tsx
import { RichRenderer } from "editor/renderer";

<RichRenderer
  content={note.body}
  extensions={[CodeBlock, Markdown]}
  className={proseVariants({ size: "sm" })}
/>;
```

## extension 추가하기

- `src/extensions/<name>.ts`에 만들고 export한다. `package.json` 수정 없이 `editor/extensions/<name>`으로 import된다.
- StarterKit extension과 이름이 같으면(`codeBlock`, `heading`, ...) StarterKit 쪽은 자동으로 빠진다. 대체용 extension은 이름만 맞추면 된다.
- 마크다운 왕복이 필요한 노드는 extension에 `parseMarkdown`/`renderMarkdown`을 함께 구현한다.
- 렌더러는 기본적으로 `renderHTML`을 쓴다. 하이라이트처럼 에디터 플러그인이나 NodeView가 모양을 만드는 노드는 extension에 `renderStatic({ node })`을 구현한다(`code-block.ts` 참고). 렌더러는 조합된 extension에서 이 필드를 모아 쓰므로 렌더러 코드는 고칠 필요가 없다.
- StarterKit 설정만 바꿀 때는 `starterKit: { heading: { levels: [1, 2, 3] } }`.

`useRichEditor`는 클라이언트 전용이다(`immediatelyRender` 고정). 빌드 없이 TS 소스를 그대로 export한다.
