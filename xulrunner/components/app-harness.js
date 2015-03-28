/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["AppHarness"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://app-bootstrap/console.js");

XPCOMUtils.defineLazyServiceGetter(this, "IOService",
  "@mozilla.org/network/io-service;1", "nsIIOService");

this.AppHarness = function AppHarness() {
  let optionString = multiline(function(){
  /*
    {
      "loader": "resource://gre/modules/commonjs/toolkit/loader.js",
      "paths": {
        "sdk/": "resource://gre/modules/commonjs/sdk/",
        "toolkit/": "resource://gre/modules/commonjs/toolkit/",
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
      "resources": {
      }
    }
  */
  });
  this._options = JSON.parse(optionString);
  this.initOptions(this._options);
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

  get options() {
    return this._options;
  },

  initOptions: function(options, uuid, logFilePath) {
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
      Console.log("Warning: Please specify the main js module or index.html in app dir!");
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
    let options = this.options;

    for (let name in options.resources) {
      let path = options.resources[name];
      let dir;
      if (typeof path == "string") {
        dir = getDir(path);
      } else if (Array.isArray(path)) {
        dir = this.rootPath.clone();
        path.forEach(part => dir.append(part));
        ensureIsDir(dir);
      } else {
        // Invalid type for path, just continue.
        continue;
      }
      let dirUri = IOService.newFileURI(dir);
      this.resourceProtocol.setSubstitution(name, dirUri);
    }

    let ns = Cu.import(options.loader, {}).Loader;
    let loader = ns.Loader({
      paths: ns.override({}, options.paths),
      globals: {
        console: Console,
        multiline: multiline
      },
      modules: {
        "toolkit/loader": ns
      },
      resolve: function(id, base) {
        id = options.mappings[id] || id;
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

    let options = this.options;
    for (let name in options.resources)
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

function ensureIsDir(dir) {
  if (!dir.exists() || !dir.isDirectory)
    throw new Error("directory not found: " + dir.path);
}

function getDir(path) {
  let dir = Cc["@mozilla.org/file/local;1"]
              .createInstance(Ci.nsILocalFile);
  dir.initWithPath(path);
  ensureIsDir(dir);
  return dir;
}

function defaultLogError(e, print) {
  if (!print)
    print = dump;

  print(e + " (" + e.fileName + ":" + e.lineNumber + ")\n");
  if (e.stack)
    print("stack:\n" + e.stack + "\n");
}
