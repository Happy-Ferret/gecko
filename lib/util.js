/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Path = require("path");
var Fs = require("fs");
var Util = require("util");
var Spawn = require("child_process").spawn;
var Async = require("async");

exports.sanitizeOS = function(os) {
  if (!os) {
    os = exports.getPlatform();
  }
  os = os.split("|");
  return [{
    platform: exports.getPlatform(os[0]),
    arch: os[1] ? os[1].trim() : process.arch
  }]
}

exports.sanitizeApps = function(apps) {
  if (!apps) {
    return [Path.join(process.cwd(), "examples", "api-demo", "index.html")];
  } else {
    return apps.split(':').map(exports.findAppHTML);
  }
}

exports.sanitizeArguments = function(argv) {
  if (argv.check) {
    argv.build = argv.package = argv.run = false;
  } else if (argv.package) {
    argv.package = true;
    argv.run = false;
  } else if (argv.run) {
    argv.package = false;
    argv.run = true;
  }
};

exports.findAppHTML = function(path) {
  // "examples" directory can be omitted, but we'll automatically append it to
  // verify that file exists.
  if (Fs.statSync(path).isDirectory()) {
    if (Fs.existsSync(Path.join(path, "index.html")))
      path = Path.join(path, "index.html");
    else if (Fs.existsSync(Path.join(path, "index.xhtml")))
      path = Path.join(path, "index.xhtml");
    else if (Fs.existsSync(Path.join(path, "index.svg")))
      path = Path.join(path, "index.svg")
  }
  // the path we return must have ui omitted
  return Path.normalize(path);
};

// We like 'osx' better than 'darwin', for example.
exports.OSMap = {
  "darwin": "osx",
  "win32": "win",
  "windows": "win"
};

exports.getPlatform = function(platform) {
  platform = (platform || process.platform).trim();
  return exports.OSMap[platform] || platform;
};

exports.OSCaptions = {
  "linux": "Linux",
  "osx": "Mac OSX",
  "win": "Windows"
};

exports.getPlatformCaption = function(platform) {
  return exports.OSCaptions[platform] +
         (platform == exports.getPlatform() ? " (current)" : "");
};

exports.escapeRegExp = function(str) {
  return str.replace(/([.*+?^${}()|[\]\/\\])/g, "\\$1");
};

var levels = {
    "info":  ["\033[90m", "\033[39m"], // grey
    "error": ["\033[31m", "\033[39m"], // red
    "fatal": ["\033[35m", "\033[39m"], // magenta
    "exit":  ["\033[36m", "\033[39m"]  // cyan
};

var _slice = Array.prototype.slice;

exports.log = function() {
  var args = _slice.call(arguments);
  var lastArg = args[args.length - 1];

  var level = levels[lastArg] ? args.pop() : "info";
  if (!args.length)
    return;

  var msg = args.map(function(arg) {
    return typeof arg != "string" ? Util.inspect(arg) : arg;
  }).join(" ");
  var pfx = levels[level][0] + "[" + level + "]" + levels[level][1];

  msg.split("\n").forEach(function(line) {
    console[level == "info" ? "log" : "error"](pfx + " " + line);
  });
};

exports.spawnSeries = function(series, callback) {
  Async.eachSeries(series, function(commandSet, nextCommand) {
    var child = Spawn.apply(null, commandSet);
    var out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", function(data) {
      out += data;
    });
    var err = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", function(data) {
      err += data;
    });
    child.on("exit", function(code) {
      if (code > 0)
        return nextCommand(err || out);
      return nextCommand();
    });
  }, callback);
};
