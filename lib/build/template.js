/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Path = require("path");
var Fs = require("fs");
var Async = require("async");
var Ncp = require("ncp").ncp;
var Uuid = require("uuid");

var Template = require("./../template");
var Util = require("./../util");

function getTemplateDir() {
  return Path.join(__dirname, '..', '..', 'xulrunner');
}

exports.create = function(outputDir, devMode, callback) {
  // Copy all the template files which require no substitution.
  var appTemplate = getTemplateDir();
  if (devMode)
    Util.log("  ... copying application template");

  Fs.readdir(appTemplate, function(err, files) {
    if (err)
      return callback(err);

    Async.eachSeries(files,
      function(file, next) {
        var src = Path.join(appTemplate, file);
        var dst = Path.join(outputDir, file);
        Ncp(src, dst, next);
      }, function(err) {
        if (err)
          return callback(err);
        callback();
      });
  });
}
