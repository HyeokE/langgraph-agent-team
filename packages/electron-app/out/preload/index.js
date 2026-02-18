"use strict";
const electron = require("electron");
function createEventSubscriber(channel) {
  return (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  };
}
electron.contextBridge.exposeInMainWorld("electronAPI", {
  teams: {
    list: () => electron.ipcRenderer.invoke("teams:list"),
    get: (id) => electron.ipcRenderer.invoke("teams:get", id),
    create: (def) => electron.ipcRenderer.invoke("teams:create", def),
    update: (id, patch) => electron.ipcRenderer.invoke("teams:update", id, patch),
    delete: (id) => electron.ipcRenderer.invoke("teams:delete", id)
  },
  tools: {
    list: () => electron.ipcRenderer.invoke("tools:list"),
    get: (id) => electron.ipcRenderer.invoke("tools:get", id),
    create: (def) => electron.ipcRenderer.invoke("tools:create", def),
    update: (id, patch) => electron.ipcRenderer.invoke("tools:update", id, patch),
    delete: (id) => electron.ipcRenderer.invoke("tools:delete", id)
  },
  envs: {
    list: () => electron.ipcRenderer.invoke("envs:list"),
    set: (key, value, description) => electron.ipcRenderer.invoke("envs:set", key, value, description),
    delete: (id) => electron.ipcRenderer.invoke("envs:delete", id),
    listKeys: () => electron.ipcRenderer.invoke("envs:listKeys")
  },
  execution: {
    start: (teamId, input) => electron.ipcRenderer.invoke("execution:start", teamId, input),
    cancel: (sessionId) => electron.ipcRenderer.invoke("execution:cancel", sessionId),
    listActive: () => electron.ipcRenderer.invoke("execution:listActive"),
    onStep: createEventSubscriber("team:step"),
    onRoute: createEventSubscriber("team:route"),
    onComplete: createEventSubscriber("team:complete"),
    onError: createEventSubscriber("team:error"),
    onMessage: createEventSubscriber("team:message")
  },
  auth: {
    getStatus: () => electron.ipcRenderer.invoke("auth:status"),
    login: () => electron.ipcRenderer.invoke("auth:login"),
    setToken: (token) => electron.ipcRenderer.invoke("auth:setToken", token),
    logout: () => electron.ipcRenderer.invoke("auth:logout")
  },
  runs: {
    list: (teamId) => electron.ipcRenderer.invoke("runs:list", teamId)
  },
  setup: {
    getStatus: () => electron.ipcRenderer.invoke("setup:status"),
    onStatus: (cb) => {
      const handler = (_, data) => cb(data);
      electron.ipcRenderer.on("setup:status", handler);
      return () => electron.ipcRenderer.removeListener("setup:status", handler);
    }
  },
  assistant: {
    send: (message, context, history) => electron.ipcRenderer.invoke("assistant:send", message, context, history),
    cancel: (requestId) => electron.ipcRenderer.invoke("assistant:cancel", requestId),
    onResponse: createEventSubscriber("assistant:response"),
    onAction: createEventSubscriber("assistant:action"),
    onError: createEventSubscriber("assistant:error")
  }
});
