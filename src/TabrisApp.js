const {copySync, statSync, readFileSync, existsSync} = require('fs-extra');
const {relative, join} = require('path');
const ignore = require('ignore');
const log = require('./helpers/log');
const proc = require('./helpers/proc');
const semver = require('semver');

class TabrisApp {

  constructor(path) {
    this._path = path;
    if (!existsSync(`${path}/package.json`)) {
      throw 'Could not find package.json';
    }
    if (!existsSync(`${path}/cordova`)) {
      throw 'Could not find cordova directory';
    }
  }

  get installedTabrisVersion() {
    return this._installedTabrisVersion;
  }

  runPackageJsonBuildScripts(platform) {
    proc.exec('npm', ['run', '--if-present', `build:${platform}`]);
    proc.exec('npm', ['run', '--if-present', 'build']);
    return this;
  }

  createCordovaProject(destination) {
    this._copyCordovaFiles(destination);
    this._copyJsFiles(destination);
    this._installProductionDependencies(destination);
    this._installedTabrisVersion = this._getTabrisVersion(destination);
    return this;
  }

  validateInstalledTabrisVersion(version) {
    let actual = this.installedTabrisVersion;
    if (!semver.valid(actual)) {
      throw Error('App uses invalid tabris version: ' + actual);
    }
    let match = semver.major(version) === semver.major(actual) &&
                semver.minor(version) === semver.minor(actual);
    if (!match) {
      let required = [semver.major(version), semver.minor(version), 'x'].join('.');
      throw new Error(`App uses incompatible tabris version: ${actual}, ${required} required.\n`);
    }
    return this;
  }

  _copyCordovaFiles(destination) {
    log.command(`Copying Cordova files to ${destination} ...`);
    copySync(`${this._path}/cordova`, destination);
  }

  _copyJsFiles(destination) {
    log.command(`Copying JavaScript files to ${destination}/www/app/ ...`);
    let tabrisignorePath = join(this._path, '.tabrisignore');
    let ig = ignore().add(['.git/', 'node_modules/', 'cordova/', relative(this._path, destination), '.tabrisignore']);
    if (existsSync(tabrisignorePath)) {
      ig.add(readFileSync(tabrisignorePath).toString());
    }
    copySync(this._path, join(destination, 'www/app'), {
      filter: (path) => {
        let stats = statSafe(path);
        let dirPath = stats && stats.isDirectory() && !path.endsWith('/') ? path + '/' : path;
        return !ig.ignores(dirPath);
      }
    });
  }

  _installProductionDependencies(destination) {
    proc.exec('npm', ['install', '--production'], {cwd: join(destination, 'www/app')});
  }

  _getTabrisVersion(cordovaProjectPath) {
    let tabrisPackageJsonPath = join(cordovaProjectPath, 'www', 'app', 'node_modules', 'tabris', 'package.json');
    let tabrisPackageJson = JSON.parse(readFileSync(tabrisPackageJsonPath, 'utf8'));
    return tabrisPackageJson.version;
  }

}

function statSafe(file) {
  try {
    return statSync(file);
  } catch (e) {
    return null;
  }
}

module.exports = TabrisApp;
