# Practical Browser AI

**5 practical AI features. No backend. No cloud. Just your browser.**

**Live demo:** [sylwia-lask.github.io/practical-browser-ai](https://sylwia-lask.github.io/practical-browser-ai/pause-and-ask)

A React + TypeScript application that demonstrates practical use cases for
local, in-browser AI. Each feature is designed to eventually run entirely on the
client using browser-compatible models through technologies such as
[Transformers.js](https://huggingface.co/docs/transformers.js), **WebGPU**, and
**WebAssembly**.

> There is no AI backend, cloud inference, or external AI API. Everything is
> intended to run on-device.

## Features

| Tab | What it does |
| --- | --- |
| **AI Accessibility** ✅ | Upload an image and generate suggested alt text with a local image-captioning model. |
| **Smart Ticket Creator** ✅ | Convert an unstructured natural-language complaint into a structured issue ticket with a local language model. |
| **Pause & Ask** ✅ | Start your webcam, pause on a frame, and ask a local vision-language model natural-language questions about it. |
| **Semantic Search** ✅ | Search a collection of support tickets by meaning — a local embedding model turns text into vectors and ranks results by cosine similarity, with a non-AI keyword-search comparison. |
| **AI Background Remover** ✅ | Upload an image, strip its background with a local saliency-segmentation model, and download a transparent PNG. |

> **Status:** All five tabs are fully implemented and run real in-browser
> inference (Semantic Search uses a local embedding model, not a generative one).

See [AI Accessibility](#ai-accessibility--local-alt-text-generator),
[Smart Ticket Creator](#smart-ticket-creator-1),
[Pause & Ask](#pause--ask-1),
[Semantic Search](#semantic-search-1), and
[AI Background Remover](#ai-background-remover-1) below for each feature's model,
runtime, requirements, and known limitations.

## Tech stack

- [React 19](https://react.dev/) with TypeScript
- [Vite](https://vite.dev/) for dev server and builds
- [React Router v7](https://reactrouter.com/) for routing (lazy-loaded routes)
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [Lucide React](https://lucide.dev/) for icons
- [Transformers.js v4](https://huggingface.co/docs/transformers.js) (`@huggingface/transformers`) for in-browser, WebGPU-accelerated model inference
- [Zod](https://zod.dev/) for validating model-generated structured output (Smart Ticket Creator)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) for the offline service worker — precaches the app shell and runtime-caches downloaded models (see [Offline support](#offline-support))

## Getting started

Requires [Node.js](https://nodejs.org/) (18.18+ recommended) and npm.

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview
```

> The service worker that powers offline use is only generated in a **production
> build** — it is inactive under `npm run dev`. To try offline behaviour locally,
> run `npm run build` then `npm run preview`. See [Offline support](#offline-support).

## Offline support

The app is a **Progressive Web App**: after the first online visit it keeps
working with no network, and once a feature's model has been downloaded that
feature runs **fully offline**. This is a natural fit for the project — all
inference already runs on-device, so the only thing that needs the network is the
one-time asset and model download.

Offline is handled by a [Workbox](https://developer.chrome.com/docs/workbox)
service worker generated at build time by
[vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (configured in
[`vite.config.ts`](vite.config.ts)):

- **App shell is precached.** All built JS, CSS, HTML, SVG, and the ONNX Runtime
  **WebAssembly** binaries are precached on first load, so the UI (and the CPU
  inference backend) opens with no network. Deep links / refreshes resolve
  offline via an `index.html` navigation fallback that respects the GitHub Pages
  base path.
- **Models are runtime-cached.** The one-time model downloads from the Hugging
  Face Hub (`huggingface.co` and the `cdn-lfs*` LFS/CDN hosts the weight blobs
  redirect to) are cached with a **CacheFirst** strategy (range requests enabled,
  so Transformers.js's chunked weight fetches are cached too). After a feature's
  model has been fetched once, it is served from the cache — no re-download, and
  it works offline.
- **Auto-update.** `registerType: 'autoUpdate'` means a new deployment is fetched
  and activated automatically; there's no update prompt to dismiss. The worker is
  registered in [`src/pwa.ts`](src/pwa.ts) (wired into
  [`src/main.tsx`](src/main.tsx)).

### What works offline — and what doesn't

- ✅ **The app itself** (every tab's UI, routing, deep links) works offline after
  the first visit.
- ✅ **Any feature whose model you've already loaded online** works offline —
  inference runs locally via WebGPU/WASM against the cached weights.
- ⚠️ **A model is cached only after you open that tab online** and let it
  download once. Each feature downloads its own model lazily, so a tab you've
  never opened online won't have its weights cached and won't run offline until
  you do.
- ⚠️ **Pause & Ask still needs a camera** (a device, not the network) and a
  secure context; the *model* works offline once cached, like the others.
- ℹ️ Model downloads are large (≈23 MB for Semantic Search up to ≈786 MB for
  Smart Ticket Creator), so the **first** online visit to a tab still pays the
  download cost before that tab can go offline.

### Testing offline locally

1. `npm run build` then `npm run preview`.
2. Open a tab (e.g. **Semantic Search** for the smallest download) and let its
   model finish downloading once.
3. In DevTools → **Network**, switch to **Offline** (or **Application →
   Service Workers → Offline**), then reload and use that tab — it should keep
   working with no network.

## AI Accessibility — Local Alt Text Generator

Upload an image (PNG, JPEG, or WebP), pick how much detail you want, and a local
image-captioning model suggests alternative text for it. The suggestion lands in
an editable textarea with a live character count and a copy button, so you can
refine it before using it. An optional **Image context** field lets you note how
the image is used on your site.

**Nothing leaves the device.** The model is downloaded from the Hugging Face Hub
once (then cached by the browser) and all captioning runs locally via WebGPU.
Image pixels are only ever read in your browser and in the Web Worker — they are
never uploaded.

### Model and runtime

| | |
| --- | --- |
| **Model** | [`onnx-community/Florence-2-base-ft`](https://huggingface.co/onnx-community/Florence-2-base-ft) — Microsoft's [Florence-2-base-ft](https://huggingface.co/microsoft/Florence-2-base-ft), a ~0.23B-parameter vision foundation model (MIT license), converted to ONNX for Transformers.js. |
| **Task** | **Image captioning** via Florence-2's `<CAPTION>`, `<DETAILED_CAPTION>`, and `<MORE_DETAILED_CAPTION>` task tokens (mapped to the Concise / Detailed / Rich options in the UI). |
| **Runtime** | [Transformers.js v4](https://huggingface.co/blog/transformersjs-v4) (`@huggingface/transformers`), which runs ONNX models in the browser. |
| **Acceleration** | **WebGPU** when available, with a WebAssembly (CPU) fallback. |
| **Quantization** | Mixed precision from the official example: `fp16` vision encoder + token embeddings on WebGPU (when the adapter supports `shader-f16`, else `fp32`); the encoder/decoder stay `q4`. On the CPU/WASM fallback everything drops to `fp32`/`q4`. |

### Why this model?

Alt text is fundamentally an **image-captioning** task — turn pixels into a short
visual description — not visual question answering. That drove the model choice:

- **Florence-2 is purpose-built for captioning.** Its dedicated caption tasks
  produce clean, descriptive sentences out of the box, which is exactly the
  shape of good alt text. The three detail levels map directly to its three
  caption task tokens.
- **It's small and reliable.** At ~0.23B parameters, Florence-2-base downloads in
  a few hundred MB — far lighter than a 2.2B instruction VLM — which fits the
  brief of "the most reliable option, not the largest."
- **It has a documented, working browser implementation.** The feature's worker
  is based directly on the official
  [`florence2-webgpu`](https://github.com/huggingface/transformers.js-examples/tree/main/florence2-webgpu)
  example and the [Xenova/florence2-webgpu](https://huggingface.co/spaces/Xenova/florence2-webgpu)
  demo Space, including the exact mixed-precision `dtype` map and the shader
  warm-up pass.

### Honest note on the "Image context" field

Florence-2 is a **task-prompted captioning model, not an instruction-following
VLM**. Its model card only documents a fixed set of task tokens — it cannot be
given a free-form instruction like _"describe this as a product photo"_ and have
that steer the generated caption. The
[Florence-2 paper](https://arxiv.org/abs/2311.06242) describes exactly this
prompt-based, fixed-task design.

So this feature **does not** feed your context to the model and pretend it was
understood. Instead:

1. The model produces a plain visual caption from the pixels only.
2. That caption is cleaned in code into alt-text-appropriate phrasing (collapse
   whitespace, strip redundant _"Image of…" / "A picture of…"_ openers per the
   [W3C WAI images tutorial](https://www.w3.org/WAI/tutorials/images/), normalize
   capitalization and the trailing period).
3. Your optional context is folded in **transparently, in code** as a
   human-facing purpose hint appended to the suggestion — it never changes what
   the model detected. The UI says so plainly, and you're expected to edit the
   final text.

This keeps the model output honest and the editing workflow transparent, rather
than fabricating context-aware AI capabilities.

### Approximate download size

The first generation downloads roughly **~350–450 MB** of model weights with the
mixed `fp16`/`q4` precision above (fp16 vision encoder + token embeddings, q4
encoder/decoder, plus tokenizer/processor config). Exact totals vary with whether
the adapter supports `shader-f16` (fp16 vs. the larger fp32 submodels). Files are
cached by the browser, so later visits and generations reuse them with no
re-download.

### Browser and hardware requirements

- A **WebGPU-capable desktop browser** is strongly recommended — recent Chrome,
  Edge, or other Chromium-based browsers. Check [WebGPU support](https://caniuse.com/webgpu).
- A GPU with roughly **1–2 GB of free VRAM** for the model plus runtime buffers.
- Without WebGPU the feature falls back to the CPU (WASM) backend, which is
  **significantly slower** but still fully local.
- A reasonably fast connection for the one-time model download.

### Known limitations

- **Alt text is a draft, not a verdict — always have a human review it.** The
  model describes pixels; it does not know an image's *purpose* on your page,
  and appropriate alt text depends on that purpose (a decorative image may even
  warrant empty alt text). It can also miss, misread, or invent details. Treat
  every suggestion as a starting point and edit before publishing.
- **The context field is a post-processing hint, not AI understanding** (see the
  honest note above).
- A small captioning model can struggle with text in images, fine detail,
  uncommon subjects, and charts/diagrams.
- It will not reliably read or transcribe long passages of text in an image —
  that's OCR, a different task.
- No remote/cloud fallback exists by design. If local inference can't run, the
  feature reports an error instead of silently calling an API.

### Why AI-generated alt text still needs human review

Good alt text answers _"what does a sighted user get from this image, here, for
this purpose?"_ — not just _"what is in the picture?"_. The same photo needs
different alt text as a decorative banner, a linked thumbnail, or a data chart,
and only a human who knows the page context can make that call. A captioning
model has no access to that context and can also be confidently wrong about what
it sees. Shipping unreviewed machine captions risks misleading the very users
alt text is meant to serve, so this feature is explicitly a drafting aid with a
human in the loop.

### How it's built (architecture)

The feature is split into focused modules under
`src/features/ai-accessibility/`:

```text
worker.ts         # Model init + lazy load + Florence-2 caption generation (Web Worker)
useAltText.ts     # React hook: owns the worker lifecycle and exposes state/actions
image.ts          # Image validation + downscaling + object-URL cleanup
altText.ts        # Caption cleanup + transparent context hint + character count
types.ts          # Caption-detail levels and the worker message protocol
components/        # Dropzone, ModelStatus (download progress), AltTextResult (editor)
```

The model is loaded lazily on the first generation, runs in a Web Worker to keep
the UI responsive, and is reused across subsequent images. The worker caches the
preprocessed vision inputs per image, so switching the detail level or
regenerating doesn't re-encode the same pixels. Each feature downloads its own
model only when its route is visited, so an unrelated tab never pulls weights it
doesn't need.

## Smart Ticket Creator

Paste a rough, informal complaint — the kind a user actually writes — and a
local language model rewrites it into a clean, structured issue ticket: a
concise title, a professional description, a suggested type and priority,
expected vs. actual behavior, steps to reproduce, and the information still
missing to investigate. Every field is editable, and the ticket can be copied as
Markdown (**Copy Ticket**) or as raw JSON (**Copy JSON**). Two example complaints
(one messy, one deliberately vague) are one click away for quick testing.

For example, this complaint:

> So I clicked save like five times and nothing happened, then the page froze
> and I had to refresh, and now I'm not even sure if my changes were saved. This
> happened twice today and it's really annoying.

becomes a ticket with a title like _"Save button unresponsive; page freezes
after repeated clicks"_, the fact _"clicked Save five times"_ and _"happened
twice today"_ preserved in steps/description, priority left at **Medium** or
**Unknown** (the word "annoying" is not treated as evidence of High impact), and
questions such as _"Which browser and OS?"_ listed under missing information
rather than invented.

**Nothing leaves the device.** The model is downloaded from the Hugging Face Hub
once (then cached by the browser) and all inference runs locally via WebGPU. Your
complaint text is only ever read in your browser and in the Web Worker.

### Model and runtime

| | |
| --- | --- |
| **Model** | [`onnx-community/Qwen2.5-0.5B-Instruct`](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct) — the ONNX build of [`Qwen/Qwen2.5-0.5B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct), a 0.5B-parameter instruction-tuned text-generation model. |
| **Task** | **Text generation** — read an unstructured complaint and emit a single structured JSON ticket. |
| **Runtime** | [Transformers.js v4](https://huggingface.co/blog/transformersjs-v4) (`@huggingface/transformers`), which runs ONNX models in the browser. |
| **Acceleration** | **WebGPU** when available, with a WebAssembly (CPU) fallback. |
| **Quantization** | `q4` on **both** WebGPU and the CPU/WASM fallback. `q4f16` is intentionally **not** used — see _Known limitations_ (it overflows to NaN on the ONNX Runtime WebGPU backend and produces a "!!!!!" loop). |
| **One-shot prompt** | A worked input→output example is included in the prompt; a 0.5B model follows the JSON shape and honesty rules far more reliably with a concrete demonstration than with rules alone. |
| **Validation** | [Zod](https://zod.dev/) — the model's JSON is parsed and validated against a schema; the `Ticket` TypeScript type is inferred from that same schema. |

### Why this model?

This feature is **structured extraction** — turn messy free text into one
well-formed JSON object following a fixed schema and strict honesty rules. That
is an instruction-following + JSON-generation task, which drove the choice:

- **Qwen2.5-Instruct is explicitly tuned for exactly this.** The Qwen2.5 model
  card highlights significant improvements in _instruction following_ and in
  _generating structured outputs, especially JSON_ — the two capabilities this
  feature depends on. (Content was rephrased for compliance with licensing
  restrictions.) See the
  [Qwen2.5-0.5B-Instruct model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct).
- **0.5B, chosen to actually load in the browser.** The 1.5B sibling has
  stronger instruction-following, but in `q4` (the only numerically stable
  precision on WebGPU — see below) its ~1.79 GB of weights plus ONNX session
  buffers overflow available memory on many machines and fail session creation
  with `std::bad_alloc`. The 0.5B `q4` build is **~786 MB** and loads reliably.
  A working smaller model beats an unloadable larger one; the quality gap is
  narrowed with a one-shot example prompt, defensive JSON parsing, and a local
  retry. The 0.5B build is also the more battle-tested browser model (tens of
  thousands of downloads, many live Transformers.js chat demos).
- **It has a verified Transformers.js implementation.** `onnx-community`
  publishes the official ONNX weights for Transformers.js, and the worker follows
  the canonical
  [`llama-3.2-webgpu`](https://github.com/huggingface/transformers.js-examples/tree/main/llama-3.2-webgpu)
  text-generation example (same `AutoModelForCausalLM` + `TextStreamer` +
  `apply_chat_template` API, warm-up pass, and interruptable stopping criteria).
- **Why not a constrained-decoding runtime?** Hugging Face's own
  [Github Issue Generator demo](https://github.com/huggingface/smollm/tree/main/tools/smollm_local_inference)
  solves a near-identical problem using **WebLLM + XGrammar** for grammar-forced
  JSON. That is a genuinely strong approach, but it means a second inference
  runtime. Since the brief prefers Transformers.js v4 and Qwen2.5 follows a
  JSON-shaped prompt reliably, this feature stays on one runtime and validates
  with Zod instead (see _Known limitations_). Transformers.js does not currently
  expose constrained/grammar decoding.

### Approximate download size

The one-time model download is the quantized decoder plus the tokenizer:

| Backend | Weights file | Size |
| --- | --- | --- |
| WebGPU (`q4`) | `onnx/model_q4.onnx` | **≈ 786 MB** |
| CPU/WASM (`q4`) | `onnx/model_q4.onnx` | **≈ 786 MB** |

Plus the tokenizer (`tokenizer.json` ≈ 7 MB, `vocab.json` ≈ 2.8 MB,
`merges.txt` ≈ 1.7 MB) and small config files. Files are cached by the browser,
so later visits and generations reuse them with no re-download. (`q4f16` would
download in ~483 MB, but it is unusable here — see _Known limitations_.)

### Browser and hardware requirements

- A **WebGPU-capable desktop browser** is strongly recommended — recent Chrome,
  Edge, or other Chromium-based browsers. Check [WebGPU support](https://caniuse.com/webgpu).
- A GPU with roughly **1–1.5 GB of free VRAM** for the model plus runtime
  buffers.
- Without WebGPU the feature falls back to the CPU (WASM) backend with `q4`
  weights, which is **significantly slower** and needs enough free RAM; on
  low-memory machines it may be impractical.
- A reasonably fast connection for the one-time model download.

### Expected performance

- First run is slow: the ~786 MB download plus WebGPU shader compilation (there
  is a one-token warm-up pass to pay that cost up front). Subsequent generations
  reuse the loaded model and are much faster.
- On a typical discrete GPU, generation streams at tens of tokens per second
  (shown live as `tok/s`); a full ticket is a few hundred tokens. The CPU
  fallback is far slower.
- The model is loaded lazily on the first **Generate Ticket** click and reused
  for every later generation in the session.

### Structured generation and known limitations

- **Prompt-based JSON, validated with Zod — not grammar-constrained.**
  Transformers.js has no constrained-decoding API, so the model is firmly
  prompted to emit one JSON object, and the result is then recovered and
  validated in code:
  1. The first balanced `{…}` object is extracted from the raw output (tolerating
     ```json fences and any stray prose around it).
  2. Common malformations are repaired defensively (trailing commas, curly
     quotes) before `JSON.parse`.
  3. The parsed object is validated with a Zod schema that coerces a
     recognizable-but-imperfect payload into the strict ticket shape and falls
     back to honest defaults (`"Other"` / `"Unknown"`, `""`, `[]`).
  4. If the first attempt is unparseable, there is **one local retry** with a
     firmer prompt. If that also fails, the UI shows a clear error.
- **No remote repair, no hardcoded ticket.** Recovery is entirely on-device. The
  feature never calls a remote model to fix invalid output and never silently
  substitutes a canned ticket — if valid JSON cannot be obtained locally, it says
  so.
- **The ticket is a draft, not a verdict.** A small model can still misread
  nuance, mis-rank priority, or phrase something awkwardly. Priority is
  deliberately cautious and defaults to `Unknown`; the "missing information"
  field exists precisely because the model is told to ask rather than invent.
  **Always review before filing.**
- A 0.5B model occasionally produces a near-miss JSON object on the first try;
  the retry usually recovers it, but very long or contradictory complaints can
  still fail validation. It is a small model — expect the odd awkward phrasing or
  mis-ranked priority, which is exactly why every field is editable.
- **Why `q4` and not `q4f16`?** The smaller `q4f16` build keeps `f16`
  activations, and those overflow to `NaN` inside the current ONNX Runtime
  WebGPU kernels for this model. The logits collapse and the model emits token 0
  ("!") forever — an endless `"!!!!!…"` loop with no valid JSON. This is a known
  runtime issue, not a prompt or model-quality problem
  ([microsoft/onnxruntime#26732](https://github.com/microsoft/onnxruntime/issues/26732),
  [huggingface/transformers.js#1317](https://github.com/huggingface/transformers.js/issues/1317)).
  Plain `q4` keeps 4-bit weights with `f32` activations, which is numerically
  stable on WebGPU and still GPU-accelerated, at the cost of a larger download.
  The parser also detects a degenerate repeating-character loop and reports it
  explicitly, so if a future/other backend regresses, the UI says what happened
  instead of showing a misleading "no JSON" error.

### How it's built (architecture)

The feature is split into focused modules under
`src/features/smart-ticket-creator/`:

```text
worker.ts           # Model init + lazy load + JSON generation + local retry (Web Worker)
useTicketCreator.ts # React hook: owns the worker lifecycle and exposes state/actions
prompt.ts           # System/user chat messages encoding the AI-behavior policy
parseTicket.ts      # JSON extraction + defensive repair + Zod validation + normalize
formatTicket.ts     # Serialize a ticket to Markdown and to JSON for the clipboard
examples.ts         # The two sample complaints
types.ts            # Zod ticket schema (source of truth), Ticket type, worker protocol
components/         # ModelStatus (download progress), TicketEditor (editable fields)
```

The model is loaded lazily on the first generation, runs in a Web Worker to keep
the UI responsive, and is reused across subsequent generations. It is a separate
worker and model from the other features — each feature downloads its own model
only when its route is visited, so an unrelated tab never pulls weights it
doesn't need.

### How to run and test

1. `npm install` then `npm run dev`, and open the **Ticket Creator** tab (or go
   to `/smart-ticket-creator`).
2. Click an example chip (**Messy: Save button** or **Vague: it broke**), or type
   your own complaint, then press **Generate Ticket**.
3. The first run downloads the model (watch the per-file progress); later runs
   reuse it.
4. Review and edit any field, then **Copy Ticket** (Markdown) or **Copy JSON**.
   **Reset** clears the input and output (the model stays loaded).

## Pause & Ask

Start your webcam, watch the live preview, then **Pause Frame** to freeze the
current view. Type a natural-language question in **Ask about this frame** —
_"What objects are visible?"_, _"What color is the object in the center?"_,
_"How many people are in the frame?"_ — and a local vision-language model answers
based on that frozen image. You can ask as many questions as you like about the
same frame, then **Resume Camera** for a new one. An optional **Live AI
Description** toggle periodically narrates the live scene.

**Nothing leaves the device.** There is no backend and no inference API. The
camera stream is rendered locally, frames are captured to an in-memory canvas,
and the model (downloaded once from the Hugging Face Hub, then cached by the
browser) runs entirely in your browser via WebGPU. **Captured frames and your
questions are never uploaded.**

### Model and runtime

| | |
| --- | --- |
| **Model** | [`onnx-community/LFM2.5-VL-450M-ONNX`](https://huggingface.co/onnx-community/LFM2.5-VL-450M-ONNX) — Liquid AI's [LFM2.5-VL-450M](https://huggingface.co/docs/transformers/main/model_doc/lfm2_vl), a ~0.45B-parameter instruction-tuned vision-language model (LFM2.5-350M language backbone + SigLIP2 NaFlex 86M vision encoder), converted to ONNX for Transformers.js. |
| **Task** | **Visual question answering** — accepts an image **plus** a free-form question and generates an answer grounded in the image. The same model also produces the short scene captions for Live AI Description. |
| **Runtime** | [Transformers.js v4](https://huggingface.co/blog/transformersjs-v4) (`@huggingface/transformers`), which runs ONNX models in the browser. |
| **Acceleration** | **WebGPU** when available, with a WebAssembly (CPU) fallback. |
| **Quantization** | Per-submodel: `fp16` vision encoder + token embeddings and `q4f16` decoder on WebGPU (when the adapter supports `shader-f16`); `q4` everywhere on the CPU/WASM fallback (and on WebGPU without `shader-f16`). |

### Why this model?

The brief requires **genuine visual question answering** — the model must take a
captured frame *and* an arbitrary question and answer about that specific image —
not fixed-task image captioning. That ruled some otherwise-capable models in and
out:

- **LFM2.5-VL-450M is a real instruction-following VLM.** It accepts interleaved
  image + text and follows free-form questions, so it genuinely answers _"what
  color is the object in the center?"_ rather than only emitting a canned
  caption. It scores well on real-world VQA for its size (e.g. RealWorldQA 58.4,
  MMBench-dev-en 60.9 on its [model card](https://huggingface.co/onnx-community/LFM2.5-VL-450M-ONNX)).
- **It is purpose-built for exactly this scenario.** Liquid AI ships an official
  [real-time video-stream captioning WebGPU demo](https://docs.liquid.ai/examples/web/vl-webgpu-demo)
  for this model family and documents the exact Transformers.js v4 usage
  (`AutoModelForImageTextToText` + the `dtype` map this worker uses). It is part
  of the [Transformers.js v4 demo collection](https://huggingface.co/collections/webml-community/transformersjs-v4-demos).
- **It's small enough for an interactive, repeatable loop.** At ~0.45B
  parameters (~350 MB quantized) it loads fast and uses little VRAM — important
  when the user asks several questions in a row and (optionally) runs a periodic
  caption loop.
- **One model covers both modes.** Because it does both VQA and captioning well,
  Live AI Description reuses the *same* loaded model instead of downloading a
  second one. No extra GPU memory is spent on a dedicated captioner.
- **Florence-2 was considered for captioning and rejected as the primary model.**
  Florence-2 (used by the AI Accessibility tab) only responds to a fixed set of
  task tokens and is **not** instruction-following — it cannot answer an
  arbitrary question about a frame, which is the whole point of this feature. It
  is therefore not used here.

### Approximate download size

With the WebGPU `fp16`/`q4f16` precision above, the first use downloads roughly
**~350–400 MB** of model weights (fp16 vision encoder + token embeddings, q4f16
decoder, plus tokenizer/processor config). The exact total varies with whether
the adapter supports `shader-f16` (fp16 vs. the `q4` fallback submodels). Files
are cached by the browser, so later visits and questions reuse them with no
re-download.

### Camera permission requirements

- The webcam is requested **only when you click Start Camera** — never on page
  load — via the browser's [MediaDevices `getUserMedia`](https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia)
  API, and the browser will prompt for permission.
- Camera access requires a **secure context**: `https://` or `http://localhost`.
  Over plain `http://` on a remote host the browser blocks `getUserMedia` and the
  feature reports that the camera is unavailable.
- Denied permission, no camera present, or a camera already in use by another app
  are all handled gracefully with a clear message.
- **Stop Camera** releases every media track, and the camera is also released
  automatically when you navigate away from the tab (component unmount).

### Browser and hardware requirements

- A **WebGPU-capable desktop browser** is strongly recommended — recent Chrome,
  Edge, or other Chromium-based browsers. Check [WebGPU support](https://caniuse.com/webgpu).
- A webcam, and a GPU with roughly **1–2 GB of free VRAM** for the model plus
  runtime buffers.
- Without WebGPU the feature falls back to the CPU (WASM) backend with `q4`
  weights, which is **significantly slower** (expect multi-second answers) but
  still fully local.
- A reasonably fast connection for the one-time model download.

### Expected performance

- First run is slow: the one-time model download plus WebGPU shader compilation.
  Subsequent questions reuse the loaded model and are much faster.
- On a typical discrete GPU, answers stream at tens of tokens per second; a short
  answer is a second or two after the first run. The CPU fallback is far slower.
- **Only one inference runs at a time.** Asking a question while another is in
  flight is ignored, and the Live AI Description loop never queues work: the next
  caption is scheduled only *after* the previous one finishes (a fixed delay
  between completions), so inference requests can never pile up.
- Live AI Description runs **only while the camera is live** — it pauses
  automatically while you ask about a frozen frame, so captioning and VQA never
  compete for the GPU.

### Known limitations

- **Answers are a draft, not ground truth — always sanity-check them.** It is a
  compact on-device model; it can miss objects, miscount, or misjudge colors, and
  it is explicitly **not well suited to fine-grained OCR** (reading small text on
  a sign) or knowledge-intensive questions. The system prompt asks it to express
  uncertainty rather than invent details, but it can still be confidently wrong.
- **No fake or canned answers.** Every answer is generated live from the actual
  captured frame and your actual question. There are no hardcoded responses and
  no remote/cloud fallback — if local inference can't run, the feature reports an
  error instead of silently calling an API.
- First run is slow because of the model download and WebGPU shader compilation.
- The CPU/WASM fallback can be impractically slow and memory-hungry for the
  (optional) continuous caption loop on low-end machines; disable Live AI
  Description there and use Pause & Ask on demand.

### How it's built (architecture)

The feature is split into focused modules under `src/features/pause-and-ask/`:

```text
worker.ts         # Model init + lazy load + VQA/caption inference (Web Worker)
useVqa.ts         # React hook: owns the worker lifecycle, VQA + caption actions, status
useCamera.ts      # React hook: webcam start/stop/pause/resume + capture + cleanup
camera.ts         # Framework-free MediaDevices + canvas frame-capture helpers
types.ts          # CapturedFrame, device/support types, worker message protocol
components/        # CameraStage (preview + controls), ModelStatus (download progress)
```

Camera handling, frame capture, model loading/inference, and UI state are kept in
separate modules. The model is loaded lazily on the first question, runs in a Web
Worker to keep the preview responsive, and is reused for every subsequent
question (including a brand-new paused frame). It is a separate worker and model
from the other tabs — each feature downloads its own model only when its route is
visited, so an unrelated tab never pulls weights it doesn't need.

### How to run and test

1. `npm install` then `npm run dev`, and open the **Pause & Ask** tab (or go to
   `/pause-and-ask`). Use `http://localhost` or HTTPS so the browser allows the
   camera.
2. Click **Start Camera** and grant permission. You should see your live webcam.
3. Click **Pause Frame** to freeze the current view (a "Frame paused" badge
   appears).
4. Type a question (or click an example chip) and press **Ask AI**. The first run
   downloads the model (watch the per-file progress); later questions reuse it.
   The answer streams in below.
5. Ask more questions about the **same** frozen frame, then **Resume Camera** for
   a new one. Optionally enable **Live AI Description** while live.
6. **Stop Camera** releases the webcam; navigating away does the same
   automatically.

## Semantic Search

Search a small collection of support tickets **by meaning**, not just by
keywords. Type a natural-language query — _"My edits disappear after I leave the
page"_ — and the app ranks the tickets by how semantically similar they are to
your query, surfacing the unsaved-changes tickets even though they share almost
no literal words with the query. A **Keyword Search** mode (a deterministic,
non-AI text matcher) runs on the same data so you can see exactly where
meaning-based retrieval helps and where literal matching falls short.

The whole pipeline runs locally: a local embedding model turns each document
into a vector, your query is embedded the same way, and results are ranked by
cosine similarity — **no backend, no vector database, no cloud embeddings
API, and no generative LLM.** You can add, edit, and remove documents, and the
UI clearly flags when the index is outdated so you can reindex.

**Nothing leaves the device.** The embedding model is downloaded from the
Hugging Face Hub once (then cached by the browser); your documents and queries
are only ever read in your browser and in the Web Worker — they are never
uploaded.

### Model and runtime

| | |
| --- | --- |
| **Model** | [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) — the ONNX build of [`sentence-transformers/all-MiniLM-L6-v2`](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), a ~22.7M-parameter sentence-embedding model that maps text to a **384-dimensional** dense vector for semantic similarity. |
| **Task** | **Feature extraction (text embeddings)** — this is *not* a generative model. It only produces vectors; all ranking is plain arithmetic in the app. |
| **Runtime** | [Transformers.js v4](https://huggingface.co/blog/transformersjs-v4) (`@huggingface/transformers`), which runs ONNX models in the browser. |
| **Acceleration** | **WebAssembly (CPU)** by default (the library's default quantized weights); **WebGPU** (`fp32`) when available. See _Why WASM by default?_ below. |
| **Pooling / normalization** | `{ pooling: 'mean', normalize: true }` — the exact settings documented on the model card. Mean-pooled token embeddings, then L2-normalized to unit length. |
| **Query/document prefixes** | **None.** Unlike E5/BGE/nomic-style models, all-MiniLM-L6-v2 does not require `query:`/`passage:` prefixes, so queries and documents are embedded identically. |

### Why this model?

This feature is **semantic similarity over short English support tickets** —
turn text into vectors and rank by closeness. That is an embedding task, not a
generative one, which drove the choice:

- **It is purpose-built for exactly this.** all-MiniLM-L6-v2 is a
  sentence-transformers model that maps sentences and short paragraphs to a
  384-d dense vector space for clustering and semantic search. (Content was
  rephrased for compliance with licensing restrictions.) See the
  [model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2).
- **It is tiny and fast.** At ~22.7M parameters (~23 MB quantized), it downloads
  in seconds and embeds a couple dozen short documents effectively instantly —
  the right scale for an interactive demo, and far smaller than the generative
  models used by the other tabs.
- **It has the canonical, documented Transformers.js implementation.** The model
  card's own example is the `feature-extraction` pipeline with
  `{ pooling: 'mean', normalize: true }` — exactly what this feature's worker
  does — and it appears throughout the official
  [Transformers.js examples](https://github.com/huggingface/transformers.js-examples).
- **No prefixes to get wrong.** Newer embedding models (E5, BGE, nomic-embed,
  EmbeddingGemma) often need task-specific `query:`/`passage:` prefixes and
  mishandling them quietly degrades results. all-MiniLM-L6-v2 needs none, which
  keeps the demo simple and correct.
- **A generative model would be the wrong tool.** The brief explicitly rules out
  a large generative LLM here; embeddings + cosine similarity is the standard,
  well-understood way to do meaning-based retrieval without one.

### Why WASM by default (not WebGPU)?

For a ~23 MB encoder over a couple dozen short strings, the WebAssembly (CPU)
backend embeds the whole collection in well under a second, has the **widest
browser compatibility**, and avoids WebGPU shader-compilation latency on the
first call. The brief explicitly allows preferring WASM when it offers better
compatibility or a simpler implementation for a small embedding model, so the
CPU path is the default. On that path the worker lets Transformers.js pick its
default quantized weights and CPU backend rather than forcing a `device`/`dtype`
— forcing `device: 'wasm'` is in fact rejected by ONNX Runtime web, and a forced
quantization can name a file the repo doesn't ship. When WebGPU is available the
worker uses it with `fp32` weights (numerically safe and still accelerated); the
ranking is identical either way.

### Approximate download size

The one-time download is the quantized encoder plus the tokenizer:

| Backend | Weights file | Approx. size |
| --- | --- | --- |
| CPU (default quantized) | `onnx/model_quantized.onnx` | **≈ 23 MB** |
| WebGPU (`fp32`) | `onnx/model.onnx` | **≈ 90 MB** |

Plus the tokenizer (`tokenizer.json`, `vocab.txt`) and small config files
(a few MB total). Files are cached by the browser, so later visits and searches
reuse them with no re-download. This is by far the smallest model in the app.

### How indexing works

1. **Lazy load.** The embedding model is downloaded and initialized on the first
   **Index documents** click (or first search), in a Web Worker, and reused for
   the rest of the session.
2. **Embed in batches.** Each document's title + description is embedded (mean
   pooling + L2 normalization) in batches, and the worker streams genuine
   per-document progress to the UI (`done / total`).
3. **Store vectors in memory.** The resulting 384-d unit vectors are kept in an
   in-memory `Map` keyed by document id — a plain array of vectors, **not** a
   vector database. For this dataset size that is both correct and instant.
4. **Reuse unchanged embeddings.** Each stored vector is tagged with a hash of
   the exact text it was computed from. On **Reindex**, only documents whose
   text changed (or that were newly added) are re-embedded; unchanged documents
   keep their cached vectors, and vectors for removed documents are pruned. The
   UI marks the index **outdated** whenever the collection has drifted from what
   was indexed.

### How cosine similarity is calculated

Because the embeddings are L2-normalized (unit length), cosine similarity
reduces to a dot product:

```text
cos(a, b) = (a · b) / (‖a‖ · ‖b‖)   and   ‖a‖ = ‖b‖ = 1   ⇒   cos(a, b) = a · b
```

At search time the query is embedded with the **same** model and settings, the
cosine similarity between the query vector and every document vector is
computed, and results are sorted by descending similarity. The implementation in
[`similarity.ts`](src/features/semantic-search/similarity.ts) still divides by
the norms defensively, so it stays mathematically correct even for
un-normalized input.

> **Scores are relative ranking signals, not calibrated confidence
> probabilities.** A higher score means "more similar than the others in this
> list"; the absolute number is only meaningful compared within the same result
> set. The feature deliberately does **not** apply an arbitrary universal
> relevance threshold.

### Semantic vs. Keyword search

The **Keyword Search** mode is a deterministic, dependency-free lexical matcher
(see [`keywordSearch.ts`](src/features/semantic-search/keywordSearch.ts)): it
lowercases and tokenizes text, removes stop-words, applies light stemming
(plural/`-ing`/`-ed`), and scores documents by how many distinct query terms
they contain, with a small bonus for repeats and exact-phrase hits. It is a
**fair, reasonable** baseline — not sabotaged — and it uses the same dataset as
semantic search. Its fundamental limitation is that it can only match literal
words: a query like _"My edits disappear after I leave the page"_ finds nothing
useful by keywords, while semantic search surfaces the unsaved-changes tickets.
That contrast is the whole point of offering both.

### Example dataset

The demo ships with ~22 fictional support tickets (static test data, **not**
mocked AI output) in
[`sampleTickets.ts`](src/features/semantic-search/sampleTickets.ts), grouped into
clusters that describe the same underlying issue in different words (unsaved
edits, slow performance, sign-in problems, email delivery, billing, …) plus a
few unrelated distractors, so both strong and imperfect matches are visible.

### Browser and hardware requirements

- Works in any **modern desktop browser** — because the default backend is
  WebAssembly, WebGPU is **not** required for this feature (it's used only as an
  optional speed-up).
- Modest memory: the model is ~23 MB and the vectors for a few dozen documents
  are negligible.
- A connection fast enough for the one-time ~23 MB model download.
- Errors (interrupted download, out-of-memory) are caught and surfaced in the UI
  instead of failing silently; there is no cloud fallback by design.

### Known limitations

- **Small model, short-text sweet spot.** all-MiniLM-L6-v2 is tuned for short
  English sentences. It can miss nuance, struggle with very long documents
  (inputs are truncated to the model's max sequence length), and is weaker on
  non-English text or domain jargon.
- **Scores are relative, not absolute** (see above) — don't read a raw cosine
  value as a probability or compare values across different queries.
- **Quantization changes the numbers slightly.** `q8`/`fp32` weights can produce
  marginally different vectors than full-precision PyTorch, which can nudge the
  ordering of near-ties. Rankings are stable in practice for this dataset.
- **In-memory only.** The index lives in memory for the session; it is not
  persisted (IndexedDB persistence was intentionally left out to keep the demo
  lightweight, as the brief allows). Reloading the page re-indexes on demand.
- **No document upload / parsing.** By design there is no PDF/OCR/file ingestion
  — just short text documents you type or edit.

### How it's built (architecture)

The feature is split into focused modules under `src/features/semantic-search/`:

```text
worker.ts            # Model init + lazy load + batched document/query embedding (Web Worker)
useSemanticSearch.ts # React hook: worker lifecycle, document collection, in-memory index, search
similarity.ts        # dot / norm / cosine similarity + ranking (pure functions)
keywordSearch.ts     # Deterministic non-AI keyword matcher (the comparison baseline)
sampleTickets.ts     # The static example ticket dataset
types.ts             # TicketDoc, IndexedDoc, SearchResult, text hashing, worker protocol
components/          # ModelStatus (download + indexing progress), DocumentList (add/edit/remove), SearchResults
```

Embedding (the only AI part), similarity math, keyword matching, the sample
data, and the UI are each isolated. The embedding model is loaded lazily, runs
in a Web Worker to keep the UI responsive, and is reused across indexing and
every search. It is a separate worker and model from the other tabs — each
feature downloads its own model only when its route is visited, so an unrelated
tab never pulls weights it doesn't need.

### How to run and test

1. `npm install` then `npm run dev`, and open the **Semantic Search** tab (or go
   to `/semantic-search`).
2. Click **Index documents** — the first time, watch the one-time model download,
   then the per-document embedding progress. The badge flips to **Index up to
   date**.
3. Type a query (or click an example chip such as _"My edits disappear after I
   leave the page"_) and press **Search**. The unsaved-changes tickets should
   rank at the top, each with its cosine score.
4. Toggle to **Keyword Search** and run the same query to see literal matching
   miss the differently worded tickets.
5. **Add a document**, or edit/remove one — the index is marked **outdated**;
   click **Reindex documents** (only changed/new documents are re-embedded).
6. **Reset collection** restores the sample tickets and clears the index.

## AI Background Remover

Upload an image (PNG, JPEG, or WebP), click **Remove Background**, and a local
AI model cuts the foreground out of the background. The result is shown on a
checkerboard (so transparency is visible) behind a draggable **before/after
comparison slider**, and you can **Download Transparent PNG** — a real PNG with
an alpha channel, exported at the source resolution.

**Nothing leaves the device.** The model is downloaded from the Hugging Face Hub
once (then cached by the browser) and all segmentation, mask compositing, and PNG
encoding run locally in your browser and a Web Worker. **Your images are never
uploaded**, and there is no cloud fallback.

### Model and runtime

| | |
| --- | --- |
| **Model** | [`briaai/RMBG-1.4`](https://huggingface.co/briaai/RMBG-1.4) — BRIA AI's RMBG v1.4, an [IS-Net](https://github.com/xuebinqin/DIS)-based **saliency segmentation** model (~44M parameters) that predicts a single-channel foreground alpha matte, published with ONNX weights tagged for Transformers.js. The `fp32` ONNX weights are roughly **~170 MB**. |
| **Task** | **Image segmentation / foreground matting** — the model outputs a per-pixel foreground probability in `[0, 1]`, used directly as an alpha mask. |
| **Runtime** | [Transformers.js v4](https://huggingface.co/blog/transformersjs-v4) (`@huggingface/transformers`), which runs ONNX models in the browser via `AutoModel` + `AutoProcessor` + `RawImage`. |
| **Acceleration** | **WebGPU** when available, with a WebAssembly (CPU) fallback. |
| **Precision** | `fp32` on **both** WebGPU and the CPU/WASM fallback. RMBG-1.4's ONNX export does not ship a reliable `q4f16` variant, and `f16` is poorly supported on CPU, so `fp32` is the safe, documented precision on both devices. |

### License and usage restrictions ⚠️

**RMBG v1.4 is released for _non-commercial use only_.** It is distributed under
BRIA AI's [`bria-rmbg-1.4` license](https://bria.ai/bria-huggingface-model-license-agreement/)
(a Creative Commons, non-commercial agreement). Commercial use requires a
separate paid license from BRIA.

- This tab is a **non-commercial proof of concept** for a technical article, so
  the model's license fits that use.
- If you need background removal **for commercial use**, swap in a
  commercially-licensed model. The code is model-agnostic — change `MODEL_ID` in
  [`types.ts`](src/features/background-remover/types.ts). Good options:
  - [`Xenova/modnet`](https://huggingface.co/Xenova/modnet) — **Apache-2.0**,
    uses the same Transformers.js API and output format, but is a **portrait /
    person matting** model only (not general objects).
  - BRIA's own commercially-licensed RMBG tiers (via a paid BRIA agreement).
- Always re-check the model card before shipping; license terms can change.

### Why this model?

The brief calls for a background remover that handles **product photos,
portraits, and everyday objects** and runs **entirely in the browser**. That
ruled candidates in and out:

- **RMBG-1.4 is general-purpose, not portrait-only.** BRIA trained it on a
  balanced mix of objects, e-commerce content, people, and animals (its model
  card reports ~45% objects-only, ~25% people-with-objects, ~17% people-only),
  so it handles the broad subject range the brief asks for — unlike portrait
  matting models that assume a person is present.
- **It has a verified, working browser implementation.** It ships ONNX weights
  tagged `transformers.js` and `background-removal`, and is the model behind
  several published in-browser demos (e.g. Addy Osmani's `bg-remove`, the
  Backblaze Transformers.js sample). This feature's worker follows the documented
  `AutoModel` + `AutoProcessor` + `RawImage` usage shown on the sibling
  [`Xenova/modnet` card](https://huggingface.co/Xenova/modnet) (same output
  format), scaling the `[0,1]` matte to `[0,255]` and resizing it back to the
  original dimensions.
- **It's small.** At ~44M parameters the ONNX weights are a modest one-time
  download — far lighter than the generative VLMs used by other tabs — and it
  fits comfortably in GPU memory.
- **MODNet was evaluated and kept only as the commercial-friendly fallback.**
  `Xenova/modnet` is Apache-2.0 (nice for licensing) but is trained for portrait
  matting, so it degrades on products and non-person objects. For the demo's
  general-purpose brief, RMBG-1.4's quality wins; MODNet is documented above as
  the drop-in commercial alternative.

### Approximate download size

The first background removal downloads roughly **~170 MB** of model weights
(the RMBG-1.4 `fp32` ONNX file — the model is ~44M parameters, but stored at full
precision) plus small preprocessor/config files. Files are cached by the browser,
so later visits and images reuse them with no re-download.

### Browser and hardware requirements

- A **WebGPU-capable desktop browser** is recommended — recent Chrome, Edge, or
  other Chromium-based browsers. Check [WebGPU support](https://caniuse.com/webgpu).
  It also runs on the **WebAssembly (CPU)** fallback in any modern browser,
  just more slowly.
- A GPU with roughly **1 GB of free VRAM** for the model plus runtime buffers
  (the fallback uses system RAM instead).
- A connection fast enough for the one-time ~170 MB model download.
- Very large uploads are downscaled to a 2048 px longest edge before processing
  to cap peak memory; aspect ratio is always preserved.

### How image processing works

1. **Decode + orientation.** The upload is decoded with EXIF orientation applied
   (`createImageBitmap(file, { imageOrientation: 'from-image' })`) and
   re-rasterized to a canonical image, so phone photos aren't exported sideways
   and the model and compositor share the exact same pixels.
2. **Lazy model load.** On the first **Remove Background**, the Web Worker
   downloads and initializes RMBG-1.4 (reused for every later image).
3. **Preprocess + infer.** `AutoProcessor` resizes/normalizes to the model's
   1024×1024 input; the model returns a single-channel saliency matte.
4. **Postprocess the mask.** The `[0,1]` matte is scaled to `[0,255]` and resized
   **back to the original image dimensions**, so it aligns pixel-for-pixel with
   the full-resolution source (no stretching or distortion).
5. **Composite.** On the main thread, the original pixels are drawn to a canvas
   and the matte is multiplied into the alpha channel — background pixels become
   fully transparent while the foreground keeps its original colour. Soft matte
   edges (0–255) are preserved for smooth, non-jagged cut-outs; transparency is
   never replaced with white.
6. **Export.** `canvas.toBlob('image/png')` encodes a transparent PNG natively —
   no extra image-processing dependency — which the **Download** button saves.

### Resource management

- Only **one segmentation runs at a time** (guarded in both the worker and the
  hook); clicking while busy is ignored.
- Every request carries a monotonic id, so if you swap images mid-inference the
  **stale result is discarded** and can't overwrite the newer image.
- Preview and cut-out **object URLs are revoked** when replaced, on reset, and on
  unmount; the worker is torn down on unmount, which also safely covers
  **navigating away during model loading or processing**.
- The alpha matte is transferred (not copied) from the worker via a transferable
  `ArrayBuffer`.

### Known limitations

- **The cut-out is a best effort, not a perfect mask — review before using.**
  Like all automatic matting, RMBG can struggle with **fine hair and fur edges**,
  **transparent or translucent objects** (glass, smoke, water), thin structures,
  and busy or low-contrast backgrounds where foreground and background blend.
- **Single salient subject.** As a saliency model it isolates the main
  foreground; images with no clear subject, or several equally-prominent
  subjects, can give ambiguous results.
- **Non-commercial license** (see above) — this model cannot be used in a
  commercial product without a BRIA license; use `Xenova/modnet` or a licensed
  model instead.
- First run is slower because of the one-time model download and (on WebGPU)
  shader compilation; later images reuse the loaded model.
- No remote/cloud fallback exists by design. If local inference can't run, the
  feature reports an error instead of silently calling an API.

### How it's built (architecture)

The feature is split into focused modules under
`src/features/background-remover/`:

```text
worker.ts                 # Model init + lazy load + segmentation -> alpha matte (Web Worker)
useBackgroundRemover.ts   # React hook: worker lifecycle, stale-result guarding, compositing, state
image.ts                  # Upload validation + EXIF-correct decode + downscale + object-URL cleanup
compose.ts                # Apply the matte to the original pixels + transparent-PNG export + download
types.ts                  # MODEL_ID, AlphaMask, device/progress types, worker message protocol
components/               # Dropzone, ModelStatus (download progress), BeforeAfter (comparison slider)
```

React UI, model inference, image preprocessing, alpha-mask compositing, and PNG
export are each isolated. The model is loaded lazily on the first removal, runs
in a Web Worker to keep the UI responsive, and is reused across subsequent
images. It is a separate worker and model from the other tabs — each feature
downloads its own model only when its route is visited, so an unrelated tab never
pulls weights it doesn't need.

### How to run and test

1. `npm install` then `npm run dev`, and open the **Background Remover** tab (or
   go to `/background-remover`).
2. Drag in an image (or **Choose file**) — a product photo, portrait, or everyday
   object works best. The original preview appears.
3. Click **Remove Background**. The first run downloads the model (watch the
   per-file progress); later images reuse it.
4. When it finishes, drag the **comparison slider** to compare original vs.
   cut-out over the transparency checkerboard.
5. **Download Transparent PNG** (enabled only once a valid result exists) saves
   the cut-out. **Reset** clears everything; the model stays loaded.

## Project structure

```text
src/
  components/
    layout/      # RootLayout (shell + Outlet), Header, Tabs (NavLink), Footer, NotFound
    ui/          # Reusable primitives: Card, Badge, FeaturePanel, Placeholder
  features/
    ai-accessibility/          # ✅ implemented (Florence-2, image captioning)
    smart-ticket-creator/      # ✅ implemented (Qwen2.5-0.5B-Instruct, structured extraction)
    pause-and-ask/             # ✅ implemented (LFM2.5-VL-450M, live camera VQA)
    semantic-search/           # ✅ implemented (all-MiniLM-L6-v2, embeddings + cosine search)
    background-remover/        # ✅ implemented (RMBG-1.4, foreground segmentation -> transparent PNG)
    registry.ts  # Navigation metadata for the tab bar
  hooks/         # Feature-specific hooks (added later)
  lib/           # cn() className helper
  types/         # Shared types (Feature, FeatureId, BrowserTech)
  router.tsx     # Route config: lazy pages, / redirect, 404 fallback
  main.tsx       # Entry point (RouterProvider + service-worker registration)
  pwa.ts         # Service-worker registration for offline support (vite-plugin-pwa)
  index.css      # Tailwind import + theme
```

## Routing

Each feature is an independent, bookmarkable route served under a shared layout:

| Route | Feature |
| --- | --- |
| `/ai-accessibility` | AI Accessibility |
| `/smart-ticket-creator` | Smart Ticket Creator |
| `/pause-and-ask` | Pause & Ask |
| `/semantic-search` | Semantic Search |
| `/background-remover` | AI Background Remover |

- `/` redirects to `/background-remover`.
- Unknown routes render a simple **Page not found** fallback.
- Every feature page is lazy-loaded with `React.lazy()` and streamed in under a
  `Suspense` fallback, so no feature code (or future on-demand AI model) is
  fetched until its route is visited.

### Adding a feature

1. Create a folder under `src/features/` whose main component is the **default
   export**, built from the shared `FeaturePanel` and `Placeholder` primitives.
2. Add navigation metadata (`id`, `path`, `label`, `title`, `icon`) to
   `src/features/registry.ts` so it appears in the tab bar.
3. Register a lazy route for it in `src/router.tsx`.

## License

For demonstration purposes.
