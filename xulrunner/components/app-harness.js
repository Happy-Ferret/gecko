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
        "": "resource:///modules/"
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
      "rootPath": "C:\\CI-Cor\\html-shell/gecko-shell",
      "resources": {
        "test-resource": "src",
        "test-resource2": "hsrc"
      }
    }
  */
  });
  let shellPackage = JSON.parse(packageString);
  this.packages = {
    paths:{},
    mappings:{},
    resources:{},
  };
  this.updatePackages(this.packages, shellPackage);
  this.updatePackages(this.packages, this.getUserPackage());

  this._options = this.initOptions();
};

this.AppHarness.prototype = {
  _started : false,
  _quitting: false,
  _options : null,
  _rootPath: null,
  _loader  : null,
  _resProto: null,
  _app     : null,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

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
    for (let attributeName in {paths: {},mappings: {}}) {
      let attributeValue = packageInfo[attributeName];
      for (let k in attributeValue) {
        packages[attributeName][k] = attributeValue[k];
      }
    }
  },

  getUserPackage: function() {
    return null;
  },

  get options() {
    return this._options;
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

  load: function(mainModule, argv) {
    if (this._started)
      return;

    this._started = true;
    Services.obs.addObserver(this, "quit-application-granted", true);
    let options = this.options;
    if (!mainModule) {
      console.log("Warning: Please specify the main js module or index.html in app dir!");
      this.quit("FAIL");
      return;
    }

    try {
      this._app = this.loader.main(this.loader.instance, mainModule);
      if (typeof this._app.onLoad == "function") {
        this._app.onLoad(options);
      }

      if (typeof this._app.main == "function") {
        this._app.main(argv);
      }

      // Send application readiness notification.
      const APP_READY_TOPIC = options.jetpackID + "_APPLICATION_READY";
      Services.obs.notifyObservers(null, APP_READY_TOPIC, null);
    } catch (ex) {
      defaultLogError(ex, this.options.dump);
      this.quit("FAIL");
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
  if (!path.isDirectory)
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
