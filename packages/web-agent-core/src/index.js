export class WebAgent {
  /**
   * @param {Object} config
   * @param {Object} config.llmEngine - Engine with a generateRaw(history, callback) method
   * @param {Array} config.tools - Array of tool definitions { name, description, usage, execute(args) }
   * @param {Function} config.onUpdate - Callback for UI updates
   * @param {string} config.systemPrompt - Additional context for the system prompt
   * @param {number} config.maxSteps - Maximum ReAct loops
   */
  constructor(config) {
    this.llm = config.llmEngine;
    this.tools = config.tools || [];
    this.ui = config.onUpdate || (() => {});
    this.systemPrompt = config.systemPrompt || '';
    this.maxSteps = config.maxSteps || 10;
  }

  _buildSystemPrompt() {
    let toolDocs = this.tools.map((t, index) => `
${index + 1}. ${t.name}
${t.description}
Usage format:
<tool_call>
<name>${t.name}</name>
${t.usage}
</tool_call>`).join('\n');

    return `You are an autonomous AI agent running inside a local browser environment.
You must use a step-by-step approach: Reason, then Act.

${this.systemPrompt}

Here are the tools available to you:
${toolDocs}

INSTRUCTIONS:
- You MUST use the exact <tool_call> XML format shown above to take an action.
- You can only use ONE tool per response.
- After you output a <tool_call>, STOP generating. The system will execute the tool and provide you with the <tool_result>.`;
  }

  _parseToolCall(text) {
    // Very flexible regex that matches the tool call XML block and extracts any inner tags dynamically
    const toolRegex = /<tool_call>([\s\S]*?)<\/tool_call>/i;
    const match = text.match(toolRegex);
    if (!match) return null;

    const innerXml = match[1];
    const args = {};
    
    // Extract all top-level tags like <name>, <path>, <content>, etc.
    const tagRegex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(innerXml)) !== null) {
      args[tagMatch[1].trim()] = tagMatch[2].trim();
    }

    if (!args.name) return null;

    return args;
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

  /**
   * Run the autonomous ReAct loop
   * @param {string} userTask 
   */
  async run(userTask) {
    let history = `<start_of_turn>user\n${this._buildSystemPrompt()}\n\nTask: ${userTask}<end_of_turn>\n`;
    let stepCount = 0;

    while (stepCount < this.maxSteps) {
      stepCount++;
      this.ui({ type: 'status', message: `Agent Thinking (Step ${stepCount})...` });

      // Start Model Turn
      history += `<start_of_turn>model\n`;
      let currentResponse = '';

      // Generate response from local LLM
      await this.llm.generateRaw(history, (partial) => {
        currentResponse = partial;
        this.ui({ type: 'token', text: partial });
      });

      history += `${currentResponse}<end_of_turn>\n`;

      // Check for tool calls
      const toolCall = this._parseToolCall(currentResponse);
      
      if (!toolCall) {
        this.ui({ type: 'system', message: `⚠️ Agent didn't call a tool. Reminding it to act or finish.` });
        history += `<start_of_turn>user\nPlease use a <tool_call> XML block to take action, or use the 'finish' tool if you are done.<end_of_turn>\n`;
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
      history += `<start_of_turn>user\n<tool_result>\n${result}\n</tool_result>\n\nAnalyze the result and take your next step using a <tool_call> block.<end_of_turn>\n`;
    }

    if (stepCount >= this.maxSteps) {
      this.ui({ type: 'system', message: `🛑 Agent stopped (max steps reached).` });
    }
  }
}
