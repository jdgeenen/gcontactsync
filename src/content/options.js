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
 * Portions created by the Initial Developer are Copyright (C) 2008-2016
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

/** Containing object for gContactSync */
var gContactSync = gContactSync || {};

window.addEventListener("load",
  /** Initializes the Options class when the window has finished loading */
  function gCS_OptionsLoadListener() {
    window.removeEventListener("load", gCS_OptionsLoadListener, false);
    gContactSync.Options.init();
    window.sizeToContent();
  },
false);

/**
 * Provides helper functions for the Preferences dialog.
 */
gContactSync.Options = {
  /**
   * Initializes the string bundle, FileIO and Preferences scripts and fills the
   * login tree.
   */
  init: function Options_init() {
    if (navigator.userAgent.indexOf("SeaMonkey") !== -1) {
      document.getElementById("chkEnableSyncBtn").collapsed = false;
      document.getElementById("chkForceBtnImage").collapsed = false;
    }
    // if this is the full preferences dialog add a few event listeners
    if (document.getElementById("enableLogging")) {
      document.getElementById("autoSync")
              .addEventListener("change", gContactSync.Options.enableDelays, false);
      gContactSync.Options.enableDelays();
      document.getElementById("enableLogging")
              .addEventListener("change", gContactSync.Options.enableVerboseLog, false);
      gContactSync.Options.enableVerboseLog();
    }
  },
  /**
   * Enables or disables the enable verbose logging checkbox based on the state of
   * the enableLogging checkbox.
   */
  enableVerboseLog: function Options_enableVerboseLog() {
    var enableLogging = document.getElementById("enableLogging");
    if (!enableLogging) return false;
    var disable = !enableLogging.value;
    document.getElementById("verboseLog").disabled = disable;
    return true;
  },
  /**
   * Enables or disables the delay textboxes based on the auto sync checkbox.
   */
  enableDelays: function Options_enableDelays() {
    var disableElem  = document.getElementById("autoSync");
    var intervalElem = document.getElementById("refreshIntervalBox");
    var initialElem  = document.getElementById("initialDelayMinutesBox");
    if (!disableElem) return false;
    if (intervalElem && intervalElem.previousSibling)
      intervalElem.disabled = intervalElem.previousSibling.disabled = !disableElem.value;
    if (initialElem && initialElem.previousSibling)
      initialElem.disabled  = initialElem.previousSibling.disabled  = !disableElem.value;
    return true;
  },
  /**
   * Resets all gContactSync settings.  AB prefs, add-on prefs, cleans up old photos, and removes all auth tokens.
   */
  resetAllSettings: function Options_resetAllSettings() {

    if (!gContactSync.confirm(gContactSync.StringBundle.getStr("resetAllSettings"))) {
      return;
    }

    // Force a restart
    gContactSync.Preferences.setSyncPref("needRestart", true);

    // Remove all AB prefs
    this.removeABPrefs(false, false);

    // Remove all auth tokens
    var tokens = gContactSync.LoginManager.getAuthTokens();
    for (var username in tokens) {
      gContactSync.LOGGER.LOG("* Removing token for " + username);
      gContactSync.LoginManager.removeAuthToken(username);
    }

    // Cleanup old photos
    this.deleteOldPhotos(false);

    // Reset sync prefs
    gContactSync.Preferences.defaultAllSyncPrefs();

    // Ask the user to restart
    var restartStr = gContactSync.StringBundle.getStr("pleaseRestart");
    gContactSync.Preferences.setSyncPref("statusBarText", restartStr);
    gContactSync.alert(restartStr);
  },
  /**
   * Deletes gContactSync preferences for address books.
   * @param alertWhenFinished {bool} Whether this function should alert the user when finished.
   * @param removeFromDeletedABsOnly {bool} Whether to only remove preferences for deleted ABs.
   */
  removeABPrefs: function Options_removeABPrefs(alertWhenFinished, removeFromDeletedABsOnly) {

    var abBranch    = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService)
                                .getBranch("ldap_2.servers."),
        gAbBranch   = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService)
                                .getBranch("extensions.gContactSync.ldap_2.servers."),
        abs         = gContactSync.GAbManager.getAllAddressBooks(),
        children    = [],
        count       = {},
        abPrefIDs   = {},
        i           = 0,
        numObsolete = 0,
        numDeleted  = 0,
        prefNames   = /(lastSync|gContactSync(Username|lastSync|readOnly|writeOnly|myContacts|myContactsName|Plugin|Disabled|syncGroups|updateGoogleInConflicts|lastBackup|reset|Primary))/,
        // Step 1: Backup prefs.js
        prefsFile   = gContactSync.FileIO.getProfileDirectory(),
        backupFile  = gContactSync.FileIO.getProfileDirectory();

    gContactSync.LOGGER.LOG("***Removing gContactSync address book preferences***");
    prefsFile.append(gContactSync.FileIO.fileNames.PREFS_JS);
    backupFile.append(gContactSync.FileIO.fileNames.FOLDER_NAME);
    backupFile.append(gContactSync.FileIO.fileNames.PREFS_BACKUP_DIR);
    backupFile.append(new Date().getTime() + "_" +
                      gContactSync.FileIO.fileNames.PREFS_JS + ".bak");
    gContactSync.LOGGER.LOG(" * Backing up prefs.js");
    gContactSync.LOGGER.LOG("   - Destination: " + backupFile.path);
    gContactSync.FileIO.copyFile(prefsFile, backupFile);
    // Step 2: Clean all gContactSync prefs on ldap_2.servers
    //         if and only if the extensions.gContactSync.ldap_2.servers. branch
    //         exists (means that old prefs were already updated)
    gContactSync.LOGGER.LOG(" * Finding existing AB preference IDs");
    for (i in abs) {
      var id = abs[i].mDirectory.dirPrefId;
      gContactSync.LOGGER.VERBOSE_LOG("  - " + id);
      abPrefIDs[id] = abs[i];
    }
    gContactSync.LOGGER.LOG(" * Searching for obsolete prefs on ldap_2.servers.");
    children = abBranch.getChildList("", count);
    for (i = 0; i < count.value; i++) {
      // extract the preference ID from the whole preference
      // (ie MyAB_1.filename -> MyAB_1)
      var index  = children[i].indexOf("."),
          prefID = index > 0 ? children[i].substring(0, index) : children[i];
      gContactSync.LOGGER.VERBOSE_LOG("   - " + children[i] + " - " + prefID);
      if (!removeFromDeletedABsOnly || !abPrefIDs["ldap_2.servers." + prefID]) {
        if (prefNames.test(children[i])) {
          abBranch.clearUserPref(children[i]);
          gContactSync.LOGGER.LOG("  - Deleted old gContactSync pref");
          numObsolete++;
        }
      }
    }
    gContactSync.LOGGER.LOG(" * Found " + numObsolete + " prefs on ldap_2.servers.*");
    // Step 3: clean prefs for deleted ABs on extensions.gContactSync.ldap_2.servers.
    gContactSync.LOGGER.LOG(" * Searching for gContactSync prefs for deleted ABs");
    children = gAbBranch.getChildList("", count);
    for (i = 0; i < count.value; i++) {
      // extract the preference ID from the whole preference
      // (ie MyAB_1.filename -> MyAB_1)
      var index  = children[i].indexOf("."),
          prefID = index > 0 ? children[i].substring(0, index) : children[i];
      gContactSync.LOGGER.VERBOSE_LOG(" - " + children[i] + " - " + prefID);
      if (!removeFromDeletedABsOnly || !abPrefIDs["ldap_2.servers." + prefID]) {
        if (prefNames.test(children[i])) {
          gAbBranch.clearUserPref(children[i]);
          numDeleted++;
        }
      }
    }
    gContactSync.LOGGER.LOG(" * Found " + numDeleted + " gContactSync prefs for deleted ABs");
    if (alertWhenFinished) {gContactSync.alert(gContactSync.StringBundle.getStr("finishedPrefClean").replace("%d", numDeleted + numObsolete));}
  },
  /**
   * Deletes unused contact photos from Thunderbird and gContactSync's photos
   * directories.  When address books and contacts are deleted TB doesn't delete
   * the corresponding photo which can leave quite a few photos behind.
   * @param alertWhenFinished {bool} Whether this function should alert the user when finished.
   */
  deleteOldPhotos: function Options_deleteOldPhotos(alertWhenFinished) {
    var abs = gContactSync.GAbManager.getAllAddressBooks();
    var photoURIs = {};
    var photoNames = {};

    gContactSync.LOGGER.LOG("***Removing old contact photos***");
    
    // Get the URI for the gContactSync photos directory
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
                         .getService(Components.interfaces.nsIProperties)
                         .get("ProfD", Components.interfaces.nsIFile);
    file.append("gcontactsync");
    file.append("photos");
    var gcsPhotosDir = Components.classes["@mozilla.org/network/io-service;1"]
                                 .getService(Components.interfaces.nsIIOService)
                                 .newFileURI(file)
                                 .spec;

    // Step 1: Get all photos in use in the gContactSync photos directory (photoURIs)
    // and in the TB Photos directory (photoNames).
    for (var uri in abs) {
      var ab = abs[uri];
      var contacts = ab.getAllContacts();
      for (var i in contacts) {
        var contact = contacts[i];
        var photoURI = contact.getValue("PhotoURI");
        if (photoURI) {
          if (photoURI.indexOf(gcsPhotosDir) != -1) {
            photoURI = photoURI.substring(gcsPhotosDir.length);
            photoURIs[photoURI] = true;
            gContactSync.LOGGER.VERBOSE_LOG(" * " + photoURI);
          }
          photoNames[contact.getValue("PhotoName")] = true;
        }
      }
    }
    var numRemoved = 0;
    if (file.exists() && file.isDirectory()) {
      // Step 2: Iterate through all photos in gContactSync's photos directory and
      // delete the unused ones
      gContactSync.LOGGER.VERBOSE_LOG(" * Searching gContactSync Photos directory");
      var iter = file.directoryEntries;
      while (iter.hasMoreElements()) {
        file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);
        if (file.isFile()) {
          var filename = file.leafName;
          if (!photoURIs[filename]) {
            gContactSync.LOGGER.VERBOSE_LOG("  - Deleting " + filename);
            try {
              file.remove(false);
              ++numRemoved;
            } catch(e) {
              gContactSync.LOGGER.LOG_WARNING("Unable to delete the following file: " + filename);
            }
          }
        }
      }
    }
    // Step 3: Iterate through all photos in TB's Photos directory and delete
    // the unused ones
    file = Components.classes["@mozilla.org/file/directory_service;1"]
                     .getService(Components.interfaces.nsIProperties)
                     .get("ProfD", Components.interfaces.nsIFile);
    file.append("Photos")
    if (file.exists() && file.isDirectory()) {
      // Step 2: Iterate through all photos in gContactSync's photos directory and
      // delete the unused ones
      gContactSync.LOGGER.VERBOSE_LOG(" * Searching TB Photos directory");
      var iter = file.directoryEntries;
      while (iter.hasMoreElements()) {
        file = iter.getNext().QueryInterface(Components.interfaces.nsIFile);
        if (file.isFile()) {
          var filename = file.leafName;
          if (!photoNames[filename]) {
            gContactSync.LOGGER.VERBOSE_LOG("  - Deleting " + filename);
            try {
              file.remove(false);
              ++numRemoved;
            } catch(e) {
              gContactSync.LOGGER.LOG_WARNING("Unable to delete the following file: " + filename);
            }
          }
        }
      }
    }
    if (alertWhenFinished) {gContactSync.alert(gContactSync.StringBundle.getStr("finishedPhotoClean").replace("%d", numRemoved));}
  }
};
