/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim:set ts=4 sw=4 sts=4 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Contributor(s):
 *   Mike de Boer <mdeboer@mozilla.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {Cc, Ci, Cu} = require("chrome");
const timers = require("sdk/timers");
const notifications = require("notifications");
const windows = require("sandbox-window");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
#ifdef XP_OSX
XPCOMUtils.defineLazyServiceGetter(this, "MacDock",
                                   "@mozilla.org/widget/macdocksupport;1",
                                   "nsIMacDockSupport");
#endif
/**
 * Return the current window. This function does not exist outside of the context of a window.
 */
exports.getCurrentWindow = function getCurrentWindow() {
  //@todo
};

/**
 * Return the application's main window
 */
exports.getMainWindow = function getMainWindow() {
  return windows.AllWindows[0]._window;
};

/**
 * Return a list of currently open windows.
 */
exports.getOpenWindows = function getOpenWindows() {
  return windows.browserWindows;
};

/**
 * Return the user's idle time (for the desktop, not just the application)
 */
exports.getIdleTime = function getIdleTime() {
    //@todo
};

/**
 * Return the application's main MenuItem or null if none is set.
 */
exports.getMenu = function getMenu() {
  let menuBar = this.getMainWindow().document.getElementById("theMenuBar");
  return menuBar;
};

/**
 * Set the application icon's badge text.
 */
exports.setBadge = function setBadge(text = "") {
#ifdef XP_OSX
  MacDock.badgeText = String(text);
#endif
};

/**
 * Set the application icon's badge image.
 */
exports.setBadgeImage = function setBadgeImage() {
  //@todo
};

/**
 * Set the dock icon
 */
exports.setDockIcon = function setDockIcon() {
  //@todo
};

/**
 * Set the dock menu
 */
exports.setDockMenu = function setDockMenu(menu) {
  if (!menu)
    return;
#ifdef XP_OSX
  dockMenu = menu;
#endif
};

var crtIcon;

/**
 * Set the application's icon
 */
exports.setIcon = function setIcon() {
  if (!crtIcon) {
    var desktop = Cc["@mozilla.org/desktop-environment;1"].getService(Ci.nsIDesktopEnvironment);
    crtIcon = desktop.getApplicationIcon(getMainWindow());
  }
  return crtIcon;
};

var crtTray;
/**
 * Create and add a tray icon
 */
exports.addTray = function addTray(icon, hint, menu) {
  var tray = new require("ui/tray");
  console.log(tray);
  if (!crtTray)
    crtTray = new tray.Tray();
  if (icon)
    crtTray.setIcon(icon);
  if (hint)
    crtTray.setHint(hint);
  if (menu)
    crtTray.setMenu(menu);
  return crtTray;
};

/**
 * Empty the tray of all this application's tray items
 */
exports.clearTray = function clearTray() {
  //@todo
};

/**
 * create a UI dialog
 */
exports.showDialog = function showDialog() {
  //@todo
};

exports.showNotification = function showNotification(title, text, imageURI, textClickable, onClick, onFinish, data) {
  notifications.notify({
    title: title,
    iconURL: imageURI,
    text: text,
    onClick: onClick
  });
};

exports.beep = function beep() {
  var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
  sound.beep();
},

exports.playSound = function playSound(soundURI) {
  var sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
  if (!soundURI || soundURI.indexOf("://") == -1) {
    sound.playSystemSound(soundURI);
  } else {
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    sound.play(ioService.newURI(soundURI, null, null));
  }
};

exports.getAttention = function getAttention(times) {
#ifdef XP_OSX
  MacDock.activateApplication(true);
#else
  let win = exports.getMainWindow();
  if (typeof times == "number")
    win.getAttentionWithCycleCount(times);
  else
    win.getAttention();
#endif
};

exports.getUUID = function() {
  let uuidGenerator = Cc["@mozilla.org/uuid-generator;1"]
                        .getService(Ci.nsIUUIDGenerator);
  return uuidGenerator.generateUUID().toString();
};
