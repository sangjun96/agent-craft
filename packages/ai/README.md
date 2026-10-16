# ai-services

Worker에서 쓰는 AI 서비스 클라이언트. 호출부는 provider 이름 대신 범용 이름(`llm`, `search`, ...)으로 사용한다.

```ts
import { createLlm } from "ai-services/llm";
import { createSearch } from "ai-services/search";

const llm = createLlm({ apiKey: env.OPENROUTER_API_KEY });
const { text } = await llm.chat({
  model: "openai/gpt-5",
  messages: [{ role: "user", content: "Hi" }],
});

const search = createSearch({ apiKey: env.EXA_API_KEY });
const results = await search.search({
  query: "cloudflare workers",
  numResults: 5,
  highlights: true,
});
```

빌드 없이 TS 소스를 그대로 export한다: Worker 전용 내부 패키지라 Vite가 직접 번들하면 되고, dist 빌드 순서 문제를 피하기 위함.
