# Lesson Notes

A small local-first web app for writing up coding lesson notes. Capture what happens during a lesson, then turn it into a clean, parent-facing note in a few clicks.

## What it does

- **Students and projects**: one profile per student, with any number of projects (name and language). Each lesson picks the project it belongs to, defaulting to the one used last. Projects can be marked finished.
- **Lesson workspace**: a *Lesson* tab (Warmup, Main activity, Plan for next week) and a *Note* tab. Each activity has concepts, and each concept gets a rating: *Struggled, Needed support, Independent, Breezed through*.
- **Quick jots**: timestamped one-liners during the lesson, which you can send to a section afterward.
- **Private notes**: optional, shown on a separate hatched surface, and never included in the generated note.
- **Live note**: the parent-facing note is always generated from the lesson in a formal "we" voice, and a live summary sits beside the lesson form. There is no separate "generate" step. If you edit a section by hand, your text is kept; if the lesson changes afterward, that section shows a notice with *Use updated draft* or *Keep mine*.
- **Polish with AI**: an optional button that rewrites each section with a small model running entirely in your browser ([WebLLM](https://github.com/mlc-ai/web-llm), Qwen3 8B, Llama 3.1 8B, or a smaller model for low-memory machines). Copy the result as rich text or plain text.
- **Concept progress**: a per-student grid of ratings over the last six lessons.
- **Dashboard**: lessons whose notes still need writing.

## Privacy and data

There is no server and no account. Everything is stored in your browser's `localStorage`, and the AI model runs on your device, so nothing about a student leaves it. (The only network traffic is the one-time download of the model files.) Because data is per browser and origin, use **Settings → Export JSON** to back up or move to another device. Clearing site data erases your notes.

- The data is stored as plain text on the device, so on a shared computer use your own browser profile.
- Changes are saved a moment after you stop typing, and immediately when the tab is hidden or closed. If a save fails (for example, storage is full), a banner says so.
- Imported and saved data is validated and repaired on load, so a damaged file cannot leave the app blank. If the app still crashes, a recovery screen lets you download your raw data before clearing anything.
- Never put real student names or lesson details in this repo, including in tests and fixtures. Use invented data.

## AI polish requirements

- A browser with WebGPU (recent Chrome or Edge). Without it, the template draft still works.
- A one-time download per model, cached by the browser afterward: Qwen3 8B (about 5.7 GB, the default) or Llama 3.1 8B (about 5 GB). Both need roughly 6 GB of free GPU memory. On GPUs without half-precision support or a 4 GiB buffer limit, the app defaults to a low-memory model, Qwen2.5 3B (about 2.5 GB), and shows a note that it is less accurate: it can drop verbs, reword activity names, or blur ratings. In side-by-side tests Qwen3 followed the facts most faithfully; Llama sometimes softened a rating. Your own choice, made in the dropdown next to the button, always wins. Keep the dev server on port 4173 so the cache and your data stay put.
- The model is given the lesson's facts, not the draft prose, and its output is checked: concept names must survive, activity names may only have a one or two letter typo fixed, and invented filler words, stray quoted text and he/she pronouns are rejected. It gets one retry; if the output still fails, that section keeps your draft and you are told which one. The checks cannot catch every error, such as a rating attached to the wrong thing.
- Small models can still drift from the facts. Always read the result before copying; **Undo polish** restores the previous text, and **Reset note** removes all edits and rebuilds the note from the lesson (the lesson itself is untouched; use **Delete lesson** to remove a lesson).

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
npm run lint
npm test         # unit + component tests (Vitest, Testing Library)
```

Stack: Vite, React 19, TypeScript, Tailwind CSS v4, Radix Dialog, lucide-react, `@mlc-ai/web-llm`. Routing is hash-based so it works as a plain static site.

## Deployment

Static site. Connect the repo to Vercel with the Vite preset (build command `npm run build`, output directory `dist`).

## Layout

```
src/
  store.tsx          app state + localStorage persistence
  lib/note.ts        template note builder and copy formats
  lib/llm.ts         in-browser model loading and polishing
  lib/llm.worker.ts  runs the model off the main thread
  pages/             Dashboard, Students, Student, Lesson, Settings
  components/        Shell, ConceptEditor, Rating, NotePreview, ui
```
