/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["AppHarness"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://app-bootstrap/console.js");

// To read & write content to file
const {OS} = Cu.import("resource://gre/modules/osfile.jsm", {});

XPCOMUtils.defineLazyServiceGetter(this, "IOService",
  "@mozilla.org/network/io-service;1", "nsIIOService");

this.AppHarness = function AppHarness() {
  let packageString = multiline(function(){
  /*
    {
      "paths": {
        "sdk/": "resource://gre/modules/commonjs/sdk/",
        "toolkit/": "resource://gre/modules/commonjs/toolkit/",
        "gre/": "resource://gre/modules/",
        "modules": "resource:///modules/",
        "": "resource://"
      },
      "mappings": {
        "path": "sdk/fs/path",
        "fs": "sdk/io/fs",
        "net": "sdk/io/net",
        "timers": "sdk/timers",
        "stream": "sdk/io/stream",
        "child_process": "sdk/system/child_process",
        "subprocess/index": "sdk/subprocess/index"
      },
      "resources": {
        "test-gecko-shell-resource": "test"
      }
    }
  */
  });
  /* No / in resources name */
  let shellPackage = JSON.parse(packageString);
  this.packages = {
    paths:{},
    mappings:{},
    resources:{},
  };
  this.updatePackages(this.packages, shellPackage);
};

this.AppHarness.prototype = {
  _started : false,
  _quitting: false,
  options : null,
  _rootPath: null,
  _loader  : null,
  _resProto: null,
  _app     : null,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  readAsText: function(filePath, encoding="UTF-8", limit=(1<<20)) {
    // |file| is nsIFile
    var file = getPath(filePath);
    if (!file.exists || file.isDirectory()) {
      return null;
    }

    var data = "";
    var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
                  createInstance(Components.interfaces.nsIFileInputStream);
    var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
                  createInstance(Components.interfaces.nsIConverterInputStream);
    fstream.init(file, -1, 0, 0);
    cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish

    let (str = {}) {
      let read = 0;
      do {
        read = cstream.readString(0x100000, str); // read as much as we can and put it in str.value
        data += str.value;
        if (limit > 0 && data.length > limit) {
          break;
        }
      } while (read != 0);
    }
    cstream.close(); // this closes fstream
    return data;
  },
  get currentWorkingDirectory() {
    //https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIDirectoryService
    //https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIProperties
    return Components.classes["@mozilla.org/file/directory_service;1"]
                 .getService(Components.interfaces.nsIProperties)
                 .get("CurWorkD", Components.interfaces.nsIFile).path;
  },

  updatePackages: function(packages, packageInfo) {
    if (!packageInfo) {
      return;
    }

    var rootPath =packageInfo.rootPath || this.rootPath.path;
    var resources = packageInfo['resources'];
    for (let k in resources) {
      let path = OS.Path.normalize(OS.Path.join(rootPath, resources[k]));
      if (!getPath(path).exists()) {
        console.warn("directory not found: " + path);
      } else {
        packages['resources'][k] = path;
      }
    }
    for (let attributeName in {paths:{}, mappings:{}}) {
      let attributeValue = packageInfo[attributeName];
      for (let k in attributeValue) {
        packages[attributeName][k] = attributeValue[k];
      }
    }
  },

  getAppPath: function(argv) {
    var appPath = null;
    while (argv.length > 0) {
      let path = OS.Path.normalize(OS.Path.join(this.currentWorkingDirectory, argv.shift()));
      let nsPath = getPath(path);
      if (nsPath.exists() && !nsPath.isDirectory()) {
        appPath = path;
        break;
      }
    }
    return appPath;
  },

  getAppConfig: function(appPath) {
    let path = getPath(appPath);
    let leafName = path.leafName;
    path = path.parent;
    let resourcePath = path.path;
    let packageInfo = {
    };
    let rootPath = null;
    while (path) {
      let p = path.clone();
      p.append('package.json');
      if (p.exists() && !p.isDirectory()) {
        try {
          let text = this.readAsText(p.path);
          let packageJson = JSON.parse(text);
          if (typeof packageJson['gecko-modules'] === 'object') {
            packageInfo = packageJson['gecko-modules'];
            rootPath = path.path;
          }
        } catch (err) {
        }
      }
      path = path.parent;
    }
    for (let attributeName in {paths:{}, mappings:{}, resouces:{},} ) {
      if (typeof packageInfo[attributeName] !== 'object') {
        packageInfo[attributeName] = {};
      }
    }
    packageInfo.resources['gecko-shell-app-path'] = resourcePath;
    packageInfo.rootPath = rootPath;
    return {
      modulePath: "resource://gecko-shell-app-path/" + leafName,
      packageInfo: packageInfo,
    }
  },

  initOptions: function(uuid, logFilePath) {
    let options = {};
    options.jetpackID = uuid;
    options.bundleID = uuid;
    let logFile, logStream;
    if (logFilePath) {
      logFile = Cc["@mozilla.org/file/local;1"]
                  .createInstance(Ci.nsILocalFile);
      logFile.initWithPath(logFilePath);

      logStream = Cc["@mozilla.org/network/file-output-stream;1"]
                    .createInstance(Ci.nsIFileOutputStream);
      logStream.init(logFile, -1, -1, 0);
    }

    function print(msg) {
      dump(msg);
      if (logStream && typeof msg == "string") {
        logStream.write(msg, msg.length);
        logStream.flush();
      }
    }

    function logError(e) {
      defaultLogError(e, print);
    }

    options.rootPath = this.rootPath;
    options.dump = print;
    options.logError = logError;
    return options;
  },

  get loader() {
    if (!this._loader)
      this._loader = this.buildLoader();
    return this._loader;
  },

  get resourceProtocol() {
    if (!this._resProto) {
      this._resProto = IOService.getProtocolHandler("resource")
                                .QueryInterface(Ci.nsIResProtocolHandler);
    }
    return this._resProto;
  },

  get rootPath() {
    if (!this._rootPath) {
      let defaultsDir = Cc["@mozilla.org/file/directory_service;1"]
                        .getService(Ci.nsIProperties)
                        .get("DefRt", Ci.nsIFile);
      this._rootPath = defaultsDir.parent;
    }
    return this._rootPath;
  },

  observe: function(subject, topic, data) {
    switch (topic) {
      case "quit-application-granted":
        this.unload("shutdown");
        this.quit();
        break;
    }
  },

  load: function(argv) {
    if (this._started)
      return;

    this._started = true;

    this.options = this.initOptions();
    this.appPath = this.getAppPath(argv);

    if (!this.appPath) {
      console.warn("Please specify the main js in app dir!");
      return;
    }

    this.appConfig = this.getAppConfig(this.appPath);
    this.updatePackages(this.packages, this.appConfig.packageInfo);


    Services.obs.addObserver(this, "quit-application-granted", true);

    try {
      // Send application prepare notification.
      Services.obs.notifyObservers(null, 'gecko-shell-prepare', null);
      Services.obs.notifyObservers(null, 'gecko-shell-prepare-' + this.options.jetpackID, null);

      this._app = this.loader.main(this.loader.instance, this.appConfig.modulePath);

      if (typeof this._app.main == "function") {
        this._app.main(argv);
      }

      // Send application readiness notification.
      Services.obs.notifyObservers(null, 'gecko-shell-ready', null);
      Services.obs.notifyObservers(null, 'gecko-shell-ready-' + this.options.jetpackID, null);
    } catch (ex) {
      defaultLogError(ex, this.options.dump);
      this.quit("FAIL");
      return;
    }
  },

  onCommand: function(argv) {
    if (typeof this._app.onCommand == "function") {
      this._app.onCommand(argv);
    }
  },

  buildLoader: function() {
    let packages = this.packages;

    for (let name in packages.resources) {
      let path = packages.resources[name];
      let dir = getDir(path);
      let dirUri = IOService.newFileURI(dir);
      this.resourceProtocol.setSubstitution(name, dirUri);
    }

    let ns = Cu.import('resource://gre/modules/commonjs/toolkit/loader.js', {}).Loader;
    let loader = ns.Loader({
      paths: ns.override({}, packages.paths),
      globals: {
        console: console,
        multiline: multiline
      },
      modules: {
        "toolkit/loader": ns
      },
      resolve: function(id, base) {
        id = packages.mappings[id] || id;
        return ns.resolve(id, base);
      }
    });

    return {
      unload: ns.unload,
      main: ns.main,
      instance: loader
    };
  },

  unload: function(reason) {
    if (!this._started)
      return;

    this._started = false;

    Services.obs.removeObserver(this, "quit-application-granted");

    // Notify the app of unload.
    if (this._app) {
      if (typeof this._app.onUnload == "function") {
        try {
          this._app.onUnload(reason);
        } catch (ex) {
          defaultLogError(ex, this.options.dump);
        }
      }
      this._app = null;
    }

    // Notify the loader of unload.
    if (this._loader) {
      this._loader.unload(this._loader.instance, reason);
      this._loader = null;
    }

    for (let name in this.packages.resources)
      this.resourceProtocol.setSubstitution(name, null);
  },

  quit: function(status = "OK") {
    if (status != "OK" && status != "FAIL") {
      dump("Warning: quit() expected 'OK' or 'FAIL' as an " +
           "argument, but got '" + status + "' instead.");
      status = "FAIL";
    }

    if (this._quitting)
      return;

    this._quitting = true;

    this.unload("internal-quit");
  }
};

function ensureExist(path) {
  if (!path.exists()) {
    throw new Error("directory not found: " + path.path);
  }
}

function ensureIsDir(path) {
  if (!path.isDirectory())
    throw new Error("directory not found: " + path.path);
}

function getDir(path) {
  let dir = getPath(path);
  ensureExist(dir)
  ensureIsDir(dir);
  return dir;
}

function getPath(path) {
  let f = Cc["@mozilla.org/file/local;1"]
              .createInstance(Ci.nsILocalFile);
  f.initWithPath(path);
  return f;
}

function defaultLogError(e, print) {
  if (!print)
    print = dump;

  print(e + " (" + e.fileName + ":" + e.lineNumber + ")\n");
  if (e.stack)
    print("stack:\n" + e.stack + "\n");
}
