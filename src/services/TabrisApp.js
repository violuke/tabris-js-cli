const {copySync, statSync, readFileSync, readJsonSync, existsSync} = require('fs-extra');
const {relative, join} = require('path');
const ignore = require('ignore');
const semver = require('semver');
const log = require('../helpers/log');
const proc = require('../helpers/proc');

const DEFAULT_IGNORES = [
  '.git/',
  '.tabrisignore',
  'node_modules/',
  'build/',
  'cordova/'
];

class TabrisApp {

  constructor(path) {
    this._path = path;
    if (!existsSync(join(path, 'package.json'))) {
      throw 'Could not find package.json';
    }
    if (!readJsonSync(join(path, 'package.json')).main) {
      throw 'package.json must contain a "main" field';
    }
    if (!existsSync(join(path, 'cordova'))) {
      throw 'Could not find cordova directory';
    }
  }

  get installedTabrisVersion() {
    return this._installedTabrisVersion;
  }

  runPackageJsonBuildScripts(platform) {
    proc.execSync('npm', ['run', '--if-present', `build:${platform}`]);
    proc.execSync('npm', ['run', '--if-present', 'build']);
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
    let match = semver.major(version) === semver.major(actual);
    if (!match) {
      let required = [semver.major(version), 'x', 'x'].join('.');
      throw new Error(`App uses incompatible tabris version: ${actual}, ${required} required.\n`);
    }
    return this;
  }

  _copyCordovaFiles(destination) {
    log.command(`Copying Cordova files to ${destination} ...`);
    let excludedPaths = ['www', 'platform', 'plugins']
      .map(subdir => join(this._path, 'cordova', subdir));
    copySync(join(this._path, 'cordova'), destination, {
      filter: path => !excludedPaths.includes(path)
    });
  }

  _copyJsFiles(destination) {
    let appDir = join(destination, 'www', 'app');
    log.command(`Copying JavaScript files to ${appDir} ...`);
    let tabrisignorePath = join(this._path, '.tabrisignore');
    let ig = ignore().add([relative(this._path, destination), ...DEFAULT_IGNORES]);
    if (existsSync(tabrisignorePath)) {
      ig.add(readFileSync(tabrisignorePath).toString());
    }
    copySync(this._path, appDir, {
      filter: (path) => {
        let stats = statSafe(path);
        let dirPath = stats && stats.isDirectory() && !path.endsWith('/') ? path + '/' : path;
        return !ig.ignores(dirPath);
      }
    });
  }

  _installProductionDependencies(destination) {
    proc.execSync('npm', ['install', '--production'], {cwd: join(destination, 'www', 'app')});
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