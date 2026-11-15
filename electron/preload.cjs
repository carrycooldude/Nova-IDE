const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('novaDesktop', {
  isElectron: true,
  selectWorkspace: () => invoke('nova:select-workspace'),
  selectFile: () => invoke('nova:select-file'),
  readDirectory: () => invoke('nova:read-directory'),
  readFile: path => invoke('nova:read-file', path),
  writeFile: (path, content) => invoke('nova:write-file', path, content),
  createFile: (path, content) => invoke('nova:create-file', path, content),
  deletePath: path => invoke('nova:delete-path', path),
  renamePath: (oldPath, newPath) => invoke('nova:rename-path', oldPath, newPath),
  saveFileAs: (content, suggestedName) => invoke('nova:save-file-as', content, suggestedName),
  findLocalModel: filename => invoke('nova:find-local-model', filename),
  getModelSearchDirs: () => invoke('nova:get-model-search-dirs'),
  getWorkspaceRoot: () => invoke('nova:get-workspace-root'),
  closeWorkspace: () => invoke('nova:close-workspace'),
  onMenuCommand: callback => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('nova:menu-command', listener);
    return () => ipcRenderer.removeListener('nova:menu-command', listener);
  },
});
