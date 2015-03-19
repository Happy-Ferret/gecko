/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Path = require("path");
var Fs = require("fs");
var Mkdirp = require("mkdirp");

var AppTemplate = require("./build/template");
var Modules = require("./build/modules");
var Util = require("./util");

// Generate a complete standalone appos.buildDirlication (inside of a folder). The output
// will be placed in build/ directory and the path to the application will be
// returned.
exports.appify = function(os, devMode, callback) {
  var self = this;
  // generate the application shell, returning the parameters of its creation
  // (like, the directory it was output into, and where inside that bundle the
  // xulrunner application files should be put)
  Mkdirp(os.buildDir, function(err) {
    if (err)
      return callback(err);
    require("./build/" + os.platform).outputAppShell(os, os.unpackDir, os.buildDir, devMode, function(err, params) {
      if (err)
        return callback(err);
      AppTemplate.create(os.buildDir, devMode, callback);
    });
  });
};
