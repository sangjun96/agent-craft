# ai-services

Worker에서 쓰는 AI 서비스 클라이언트. 호출부는 provider 이름 대신 범용 이름(`llm`, `search`, ...)으로 사용한다.

```ts
import * as z from "zod";
import { createLlm } from "ai-services/llm";
import { createSearch } from "ai-services/search";
import { createSpeech } from "ai-services/speech";
import { createSystemOne } from "ai-services/system-one";

// gemini-3.8-flash + reasoning medium 고정. 반환값은 schema로 검증된 타입.
const llm = createLlm({ apiKey: env.OPENROUTER_API_KEY });
const post = await llm.generateObject(
  "Cloudflare Workers 소개글 써줘",
  z.object({ title: z.string(), body: z.string() }),
);
// 이미지는 content part 배열로 넘긴다.
const caption = await llm.generateObject(
  [
    { type: "text", text: "이미지를 한 문장으로 설명해줘" },
    { type: "image_url", imageUrl: { url: "data:image/png;base64,..." } },
  ],
  z.object({ caption: z.string() }),
);

// gemini-3.8-flash-tts 멀티 스피커. 턴 순서대로 하나의 MP3로 합성.
const speech = createSpeech({ apiKey: env.OPENROUTER_API_KEY });
const mp3 = await speech.dialogue([
  { voice: "Kore", text: "오늘 어때?" },
  { voice: "Puck", text: "그럭저럭.", instructions: "tired, yawning" },
]);

// ~typesafe/jev-latest(Decisions API). state에 대한 타입 지정 질문(noul/choice/score/box)에 질문 id별로 답한다.
const systemOne = createSystemOne({ apiKey: env.OPENROUTER_API_KEY });
const answers = await systemOne.decide("지금 당장 구매하세요!!!", {
  spam: { type: "noul", instructions: "스팸 메시지인가?" },
  tone: {
    type: "score",
    instructions: "얼마나 공격적인가?",
    criteria: ["차분함", "보통", "공격적"],
  },
});

// 이미지는 PNG/JPEG base64 data URL만. box는 대상이 없어도 박스를 돌려주므로 noul로 존재 여부를 같이 묻는다.
const photo = await systemOne.decide(
  ["상품 사진:", { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }],
  {
    present: { type: "noul", instructions: "사진에 상품이 보이는가?" },
    product: { type: "box", instructions: "상품 사진 속의 상품" },
  },
);

const search = createSearch({ apiKey: env.EXA_API_KEY });
const results = await search.search({
  query: "cloudflare workers",
  numResults: 5,
  highlights: true,
});
```

빌드 없이 TS 소스를 그대로 export한다: Worker 전용 내부 패키지라 Vite가 직접 번들하면 되고, dist 빌드 순서 문제를 피하기 위함.
