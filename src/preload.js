const { contextBridge, ipcRenderer } = require('electron');

const send = (channel) => (arg) => ipcRenderer.send(channel, arg);

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onPetEvent: (fn) => ipcRenderer.on('pet:event', (_e, p) => fn(p)),
  toggle: send('timer:toggle'),
  reset: send('timer:reset'),
  skip: send('timer:skip'),
  setPhase: send('timer:phase'),
  updateSettings: send('settings:update'),
  spotifyConnect: send('spotify:connect'),
  spotifyDisconnect: send('spotify:disconnect'),
  addTask: send('tasks:add'),
  toggleTask: send('tasks:toggle'),
  removeTask: send('tasks:remove'),
  clearDoneTasks: send('tasks:clearDone'),
  petHover: send('pet:hover'),
  minimize: send('win:minimize'),
  close: send('win:close'),
});
