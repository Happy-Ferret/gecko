#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Path = require("path");
var Fs = require("fs");
var Async = require("async");
var Mkdirp = require("mkdirp");
var child_process = require('child_process');

var Util = require("../lib/util");
var Mozfetcher = require("../lib/mozfetcher");
var Build = require("../lib/build");
var DepsCheck = require("../lib/depscheck");

var commander = require('commander');

var Manifest = JSON.parse(Fs.readFileSync(Path.join(__dirname, '..', "package.json"), "utf8"));

commander
  .version(Manifest.version)
  .description('Build, run or package an application using the latest Mozilla technologies.')
  .option('-b, --no-build', "Build an app for the current OS. Simplest option, as this " +
                 "will not run or create a distributable package.")
  .option('-r, --run', "Build & run an app for the current OS. This option will not " +
                 "create a distributable package.")
  .option('-p, --package', 'Build & package an app for the current OS.')
  .option('--os <os>', "Operating System to build an app for. Possible options are: " +
                  "'windows', 'linux' and 'osx'", Util.sanitizeOS, Util.sanitizeOS())
  .option('-c, check', 'Check Build & Package dependencies')
  .option('-v, --verbose', 'Show verbose logging information.')
  .on('--help', function() {
    console.log('  Gecko Shell v' + commander._version +'\n');
  })

var argv = commander.parse(process.argv);

//argv.options = undefined;
//argv.rawArgs = undefined;
//argv.args = undefined;
//console.log(argv)

// Thoroughly sanitize the CLI arguments:
Util.sanitizeArguments(argv);

// Exit handler
function onExit(ex) {
  if (argv.verbose)
    Util.log("Exiting...");
  if (ex) {
    console.trace();
    throw ex;
  }
}
process.on("exit", onExit);
process.on("UncaughtException", onExit);


function exitWithError(err, code) {
  if (err)
    Util.log(err, "error");
  process.exit(code || 1);
}

// set the "build directory", where we'll output built artifacts, download
// xulrunner, etc.
var buildDir = Path.join(process.cwd(), "build");
// Ensure that the 'build' directory is present.
Mkdirp(buildDir, function(err) {
  if (err)
    exitWithError(err);

  if (argv.check) {
    DepsCheck.check(argv.os.map(function(os) {
      return os.platform;
    }), function(err, results) {
      if (err)
        exitWithError(err);

      DepsCheck.report(results);
      process.exit();
    });
  } else {
    var runOS = null;

    // Then we'll check if the necessary xulrunner is present for all OSes to build:
    Async.eachSeries(argv.os,
      function(os, nextOS) {
        os.manifest = Manifest;

        os.buildRoot = Path.normalize(buildDir || Path.join(__dirname, '..'));
        var fetcher = new Mozfetcher(os);
        // Tack path to the xulrunner executable on `os`, to reuse later in run()!
        os.xulrunnerPath = fetcher.getXulrunnerPath();
        os.platform = Util.getPlatform(os.platform);
        os.arch = os.arch || process.arch;
        os.unpackDir = fetcher.getUnpackDir();
        os.buildDir = os.unpackDir + '.build'

        fetcher.fetchIfNeeded(function() {
          Build.appify(os, argv.verbose, nextOS);
          if (os.platform == Util.getPlatform()) {
            runOS = os;
          }
        });
      },
      function(err) {
        if (err)
          exitWithError(err);
        console.log("Building finished");
        run(runOS);
      }
    );
  }
});

function run(runOS) {
  var finalBinaryPath = runOS.finalBinaryPath;
  var args = [].concat(['-purgecaches'], argv.args);

  var running = [].concat([runOS.finalBinaryPath], args, ['in', process.cwd()]);
  console.log("Start running:" +  running.join(" "));

  var child = child_process.spawn(finalBinaryPath, args, {
    detached: true,
    env: process.env,
    cwd: process.cwd(),
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', function(data) {
    process.stdout.write(data);
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', function(data) {
    process.stderr.write(data);
  });

  child.on('error', function(err) {
    console.log(err);
  });
}
