# nova-web-agent-core

A purely in-browser, WebGPU-accelerated, zero-dependency autonomous ReAct (Reason+Act) Agent Framework.

Built for local-first, privacy-respecting AI applications using LiteRT LM and lightweight models like Gemma.

## Features
- **Zero Backend**: Runs entirely in the browser using WebGPU.
- **Autonomous Loop**: Implement ReAct loops (Reason -> Act -> Reason) without relying on cloud APIs.
- **Pluggable Tools**: Give your agent the ability to execute any javascript function (file system access, fetch, DOM manipulation).
- **XML-First Parsing**: Optimized for smaller models (2B-8B parameters) that handle XML tags better than JSON or Markdown parsing.

## Installation

```bash
npm install nova-web-agent-core
```

## Quick Start

```javascript
import { WebAgent } from 'nova-web-agent-core';

// 1. Define your custom tools
const myTools = [
  {
    name: 'read_file',
    description: 'Reads the exact content of a file.',
    usage: '<path>src/index.js</path>',
    execute: async (args) => await localFileSystem.read(args.path)
  },
  {
    name: 'finish',
    description: 'Call this tool when the task is fully completed.',
    usage: '',
    execute: async () => 'Task Finished.'
  }
];

// 2. Wrap your WebGPU LLM
// Your LLM object just needs a \`generateRaw(history, onToken)\` method
const aiEngine = {
  generateRaw: async (prompt, onToken) => {
    // Call LiteRT LM, Transformers.js, or another local model runtime here
    // stream tokens to onToken(token)
  }
};

// 3. Initialize and run the agent
const agent = new WebAgent({
  llmEngine: aiEngine,
  tools: myTools,
  onUpdate: (event) => {
    if (event.type === 'token') console.log(event.text);
    if (event.type === 'tool_call') console.log('Executing:', event.tool.name);
  }
});

await agent.run("Read the index.js file and summarize it");
\`\`\`

## Architecture
This framework manages the conversational history and prompt injection required to keep an LLM on track for multi-step tasks. If the model fails to output a valid tool call, the framework automatically intercepts and gently guides it back to the required XML format.
