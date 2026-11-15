/**
 * terminal.js - Simulated environment panel with browser/runtime diagnostics.
 */

export class Terminal {
  constructor(container) {
    this.container = container;
    this.history = [];
    this.historyIndex = -1;
    this.render();
    this._bindEvents();
    this._print('Nova IDE Environment Panel v1.0', 'success');
    this._print('This is a simulated environment panel, not a real shell. Type "help" for available commands.\n');
  }

  render() {
    this.container.innerHTML = `<div class="terminal" id="terminal-output"></div>`;
    this._addPrompt();
  }

  _addPrompt() {
    const output = this.container.querySelector('#terminal-output');
    const line = document.createElement('div');
    line.className = 'terminal__line';
    line.innerHTML = `
      <span class="terminal__prompt">&gt;</span>
      <input class="terminal__input" id="terminal-input" type="text"
        spellcheck="false" autocomplete="off" autofocus>
    `;
    output.appendChild(line);
    line.querySelector('#terminal-input').focus();
    this._scrollToBottom();
  }

  _bindEvents() {
    this.container.addEventListener('click', () => {
      this.container.querySelector('#terminal-input')?.focus();
    });

    this.container.addEventListener('keydown', (e) => {
      const input = this.container.querySelector('#terminal-input');
      if (!input || document.activeElement !== input) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = input.value.trim();
        input.disabled = true;
        input.removeAttribute('id');
        if (cmd) {
          this.history.push(cmd);
          this.historyIndex = this.history.length;
        }
        this._execute(cmd);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          input.value = this.history[this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          input.value = this.history[this.historyIndex];
        } else {
          this.historyIndex = this.history.length;
          input.value = '';
        }
      }
    });
  }

  _execute(cmd) {
    if (!cmd) {
      this._addPrompt();
      return;
    }

    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'help':
        this._print([
          'Available commands:',
          '  help          - Show this help',
          '  clear         - Clear panel',
          '  echo <text>   - Print text',
          '  date          - Show current date/time',
          '  env           - Show environment info',
          '  eval <expr>   - Evaluate JavaScript',
          '  model         - Show AI model status',
          '  version       - Show IDE version',
        ].join('\n'));
        break;
      case 'clear':
        this.container.querySelector('#terminal-output').innerHTML = '';
        this._addPrompt();
        return;
      case 'echo':
        this._print(parts.slice(1).join(' '));
        break;
      case 'date':
        this._print(new Date().toString());
        break;
      case 'env':
        this._print([
          `Platform:  ${navigator.platform}`,
          `UserAgent: ${navigator.userAgent.slice(0, 80)}...`,
          `WebGPU:    ${navigator.gpu ? 'Available' : 'Not available'}`,
          `Memory:    ${navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown'}`,
          `Cores:     ${navigator.hardwareConcurrency || 'Unknown'}`,
          `Language:  ${navigator.language}`,
        ].join('\n'));
        break;
      case 'eval':
        try {
          const expr = parts.slice(1).join(' ');
          const result = new Function(`return (${expr})`)();
          this._print(String(result), 'success');
        } catch (err) {
          this._print(`Error: ${err.message}`, 'error');
        }
        break;
      case 'model':
        this._print('Use the AI panel to load LiteRT LM and inspect model status.');
        break;
      case 'version':
        this._print('Nova IDE v1.0.0\nPowered by LiteRT LM and WebGPU', 'success');
        break;
      default:
        this._print(`Command not found: ${command}. Type "help" for available commands.`, 'error');
    }

    this._addPrompt();
  }

  _print(text, type = '') {
    const output = this.container.querySelector('#terminal-output');
    const div = document.createElement('div');
    div.className = `terminal__output${type ? ` terminal__output--${type}` : ''}`;
    div.textContent = text;
    output.appendChild(div);
    this._scrollToBottom();
  }

  _scrollToBottom() {
    const el = this.container.querySelector('#terminal-output');
    if (el) el.scrollTop = el.scrollHeight;
  }
}
