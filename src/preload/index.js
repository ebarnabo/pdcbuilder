import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args)

const api = {
  platform: process.platform,

  state: {
    get: invoke('state:get'),
    patch: invoke('state:patch'),
    resetCatalog: invoke('state:reset-catalog')
  },
  fs: {
    pickDir: invoke('fs:pick-dir'),
    openPath: invoke('fs:open-path'),
    reveal: invoke('fs:reveal'),
    openUrl: invoke('fs:open-url'),
    exists: invoke('fs:exists'),
    write: invoke('fs:write'),
    read: invoke('fs:read'),
    tree: invoke('fs:tree')
  },
  project: {
    create: invoke('project:create'),
    import: invoke('project:import'),
    duplicate: invoke('project:duplicate'),
    remove: invoke('project:delete'),
    update: invoke('project:update'),
    addLibs: invoke('project:add-libs'),
    repair: invoke('project:repair'),
    scan: invoke('project:scan'),
    syncGithub: invoke('project:sync-github'),
    fetchRemote: invoke('project:fetch-remote')
  },
  run: {
    dev: invoke('run:dev'),
    stop: invoke('run:stop'),
    stopAll: invoke('run:stop-all'),
    list: invoke('run:list'),
    build: invoke('run:build'),
    preview: invoke('run:preview'),
    command: invoke('run:command'),
    openBuild: invoke('run:open-build'),
    openBuildFile: invoke('run:open-build-file'),
    buildInfo: invoke('run:build-info')
  },
  blueprint: {
    save: invoke('blueprint:save'),
    remove: invoke('blueprint:delete'),
    duplicate: invoke('blueprint:duplicate'),
    fromProject: invoke('blueprint:from-project')
  },
  ai: {
    providers: invoke('ai:providers'),
    models: invoke('ai:models'),
    chat: invoke('ai:chat'),
    stop: invoke('ai:stop')
  },
  editor: { open: invoke('app:open-editor') },
  git: {
    status: invoke('git:status'),
    publish: invoke('git:publish'),
    push: invoke('git:push'),
    pull: invoke('git:pull'),
    link: invoke('git:link'),
    detect: invoke('git:detect'),
    list: invoke('git:list'),
    clone: invoke('git:clone'),
    board: invoke('git:board')
  },
  app: {
    updateStatus: invoke('app:update-status'),
    checkUpdate: invoke('app:update-check'),
    installUpdate: invoke('app:update-install')
  },
  window: {
    minimize: invoke('window:minimize'),
    toggleMax: invoke('window:toggle-max'),
    close: invoke('window:close'),
    isMaximized: invoke('window:is-maximized')
  },
  docs: {
    status: invoke('docs:status'),
    index: invoke('docs:index'),
    get: invoke('docs:get'),
    refresh: invoke('docs:refresh'),
    open: invoke('docs:open')
  },
  database: {
    list: invoke('database:list'),
    apply: invoke('database:apply'),
    cloudStatus: invoke('database:cloud-status'),
    cloudTest: invoke('database:cloud-test'),
    cloudList: invoke('database:cloud-list'),
    cloudCreate: invoke('database:cloud-create'),
    cloudMcp: invoke('database:cloud-mcp')
  },
  pm: {
    status: invoke('pm:status'),
    install: invoke('pm:install'),
    update: invoke('pm:update'),
    updateAll: invoke('pm:update-all')
  },
  toolchain: {
    status: invoke('toolchain:status'),
    install: invoke('toolchain:install'),
    uninstall: invoke('toolchain:uninstall'),
    update: invoke('toolchain:update')
  },
  payload: {
    prereqs: invoke('payload:prereqs'),
    options: invoke('payload:options')
  },
  sanity: {
    prereqs: invoke('sanity:prereqs'),
    options: invoke('sanity:options')
  },
  wordpress: {
    prereqs: invoke('wordpress:prereqs'),
    options: invoke('wordpress:options')
  },
  preferences: {
    path: invoke('preferences:path'),
    open: invoke('preferences:open')
  },

  on: (channel, handler) => {
    const listener = (_e, payload) => handler(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('pdc', api)
