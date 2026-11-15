import { vfs } from './file-system.js';

function normalizePath(path) {
  const normalized = String(path || '/').replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized ? `/${normalized}` : '/';
}

function countChangedLines(before, after) {
  const beforeLines = String(before || '').split('\n');
  const afterLines = String(after || '').split('\n');
  const max = Math.max(beforeLines.length, afterLines.length);
  let added = 0;
  let removed = 0;

  for (let i = 0; i < max; i++) {
    if (beforeLines[i] === afterLines[i]) continue;
    if (beforeLines[i] === undefined) added++;
    else if (afterLines[i] === undefined) removed++;
    else {
      added++;
      removed++;
    }
  }

  return { added, removed };
}

class ChangeProposalManager {
  constructor() {
    this.proposals = [];
    this.checkpoints = [];
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(event) {
    this.listeners.forEach(fn => fn(event));
  }

  createRunId() {
    return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  propose({ path, content = '', type = 'modify', sourceRunId, task = 'Agent change' }) {
    const normalized = normalizePath(path);
    const existing = vfs.readFile(normalized);
    const before = existing?.content ?? '';
    const after = type === 'delete' ? '' : String(content ?? '');
    const stats = countChangedLines(before, after);
    const proposal = {
      id: `proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      path: normalized,
      before,
      after,
      type: type === 'delete' ? 'delete' : existing ? 'modify' : 'create',
      status: 'pending',
      sourceRunId: sourceRunId || this.createRunId(),
      task,
      createdAt: Date.now(),
      added: stats.added,
      removed: stats.removed,
    };

    this.proposals.push(proposal);
    this._emit({ type: 'proposal_created', proposal });
    return proposal;
  }

  getPending(sourceRunId = null) {
    return this.proposals.filter(proposal =>
      proposal.status === 'pending' && (!sourceRunId || proposal.sourceRunId === sourceRunId)
    );
  }

  getLatestCheckpoint() {
    return this.checkpoints[this.checkpoints.length - 1] || null;
  }

  _createCheckpoint(proposals, task) {
    const affected = new Map();
    for (const proposal of proposals) {
      if (affected.has(proposal.path)) continue;
      const file = vfs.readFile(proposal.path);
      affected.set(proposal.path, {
        path: proposal.path,
        existed: Boolean(file),
        content: file?.content ?? '',
      });
    }

    const checkpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      task: task || proposals[0]?.task || 'Agent change',
      createdAt: Date.now(),
      files: [...affected.values()],
    };

    this.checkpoints.push(checkpoint);
    this._emit({ type: 'checkpoint_created', checkpoint });
    return checkpoint;
  }

  async applyProposal(id) {
    const proposal = this.proposals.find(item => item.id === id);
    if (!proposal || proposal.status !== 'pending') return null;

    this._createCheckpoint([proposal], proposal.task);
    await this._apply(proposal);
    proposal.status = 'applied';
    proposal.appliedAt = Date.now();
    this._emit({ type: 'proposal_applied', proposal });
    return proposal;
  }

  async applyAll(sourceRunId = null) {
    const pending = this.getPending(sourceRunId);
    if (!pending.length) return [];

    this._createCheckpoint(pending, pending[0].task);
    for (const proposal of pending) {
      await this._apply(proposal);
      proposal.status = 'applied';
      proposal.appliedAt = Date.now();
    }
    this._emit({ type: 'proposals_applied', proposals: pending });
    return pending;
  }

  async _apply(proposal) {
    if (proposal.type === 'delete') {
      await vfs.deletePath(proposal.path);
      return;
    }
    const write = vfs.readFile(proposal.path) ? vfs.writeFile : vfs.createFile;
    await write.call(vfs, proposal.path, proposal.after);
  }

  discardProposal(id) {
    const proposal = this.proposals.find(item => item.id === id);
    if (!proposal || proposal.status !== 'pending') return null;
    proposal.status = 'discarded';
    proposal.discardedAt = Date.now();
    this._emit({ type: 'proposal_discarded', proposal });
    return proposal;
  }

  discardAll(sourceRunId = null) {
    const pending = this.getPending(sourceRunId);
    pending.forEach(proposal => {
      proposal.status = 'discarded';
      proposal.discardedAt = Date.now();
    });
    this._emit({ type: 'proposals_discarded', proposals: pending });
    return pending;
  }

  async rollbackLatest() {
    const checkpoint = this.checkpoints.pop();
    if (!checkpoint) return null;

    for (const file of checkpoint.files) {
      if (file.existed) {
        await vfs.writeFile(file.path, file.content);
      } else if (vfs.readFile(file.path)) {
        await vfs.deletePath(file.path);
      }
    }

    this._emit({ type: 'checkpoint_rolled_back', checkpoint });
    return checkpoint;
  }
}

export const proposalManager = new ChangeProposalManager();
