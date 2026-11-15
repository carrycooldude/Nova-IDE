export class WebAgent {
  constructor(config) {
    this.llm = config.llmEngine;
    this.tools = config.tools || [];
    this.ui = config.onUpdate || (() => {});
    this.systemPrompt = config.systemPrompt || '';
    this.maxSteps = config.maxSteps || 10;
  }

  _buildSystemPrompt() {
    const toolDocs = this.tools.map((tool, index) => `
${index + 1}. ${tool.name}
${tool.description}
Usage format:
<tool_call>
<name>${tool.name}</name>
${tool.usage}
</tool_call>`).join('\n');

    return `You are an autonomous coding agent running inside a local IDE.
You must use tools for workspace inspection and file changes.

${this.systemPrompt}

Available tools:
${toolDocs}

Tool protocol:
- You MUST output exactly one <tool_call> XML block when taking an action.
- Do not wrap tool calls in markdown.
- Use list_files or search_workspace before read_file unless the exact file path is already known.
- Use finish when the task is complete.
- Keep reasoning to one short sentence before the tool call.`;
  }

  _parseToolCall(text) {
    const toolRegex = /<tool_call>([\s\S]*?)<\/tool_call>/i;
    const match = String(text || '').match(toolRegex);
    if (!match) return null;

    const args = {};
    const tagRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(match[1])) !== null) {
      args[tagMatch[1].trim()] = tagMatch[2].trim();
    }

    return args.name ? args : null;
  }

  async _executeTool(args) {
    const tool = this.tools.find(t => t.name === args.name);
    if (!tool) return `Error: Tool "${args.name}" not found.`;

    try {
      return await tool.execute(args);
    } catch (e) {
      return `Error executing tool ${args.name}: ${e.message}`;
    }
  }

  async run(userTask) {
    let history = `<start_of_turn>user\n${this._buildSystemPrompt()}\n\nTask: ${userTask}<end_of_turn>\n`;
    let stepCount = 0;
    let invalidToolResponses = 0;

    while (stepCount < this.maxSteps) {
      stepCount++;
      this.ui({ type: 'status', message: `Agent thinking (step ${stepCount})...` });

      history += `<start_of_turn>model\n`;
      let currentResponse = '';
      await this.llm.generateRaw(history, (partial) => {
        currentResponse = partial;
        this.ui({ type: 'token', text: partial });
      });

      history += `${currentResponse}<end_of_turn>\n`;

      const toolCall = this._parseToolCall(currentResponse);
      if (!toolCall) {
        invalidToolResponses++;
        this.ui({ type: 'system', message: 'Agent did not call a tool. Retrying with stricter instructions.' });
        if (invalidToolResponses >= 2) {
          this.ui({ type: 'agent_fallback', reason: 'tool_format_failed', lastResponse: currentResponse });
          break;
        }
        history += `<start_of_turn>user\nYour previous response did not contain a valid tool call. Output exactly one <tool_call> block now. Use search_workspace if you need to find something.<end_of_turn>\n`;
        continue;
      }

      invalidToolResponses = 0;
      this.ui({ type: 'tool_call', tool: toolCall });

      if (toolCall.name === 'finish') {
        this.ui({ type: 'system', message: 'Agent finished the task.' });
        break;
      }

      const result = await this._executeTool(toolCall);
      this.ui({ type: 'tool_result', result, tool: toolCall });
      history += `<start_of_turn>user\n<tool_result>\n${result}\n</tool_result>\n\nUse the result to take the next step with exactly one <tool_call> block.<end_of_turn>\n`;
    }

    if (stepCount >= this.maxSteps) {
      this.ui({ type: 'system', message: 'Agent stopped because it reached the max step count.' });
    }
  }
}
