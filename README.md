# Nova IDE

Nova IDE is a lightweight coding environment for on-device AI. It uses WebGPU and LiteRT LM to run Gemma models locally, with a browser demo mode and an Electron desktop shell for real local workspaces.

![Nova IDE Screenshot](src/assets/hero.png)

## Features

- **On-device inference**: Run LiteRT LM models locally through WebGPU.
- **Privacy-first workflow**: Code and prompts stay on the local machine.
- **CodeMirror editor**: Multi-tab editing with language-aware highlighting.
- **Agentic coding modes**: Ask, Edit, Agent, and Architect modes for read-only help, focused edits, multi-file tasks, and planning.
- **Safe agent changes**: Agent writes become reviewable proposals with per-file apply/discard controls and rollback checkpoints.
- **Workspace awareness**: Local file indexing and search help the assistant retrieve relevant context before answering or proposing changes.
- **Environment panel**: A simulated diagnostics panel for runtime, WebGPU, and model environment inspection.
- **Browser and desktop storage**: IndexedDB demo files in browser mode, OPFS model caching, and real local workspace access in Electron.

## Getting Started

### Prerequisites

- Chrome or Electron with WebGPU support.
- Node.js and npm.

### Browser Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Desktop App

Run the Electron desktop shell in development:

```bash
npm run dev:electron
```

Build the renderer and an unpacked desktop app:

```bash
npm run build:electron
```

Create distributable desktop packages:

```bash
npm run dist
```

## Using The AI Assistant

1. Open the AI panel with `Ctrl+Shift+A`.
2. Choose a mode:
   - **Ask**: read-only codebase questions.
   - **Edit**: focused edits for the current selection or file.
   - **Agent**: multi-file tasks with workspace tools and reviewable change proposals.
   - **Architect**: planning, system design, and implementation guidance.
3. Download or upload a `.litertlm` model. OPFS caching is recommended for large Gemma 4 LiteRT LM files.
4. In Agent mode, inspect the activity timeline, review proposed file changes, then apply, discard, or rollback.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + B` | Toggle File Explorer |
| `Ctrl + Shift + A` | Toggle AI Panel |
| `Ctrl + Shift + P` | Open Command Palette |
| `Ctrl + K` | Quick AI Action |
| `Ctrl + \`` | Toggle Environment Panel |
| `Ctrl + S` | Save Current File |

## Tech Stack

- **Core**: JavaScript, HTML, CSS
- **Desktop**: Electron
- **Editor**: CodeMirror 6
- **AI Engine**: LiteRT LM
- **Bundler**: Vite
- **Storage**: IndexedDB, OPFS, Electron filesystem IPC

## License

MIT License. See [LICENSE](LICENSE) for details.
