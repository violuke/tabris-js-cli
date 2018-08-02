const DebugConnection = require('../helpers/DebugConnection');
const url = require('url');

const OUTDATED_CONNECTION_CLOSURE = 4900;

module.exports = class DebugServer {

  constructor(webSocketServer) {
    this._webSocketServer = webSocketServer;
    this._sessionId = 0;
    this._connection = null;
  }

  start() {
    this._webSocketServer.on('connection', (webSocket, req) => {
      const requestUrl = webSocket.url || req.url;
      const sessionId = url.parse(requestUrl, true).query.id;
      if (this._isMostRecentSession(sessionId)) {
        this._clientOutdatedConnection();
        this._connection = new DebugConnection({sessionId, webSocket});
      }
    });
  }

  // only using for unit testing
  stop() {
    this._connection.close(1000);
    this._webSocketServer = null;
  }

  send(command) {
    if (this._connection) {
      return this._connection.send(command);
    }
    return false;
  }

  getNewSessionId() {
    return ++this._sessionId;
  }

  get port() {
    return this._webSocketServer.options.port;
  }

  _clientOutdatedConnection() {
    if (this._isConnectionAlive() && !this._isMostRecentSession(this._connection.sessionId)) {
      this._connection.close(OUTDATED_CONNECTION_CLOSURE);
    }
  }

  _isMostRecentSession(id) {
    return id.toString() === this._sessionId.toString();
  }

  _isConnectionAlive() {
    return this._connection && this._connection.isAlive;
  }

};