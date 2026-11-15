import { vfs } from './file-system.js';
import { aiEngine } from './ai-engine.js';
import { proposalManager } from './change-manager.js';
import { formatWorkspaceSummary, searchWorkspace } from './workspace-index.js';
import { WebAgent } from '../packages/web-agent-core/src/index.js';

export class LocalAgentFramework {
  constructor(uiCallback, options = {}) {
    this.ui = uiCallback;
    this.runId = options.runId || proposalManager.createRunId();
    this.task = options.task || 'Agent task';
    
    // Define the tools specific to Nova IDE
    const ideTools = [
      {
        name: 'list_files',
        description: 'Lists workspace files. Optional pattern filters by substring.',
        usage: '<pattern>optional text</pattern>',
        execute: async (args) => {
          const pattern = String(args.pattern || '').trim().toLowerCase();
          const files = [...vfs.files.keys()]
            .filter(path => !pattern || path.toLowerCase().includes(pattern))
            .slice(0, 200);
          return files.length ? files.join('\n') : 'No matching files.';
        }
      },
      {
        name: 'search_workspace',
        description: 'Searches filenames and file contents in the active workspace.',
        usage: '<query>search terms</query>\n<maxResults>8</maxResults>',
        execute: async (args) => {
          const results = searchWorkspace(args.query || '', Number(args.maxResults || 8));
          if (!results.length) return 'No matches.';
          return results.map(result => {
            const matches = result.matches?.length
              ? result.matches.map(match => `L${match.line}: ${match.text}`).join('\n')
              : result.snippet;
            return `${result.path}\n${matches}`;
          }).join('\n\n---\n\n');
        }
      },
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
        description: 'Proposes overwriting or creating a file. The user must apply the proposal before it changes disk.',
        usage: '<path>src/index.js</path>\n<content>console.log("Hello World");</content>',
        execute: async (args) => {
          try {
            const proposal = proposalManager.propose({
              path: '/' + args.path.replace(/^\//, ''),
              content: args.content || '',
              sourceRunId: this.runId,
              task: this.task,
            });
            this.ui({ type: 'proposal', proposal });
            return `Proposed ${proposal.type} for ${proposal.path}. Awaiting user review.`;
          } catch (e) {
            return `Error proposing file change: ${e.message}`;
          }
        }
      },
      {
        name: 'propose_file_change',
        description: 'Proposes a complete replacement for a file. The user can inspect and apply it.',
        usage: '<path>src/index.js</path>\n<content>complete file content</content>',
        execute: async (args) => {
          try {
            const proposal = proposalManager.propose({
              path: '/' + args.path.replace(/^\//, ''),
              content: args.content || '',
              sourceRunId: this.runId,
              task: this.task,
            });
            this.ui({ type: 'proposal', proposal });
            return `Proposed ${proposal.type} for ${proposal.path}.`;
          } catch (e) {
            return `Error proposing file change: ${e.message}`;
          }
        }
      },
      {
        name: 'create_file',
        description: 'Proposes creating a new file. The user must apply it before it changes disk.',
        usage: '<path>src/new-file.js</path>\n<content>file content</content>',
        execute: async (args) => {
          try {
            const proposal = proposalManager.propose({
              path: '/' + args.path.replace(/^\//, ''),
              content: args.content || '',
              type: 'create',
              sourceRunId: this.runId,
              task: this.task,
            });
            this.ui({ type: 'proposal', proposal });
            return `Proposed creating ${proposal.path}.`;
          } catch (e) {
            return `Error proposing file creation: ${e.message}`;
          }
        }
      },
      {
        name: 'delete_file',
        description: 'Proposes deleting a file. The user must apply it before it changes disk.',
        usage: '<path>src/old-file.js</path>',
        execute: async (args) => {
          try {
            const proposal = proposalManager.propose({
              path: '/' + args.path.replace(/^\//, ''),
              type: 'delete',
              sourceRunId: this.runId,
              task: this.task,
            });
            this.ui({ type: 'proposal', proposal });
            return `Proposed deleting ${proposal.path}.`;
          } catch (e) {
            return `Error proposing file deletion: ${e.message}`;
          }
        }
      },
      {
        name: 'finish',
        description: 'Call this tool when the task is fully completed.',
        usage: '<summary>what changed or what was proposed</summary>',
        execute: async (args) => args.summary || 'Task Finished.'
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
    this.agent.systemPrompt = `${formatWorkspaceSummary()}

Workspace Files:
${workspaceFiles.join('\n')}

Rules:
- Inspect the workspace with list_files, search_workspace, and read_file before proposing changes.
- For code changes, use propose_file_change, create_file, delete_file, or write_file.
- File-changing tools only create proposals. The user applies or discards them.
- Keep changes scoped to the requested task.`;
    await this.agent.run(userTask);
  }
}
