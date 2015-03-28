/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");

this.EXPORTED_SYMBOLS = ["initWinNt"];

let user32 = ctypes.open("user32.dll");
let msvcrt = ctypes.open("msvcrt.dll");
/*

void RedirectIOToConsole(FILE *file, DWORD console, const char* openMode) {
  int hConHandle;
  long lStdHandle;
  FILE *fp;

  lStdHandle = (long)GetStdHandle(console);
  if (lStdHandle == 0) {
    return;
  }
  hConHandle = _open_osfhandle(lStdHandle, _O_TEXT);
  fp = _fdopen(hConHandle, openMode);
  *file = *fp;
  setvbuf( file, NULL, _IONBF, 0 );
}

void RedirectAtomConsole() {
  // Make output work in console if we are not in cygwin.
  wchar_t os[128];
  const wchar_t cygwin[] = L"cygwin";


  GetEnvironmentVariableW(L"OS", os, sizeof(os));
  if (wcsnicmp(os, cygwin, sizeof(cygwin)) == 0) {
    return;
  }

  AttachConsole(ATTACH_PARENT_PROCESS);

  // redirect unbuffered STDOUT to the console
  RedirectIOToConsole(stdout, STD_OUTPUT_HANDLE, "w");
  // redirect unbuffered STDIN to the console
  RedirectIOToConsole(stdin, STD_INPUT_HANDLE, "r");
  // redirect unbuffered STDERR to the console
  RedirectIOToConsole(stderr, STD_ERROR_HANDLE, "w");

  // make cout, wcout, cin, wcin, wcerr, cerr, wclog and clog
  // point to console as well
  std::ios_base::sync_with_stdio();
}
*/

function initWinNt() {
  dump("Init winnt\n")
  //dump(msvcrt)
}
