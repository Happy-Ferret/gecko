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
 * The Original Code is Keychain Services Integration Extension for Mozilla.
 *
 * The Initial Developer of the Original Code is
 * Julian Fitzell <jfitzell@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009-13
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

"use strict";

const {Cu} = require("chrome")

Cu.import('resource://gre/modules/ctypes.jsm');

let Framework = exports.Framework = function Framework(name) {
  if (! name)
    throw Error('Framework must be initialized with a name');
    
  this._path = '/System/Library/Frameworks/' + name + '.framework/' + name;
};

Framework.prototype = {
  _library: null,
  _path: null,
  _functions: {},
  
  get library() {
    if (this._library !== null)
      return this._library;
    else if (this._path === null)
      throw Error('No _path defined for Framework');
    else
      return this._library = ctypes.open(this._path);
  },

  declare: function(name, abi) {
    var declareArgs = arguments;
    this.__defineGetter__(name,
      function() {
        if (this._functions[name] !== undefined)
          return this._functions[name];
        else
          return this._functions[name] = this.library.declare.apply(this.library, declareArgs);
      });
  },

  close: function () {
    if (this._library !== null) {
      this._library.close();
      this._library = null;
      this._functions = {};
    }
  },
};
