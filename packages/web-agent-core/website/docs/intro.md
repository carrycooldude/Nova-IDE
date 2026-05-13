---
sidebar_position: 1
---

# Getting Started

Welcome to **Nova Web Agent Core**!

This package provides a purely in-browser, WebGPU-accelerated, zero-dependency autonomous ReAct (Reason+Act) Agent Framework. It is built for local-first, privacy-respecting AI applications using MediaPipe GenAI and lightweight models like Gemma.

## Why this framework?

- **Zero Backend**: Runs entirely in the browser using WebGPU. Your users' data never leaves their device.
- **Autonomous Loop**: Implement ReAct loops (Reason -> Act -> Reason) without relying on cloud APIs.
- **Pluggable Tools**: Give your agent the ability to execute any javascript function (file system access, fetch, DOM manipulation).
- **XML-First Parsing**: Optimized for smaller models (2B-8B parameters) that handle XML tags better than JSON or Markdown parsing.

## Installation

Install the core package using NPM:

```bash
npm install local-web-agent-core
```

## Creating Your First Agent

To create an autonomous agent, you need two things:
1. **Tools**: The actions your agent can take.
2. **LLM Engine**: A wrapper around your model inference code.

### Step 1: Define Your Tools

Tools are JavaScript objects that define the schema and the execution logic.

```javascript
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
```

### Step 2: Define Your LLM Wrapper

Your LLM wrapper only needs one method: `generateRaw(prompt, onTokenCallback)`.

```javascript
const aiEngine = {
  generateRaw: async (prompt, onToken) => {
    // Call MediaPipe, Transformers.js, or even a cloud API here
    // stream tokens to onToken(token)
  }
};
```

### Step 3: Run the ReAct Loop

Initialize `WebAgent` with your configuration and pass it a task!

```javascript
import { WebAgent } from 'local-web-agent-core';

const agent = new WebAgent({
  llmEngine: aiEngine,
  tools: myTools,
  onUpdate: (event) => {
    // Stream UI updates to your frontend
    if (event.type === 'token') console.log(event.text);
    if (event.type === 'tool_call') console.log('Executing:', event.tool.name);
  }
});

// Watch your agent go to work!
await agent.run("Read the index.js file and summarize it");
```
