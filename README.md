# ⚡ Nova IDE

Nova IDE is a lightweight, browser-based coding environment designed for the future of **on-device AI**. It leverages WebGPU and LiteRT LM to run high-performance Large Language Models (LLMs) entirely within your browser—no cloud, no APIs, and total privacy.

![Nova IDE Screenshot](src/assets/hero.png)

## ✨ Features

- **On-Device Inference**: Run AI models like Gemma 4 locally using your machine's GPU (via WebGPU).
- **Total Privacy**: Your code and prompts never leave your browser.
- **High-Performance Editor**: Built on CodeMirror 6 with support for Python, JavaScript, HTML, and CSS.
- **Integrated Terminal**: A simulated terminal for executing commands and environment inspection.
- **Virtual File System**: In-browser file management backed by IndexedDB.
- **Modern UI**: A premium, VS Code-inspired dark theme with glassmorphism and smooth micro-animations.

## 🚀 Getting Started

### Prerequisites

- **Google Chrome** (Version 113 or higher recommended for WebGPU support).
- **Node.js** (for running the development server).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/carrycooldude/Nova-IDE.git
   cd Nova-IDE
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

## 🤖 Using the AI Assistant

1. Open the **AI Panel** (shortcut: `Ctrl+Shift+A`).
2. Click **⚡ Load Local AI Model** to initialize the model from the local assets.
   - *Note: The model file is large (1GB+) and will be downloaded into your browser's memory and compiled for your GPU.*
3. Once the status turns **✅ AI Ready**, start chatting!

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + B` | Toggle File Explorer |
| `Ctrl + Shift + A` | Toggle AI Panel |
| `Ctrl + \`` | Toggle Terminal |
| `Ctrl + S` | Save Current File |

## 🛠️ Tech Stack

- **Core**: JavaScript (ESM), HTML5, CSS3
- **Editor**: [CodeMirror 6](https://codemirror.net/)
- **AI Engine**: [LiteRT LM](https://ai.google.dev/edge/litert-lm/js)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Storage**: IndexedDB (Virtual File System)

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.



https://github.com/user-attachments/assets/989acde6-957d-4df2-8cf0-cf3365810489



https://github.com/user-attachments/assets/169f3cc4-37b6-48e8-9371-f051bc7a43cd



---
*Powered by On-Device AI.*


