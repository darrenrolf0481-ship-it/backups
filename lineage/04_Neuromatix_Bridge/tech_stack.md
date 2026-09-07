# Tech Stack

- Language: TypeScript 5.9
- Frontend Framework: Next.js 15.4 (App Router), React 19
- Component Styling: Vanilla CSS / Tailwind (if requested)
- State Management: Zustand (see [useProjectStore.ts](file:///home/workspace/Neuromatix/store/useProjectStore.ts))
- LLM Frameworks & Rerouting:
  - Local node daemon: Ollama (default model `llama3.2:latest` on `http://localhost:11434`)
  - Cloud provider fallback: OpenRouter (`meta-llama/llama-3-8b-instruct:free` fallback)
  - No active Google Gemini dependencies (completely purged)
