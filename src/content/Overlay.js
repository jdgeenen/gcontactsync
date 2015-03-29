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
 * The Original Code is gContactSync.
 *
 * The Initial Developer of the Original Code is
 * Josh Geenen <gcontactsync@pirules.org>.
 * Portions created by the Initial Developer are Copyright (C) 2008-2015
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

if (!com) {var com = {};} // A generic wrapper variable
// A wrapper for all GCS functions and variables
if (!com.gContactSync) {com.gContactSync = {};}

window.addEventListener("load",
  /** Initializes the FileIO class when the window has finished loading */
  function gCS_overlayLoadListener() {
    window.removeEventListener("load", gCS_overlayLoadListener, false);
    com.gContactSync.Overlay.initialize();
  },
false);

/**
 * Checks if the authentication token is present and valid.  If so, it starts
 * everything up and synchronizes the contacts.  Otherwise it shows the
 * login window.
 * @class
 */
com.gContactSync.Overlay = {
  /** The last version of gContactSync */
  mLastVersionMajor:   0,
  mLastVersionMinor:   0,
  mLastVersionRelease: 0,
  mLastVersionSuffix:  "",
  /**
   * Called when the overlay is loaded and initializes everything and begins
   * the authentication check and sync or login prompt.
   */
  initialize: function Overlay_initialize() {
    // Find the last version of gContactSync and set the pref to the current
    this.mLastVersionMajor   = com.gContactSync.Preferences.mSyncPrefs.lastVersionMajor.value;
    this.mLastVersionMinor   = com.gContactSync.Preferences.mSyncPrefs.lastVersionMinor.value;
    this.mLastVersionRelease = com.gContactSync.Preferences.mSyncPrefs.lastVersionRelease.value;
    this.mLastVersionSuffix  = com.gContactSync.Preferences.mSyncPrefs.lastVersionSuffix.value;
    com.gContactSync.AbListener.add(); // add the address book listener

    // call the unload function when the address book window is shut
    window.addEventListener("unload", function unloadListener(e) {
      window.removeEventListener("unload", unloadListener, false);
      com.gContactSync.Overlay.unload();
    }, false);
  },
  /**
   * Called when the overlay is unloaded and removes the address book listener.
   */
  unload: function Overlay_unload() {
    com.gContactSync.AbListener.remove();
  },
  /**
   * Sets the text of the status bar to the given value.
   * @param aText {string} The text to put on the status bar.
   */
  setStatusBarText: function Overlay_setStatusBarText(aText) {
    com.gContactSync.Preferences.setSyncPref("statusBarText", aText);
  },
  /**
   * Gets the text of the status bar.
   * @returns {string} The text of the status bar
   */
  getStatusBarText: function Overlay_getStatusBarText() {
    return com.gContactSync.Preferences.mSyncPrefs.statusBarText.value;
  },
  /**
   * Writes the current time to the status bar along with the sync finished
   * string.
   * When the status text is clicked the log file is opened.
   */
  writeTimeToStatusBar: function Overlay_writeTimeToStatusBar() {
    var hours   = String(new Date().getHours()),
        minutes = String(new Date().getMinutes()),
        seconds = String(new Date().getSeconds()),
        text    = com.gContactSync.StringBundle.getStr("syncFinishedString");
    // Add any missing 0's to the times
    hours       = hours.length   === 0 ? "00" + hours   : hours;
    hours       = hours.length   === 1 ?  "0" + hours   : hours;
    minutes     = minutes.length === 1 ?  "0" + minutes : minutes;
    seconds     = seconds.length === 1 ?  "0" + seconds : seconds;
    this.setStatusBarText(text + " " + hours + ":" + minutes + ":" + seconds);
  },
  /**
   * Prompts the user to enter his or her Google username and password and then
   * gets an authentication token to store and use.
   * @param aSyncOnUnload {bool} If true will perform a sync when the wizard is closed.
   */
  openAccountWizard: function Overlay_openAccountWizard(aSyncOnUnload) {
    var wizard = window.open("chrome://gcontactsync/content/AccountSetupWizard.xul",
                             "SetupWindow",
                             "chrome,resizable=yes,scrollbars=no,status=no");
    if (aSyncOnUnload === true) {
      // when the setup window loads, set its onunload property to begin a sync
      wizard.onload = function onloadListener() {
        wizard.onunload = function onunloadListener() {
          if (com.gContactSync.gdata.isAuthValid()) {
            com.gContactSync.Sync.begin(true, null);
          }
        };
      };
    }
  },
  /**
   * Updates the current version in the gContactSync preferences.
   */
  updateVersion: function MessengerOverlay_updateVersion() {
    com.gContactSync.Preferences.setSyncPref("lastVersionMajor",
                                             com.gContactSync.versionMajor);
    com.gContactSync.Preferences.setSyncPref("lastVersionMinor",
                                             com.gContactSync.versionMinor);
    com.gContactSync.Preferences.setSyncPref("lastVersionRelease",
                                             com.gContactSync.versionRelease);
    com.gContactSync.Preferences.setSyncPref("lastVersionSuffix",
                                             com.gContactSync.versionSuffix);
  }
};
