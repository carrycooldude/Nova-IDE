import { vfs } from './file-system.js';
import { aiEngine } from './ai-engine.js';
import { WebAgent } from '../packages/web-agent-core/src/index.js';

export class LocalAgentFramework {
  constructor(uiCallback) {
    this.ui = uiCallback;
    
    // Define the tools specific to Nova IDE
    const ideTools = [
      {
        name: 'read_file',
        description: 'Reads the exact content of a file from the workspace.',
        usage: '<path>src/index.js</path>',
        execute: async (args) => {
          try {
            const fileObj = vfs.readFile('/' + args.path.replace(/^\//, ''));
            return fileObj ? fileObj.content : 'Error: File not found.';
          } catch (e) {
            return `Error reading file: ${e.message}`;
          }
        }
      },
      {
        name: 'write_file',
        description: 'Overwrites or creates a file with the given content.',
        usage: '<path>src/index.js</path>\n<content>console.log("Hello World");</content>',
        execute: async (args) => {
          try {
            vfs.writeFile('/' + args.path.replace(/^\//, ''), args.content);
            return `Success: Wrote ${args.content.length} bytes to ${args.path}.`;
          } catch (e) {
            return `Error writing file: ${e.message}`;
          }
        }
      },
      {
        name: 'finish',
        description: 'Call this tool when the task is fully completed.',
        usage: '',
        execute: async () => 'Task Finished.'
      }
    ];

    // Instantiate the generalized WebAgent core
    this.agent = new WebAgent({
      llmEngine: aiEngine,
      tools: ideTools,
      onUpdate: this.ui,
      maxSteps: 10
    });
  }

  async runAgentLoop(userTask, workspaceFiles) {
    // Pass workspace files as system prompt modifier
    this.agent.systemPrompt = `Workspace Files:\n${workspaceFiles.join('\n')}`;
    await this.agent.run(userTask);
  }
}
