const filewatcher = require('filewatcher');

module.exports = class Watcher {

  constructor(server) {
    this._server = server;
    this._watcher = filewatcher({
      debounce: 1000,
      persistent: true
    });
    this._server.on('deliver', url => {
      this._watcher.add(url);
    });
  }

  start() {
    this._watcher.on('change', (filename, stat) => {
      if (stat && this._server.debugServer.send('tabris.app.reload()')) {
        this._server.terminal.info(`${filename}' changed, reloading app...`);
      }
    });
  }

  // only using for unit testing
  stop() {
    this._watcher.removeAll();
  }

};
