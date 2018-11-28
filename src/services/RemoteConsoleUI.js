const os = require('os');
const {blue, red} = require('chalk');
const {join} = require('path');
const readline = require('readline');
const {CLIHistory, DIRECTION_NEXT, DIRECTION_PREV} = require('./CLIHistory');

module.exports = class RemoteConsoleUI {

  static create(debugServer) {
    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: blue('>> ')
    });
    return new RemoteConsoleUI(debugServer, readlineInterface);
  }

  constructor(debugServer, readlineInterface) {
    this._debugServer = debugServer;
    this._debugServer.onEvaluationCompleted = () => this._onEvaluationCompleted();
    this._cliHistory = new CLIHistory(join(os.homedir(), '.tabris-cli', 'cli_history.log'));
    this._readline = readlineInterface;
    this._readline.on('line', line => this._submitCommand(line));
    this._readline.on('close', () => process.exit(0));
    this._readline.input.on('keypress', (e, key) => {
      if (key.name === 'up' || key.name === 'down') {
        this._updateInput(key.name === 'up' ? DIRECTION_PREV : DIRECTION_NEXT);
      }
    });
    this._wrapConsoleObject();
    this._isWaitingForResponse = false;
  }

  _submitCommand(line) {
    const command = line.replace(/\;*$/, '');
    if (command !== '') {
      if (command === 'exit') {
        process.exit(0);
      }
      this._cliHistory.addToHistory(command);
      if (!this._debugServer.send(command)) {
        console.log(red('Command could not be sent: no device connected!'));
      } else {
        this._isWaitingForResponse = true;
        this._readline.pause();
      }
    }
  }

  _updateInput(direction) {
    this._cliHistory.moveHistory(direction);
    const command = this._cliHistory.currentHistory;
    this._readline.line = command;
    this._readline.cursor = command.length;
    this._readline.prompt(true);
  }

  _onEvaluationCompleted() {
    if (this._isWaitingForResponse) {
      this._isWaitingForResponse = false;
      this._readline.line = '';
      this._readline.prompt();
    }
  }

  _wrapConsoleObject() {
    const levels = ['log', 'info', 'error', 'debug', 'warn'];
    for (const level of levels) {
      const oldConsole = console[level];
      console[level] = (...args) => {
        // VT100 escape code to delete line
        this._readline.output.write('\x1b[2K\r');
        oldConsole.apply(console, Array.prototype.slice.call(args));
        if (!this._isWaitingForResponse) {
          this._readline.prompt(true);
        }
      };
    }
  }

};
