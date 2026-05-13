/**
 * agent-framework.js — A fully local ReAct (Reason+Act) agent framework.
 * Allows the local LLM to autonomously read and write files to the Virtual File System.
 */
import { vfs } from './file-system.js';
import { aiEngine } from './ai-engine.js';

export class LocalAgentFramework {
  constructor(uiCallback) {
    this.ui = uiCallback; // Function to stream text and status updates to the UI
    this.maxSteps = 10;
  }

  getSystemPrompt(workspaceFiles) {
    return `You are an autonomous AI software engineer running inside a local IDE.
You have the ability to execute tools to read and write files directly.
You must use a step-by-step approach: Reason, then Act.

Here are the tools available to you:

1. read_file
Reads the exact content of a file from the workspace.
Usage format:
\`\`\`tool
read_file
path: src/index.js
\`\`\`

2. write_file
Overwrites or creates a file with the given content.
Usage format:
\`\`\`tool
write_file
path: src/index.js
content:
console.log("Hello World");
\`\`\`

3. finish
Call this tool when the task is fully completed.
Usage format:
\`\`\`tool
finish
\`\`\`

Workspace Files:
${workspaceFiles.join('\n')}

INSTRUCTIONS:
- You can only use ONE tool per response.
- After you output a tool call, STOP generating. The system will execute the tool and provide you with the <tool_result>.
- Use the exact \`\`\`tool format specified above.`;
  }

  _parseToolCall(text) {
    const toolRegex = /\`\`\`tool\n(read_file|write_file|finish)\n(?:path:\s*(.*?)\n)?(?:content:\n([\s\S]*?))?\`\`\`/m;
    const match = text.match(toolRegex);
    if (!match) return null;

    return {
      name: match[1].trim(),
      path: match[2] ? match[2].trim() : null,
      content: match[3] ? match[3].trim() : null,
    };
  }

  async _executeTool(toolCall) {
    if (toolCall.name === 'read_file') {
      try {
        const content = vfs.readFile('/' + toolCall.path.replace(/^\//, ''));
        return content ? content : 'Error: File not found or empty.';
      } catch (e) {
        return `Error reading file: ${e.message}`;
      }
    } 
    
    if (toolCall.name === 'write_file') {
      try {
        vfs.writeFile('/' + toolCall.path.replace(/^\//, ''), toolCall.content);
        return `Success: Wrote ${toolCall.content.length} bytes to ${toolCall.path}.`;
      } catch (e) {
        return `Error writing file: ${e.message}`;
      }
    }

    if (toolCall.name === 'finish') {
      return 'Task Finished.';
    }

    return 'Error: Unknown tool.';
  }

  /**
   * Run the autonomous ReAct loop
   * @param {string} userTask 
   * @param {string[]} workspaceFiles 
   */
  async runAgentLoop(userTask, workspaceFiles) {
    let history = `<start_of_turn>user\n${this.getSystemPrompt(workspaceFiles)}\n\nTask: ${userTask}<end_of_turn>\n`;
    let stepCount = 0;

    while (stepCount < this.maxSteps) {
      stepCount++;
      this.ui({ type: 'status', message: `Agent Thinking (Step ${stepCount})...` });

      // Start Model Turn
      history += `<start_of_turn>model\n`;
      let currentResponse = '';

      // Generate response from local LLM
      await aiEngine.generateRaw(history, (partial) => {
        currentResponse = partial;
        this.ui({ type: 'token', text: partial });
      });

      history += `${currentResponse}<end_of_turn>\n`;

      // Check for tool calls
      const toolCall = this._parseToolCall(currentResponse);
      
      if (!toolCall) {
        // Model didn't call a tool. It probably just talked. Let's ask it to continue or finish.
        this.ui({ type: 'system', message: `⚠️ Agent didn't call a tool. Reminding it to act or finish.` });
        history += `<start_of_turn>user\nPlease use a \`\`\`tool block to take action, or use the 'finish' tool if you are done.<end_of_turn>\n`;
        continue;
      }

      this.ui({ type: 'tool_call', tool: toolCall });

      if (toolCall.name === 'finish') {
        this.ui({ type: 'system', message: `✅ Agent finished the task.` });
        break;
      }

      // Execute Tool
      const result = await this._executeTool(toolCall);
      this.ui({ type: 'tool_result', result: result, tool: toolCall });

      // Append result to history for next turn
      history += `<start_of_turn>user\n<tool_result>\n${result}\n</tool_result><end_of_turn>\n`;
    }

    if (stepCount >= this.maxSteps) {
      this.ui({ type: 'system', message: `🛑 Agent stopped (max steps reached).` });
    }
  }
}
