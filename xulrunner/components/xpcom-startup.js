/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

//https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Miscellaneous
if (Services.appinfo.OS == 'WINNT') {
  Cu.import("resource://app-bootstrap/winnt.js");
  initWinNt();
}

this.XpcomStartup = function() {
  this.wrappedJSObject = this;
  //dump("XpcomStartup\n");
};

this.XpcomStartup.prototype = {
  classID: Components.ID("{2be81629-4ac1-4725-bc78-c4a396de103d}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    switch (topic) {
      case "xpcom-startup":
        //dump("xpcom-startup\n");
        break;
    }
  },
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([this.XpcomStartup]);
