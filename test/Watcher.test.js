const temp = require('temp');
const fetch = require('node-fetch');
const {join} = require('path');
const Server = require('../src/services/Server');
const Watcher = require('../src/services/Watcher');
const {expect, restore, spy} = require('./test');
const {writeFileSync, realpathSync, mkdirSync} = require('fs-extra');
const TerminalMock = require('./TerminalMock.js');

describe('Watcher', function() {

  let server, path, oldCwd, watcher;

  this.timeout(10000);

  beforeEach(function() {
    path = realpathSync(temp.mkdirSync('foo'));
    oldCwd = process.cwd();
    process.chdir(path);
    server = new Server({terminal: new TerminalMock()});
    watcher = new Watcher(server);
    watcher.start();
  });

  afterEach(function() {
    process.chdir(oldCwd);
    watcher.stop();
    restore();
  });

  describe('when changed file was never requested', function() {

    it('does not send reload command', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      writeFileSync(join(path, 'foo.js'), 'console.log("test")');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/foo.js`))
        .then(response => response.text())
        .then(text => {
          spy(server.debugServer, 'send');
          writeFileSync(join(path, 'bar.js'), `${text};`);
          return new Promise(resolve => {
            setTimeout(() => {
              expect(server.debugServer.send).not.to.have.been.called;
              resolve();
            }, 1500);
          });
        });
    }).timeout(6000);

  });

  describe('when changed file was requested', function() {

    it('sends a reload command', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      writeFileSync(join(path, 'foo.js'), 'console.log("test")');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/foo.js`))
        .then(response => response.text())
        .then(text => {
          spy(server.debugServer, 'send');
          writeFileSync(join(path, 'foo.js'), `${text};`);
          return waitForCalls(server.debugServer.send, 1)
            .then(log =>
              expect(log).to.contain('tabris.app.reload()')
            );
        });
    }).timeout(6000);

  });

  describe('when changed source file is in requested directory', function() {

    it('sends a reload command', function() {
      mkdirSync(join(path, 'bar'));
      writeFileSync(join(path, 'package.json'), '{"main": "bar/foo.js"}');
      writeFileSync(join(path, 'bar', 'foo.js'), 'console.log("test")');
      writeFileSync(join(path, 'bar', 'baz.js'), 'console.log("test")');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/bar?getfiles=${encodeURIComponent('*')}`))
        .then(response => response.text())
        .then(text => {
          spy(server.debugServer, 'send');
          writeFileSync(join(path, 'bar', 'baz.js'), `${text};`);
          return waitForCalls(server.debugServer.send, 1)
            .then(log =>
              expect(log).to.contain('tabris.app.reload()')
            );
        });
    }).timeout(6000);

  });

  describe('when changed source file is in requested project root directory', function() {

    it('sends a reload command', function() {
      writeFileSync(join(path, 'package.json'), '{"main": "foo.js"}');
      writeFileSync(join(path, 'foo.js'), 'console.log("test")');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/package.json?getfiles=${encodeURIComponent('*')}`))
        .then(response => response.text())
        .then(text => {
          spy(server.debugServer, 'send');
          writeFileSync(join(path, 'foo.js'), `${text};`);
          return waitForCalls(server.debugServer.send, 1)
            .then(log =>
              expect(log).to.contain('tabris.app.reload()')
            );
        });
    }).timeout(6000);

  });

  describe('when changed non-source file is in request directory', function() {

    it('does not send reload command', function() {
      mkdirSync(join(path, 'bar'));
      writeFileSync(join(path, 'package.json'), '{"main": "bar/foo.js"}');
      writeFileSync(join(path, 'bar', 'foo.js'), 'console.log("test")');
      writeFileSync(join(path, 'bar', 'baz'), 'console.log("test")');
      return server.serve(path)
        .then(() => fetch(`http://127.0.0.1:${server.port}/bar?getfiles=${encodeURIComponent('*')}`))
        .then(response => response.text())
        .then(text => {
          spy(server.debugServer, 'send');
          writeFileSync(join(path, 'bar', 'baz'), `${text};`);
          return new Promise(resolve => {
            setTimeout(() => {
              expect(server.debugServer.send).not.to.have.been.called;
              resolve();
            }, 1500);
          });
        });
    }).timeout(6000);

  });

});

function waitForCalls(spyInstance, minCallCount = 1) {
  let attempts = 0;
  const maxAttempts = 25;
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (spyInstance.callCount === minCallCount) {
        clearInterval(interval);
        let messages = [];
        for (const call of spyInstance.getCalls()) {
          messages.push(call.args
            .map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
            .join(''));
        }
        resolve(messages.join('\n'));
      } else if (++attempts > maxAttempts || spyInstance.callCount > minCallCount) {
        clearInterval(interval);
        reject();
      }
    }, 100);
  });
}
