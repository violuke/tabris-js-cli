const STATE_CHECK_INTERVAL = process.env.NODE_ENV === 'test' ? 500 : 5000;
const TYPE_CONNECTION = 'connect';
const TYPE_LOG = 'log';
const TYPE_ACTION_RESPONSE = 'action-response';

module.exports = class DebugConnection {

  constructor({sessionId, webSocket}) {
    this._sessionId = sessionId;
    this._webSocket = webSocket;
    this.device = {
      platform: '',
      model: ''
    };
    this._isAlive = true;
    this._interval = null;
    this._onEvaluationCompleted = null;
    this._webSocket.on('pong', () => this._isAlive = true);
    this._scheduleClientConnectionStateChecks();
    this._registerMessageHandler();
  }

  close(code) {
    clearInterval(this._interval);
    if (this._onDisconnect) {
      this._onDisconnect(this);
    }
    this._webSocket.close(code);
  }

  send(command) {
    if (command && this._isAlive) {
      this._webSocket.send(command);
      return true;
    }
    return false;
  }

  set onConnect(cb) {
    this._onConnect = cb;
  }

  set onDisconnect(cb) {
    this._onDisconnect = cb;
  }

  set onLog(cb) {
    this._onLog = cb;
  }

  set onActionResponse(cb) {
    this._onActionResponse = cb;
  }

  get isAlive() {
    return this._isAlive;
  }

  get sessionId() {
    return this._sessionId;
  }

  _registerMessageHandler() {
    this._webSocket.on('message', (message) => {
      try {
        const clientMessage = JSON.parse(message);
        if (clientMessage.type === TYPE_CONNECTION) {
          this.device = clientMessage.parameter;
          if (this._onConnect) {
            this._onConnect(this);
          }
        } else if (clientMessage.type === TYPE_LOG) {
          if (this._onLog) {
            this._onLog(this, clientMessage.parameter);
          }
        } else if(clientMessage.type === TYPE_ACTION_RESPONSE) {
          if (this._onActionResponse) {
            this._onActionResponse(this, clientMessage.parameter);
          }
        }
      } catch (ex) {}
    });
  }

  _scheduleClientConnectionStateChecks() {
    this._interval = setInterval(() => {
      if (!this._isAlive) {
        if (this._onDisconnect) {
          this._onDisconnect(this);
        }
        clearInterval(this._interval);
        return this._webSocket.close();
      }
      this._isAlive = false;
      if (this._webSocket.ping) {
        this._webSocket.ping(() => {});
      }
    }, STATE_CHECK_INTERVAL);
  }

};
