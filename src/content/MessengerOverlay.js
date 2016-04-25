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
 * Portions created by the Initial Developer are Copyright (C) 2010-2016
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
  /** Initializes the MessengerOverlay class when the window has finished loading */
  function gCS_mainOverlayLoadListener() {
    window.removeEventListener("load", gCS_mainOverlayLoadListener, false);
    // introduce a slight delay before initializing to let FileIO load in TB 2
    setTimeout(gContactSync.MessengerOverlay.initialize, 100);
  },
false);

/**
 * The main overlay removes old log files and logs basic information about
 * the version of gContactSync and Thunderbird.
 * Also resets the needRestart pref to false.
 * @class
 */
gContactSync.MessengerOverlay = {
  /**
   * The original SetBusyCursor function that throws exceptions after
   * gContactSync synchronizes from messenger.xul.
   */
  mOriginalSetBusyCursor: null,
  /**
   * Initializes the MessengerOverlay class.
   * This consists of setting the needRestart pref to false, removing the old
   * log file, and logging basic TB and gContactSync information.
   */
  initialize: function MessengerOverlay_initialize() {
    // reset the needRestart pref
    gContactSync.Preferences.setSyncPref("needRestart", false);

    // Perform log rotation
    gContactSync.MessengerOverlay.rotateLog(Math.max(1, gContactSync.Preferences.mSyncPrefs.numLogsInRotation.value));

    // override SetBusyCursor to wrap it in a try/catch block as it and
    // this add-on do not get along...
    gContactSync.MessengerOverlay.mOriginalSetBusyCursor = SetBusyCursor;
    SetBusyCursor = gContactSync.MessengerOverlay.SetBusyCursor;

    // log some basic system and application info
    gContactSync.LOGGER.LOG(
        "Loading gContactSync at " + new Date() +
        "\n * Version is:       " + gContactSync.getVersionString() +
        "\n * Last version was: " + gContactSync.getVersionString(true) +
        "\n * User Agent:       " + navigator.userAgent +
        "\n * Log location:     " + gContactSync.FileIO.mLogFile.path +
        "\n");

    // Preferences.js is loaded before MessengerOverlay so the preferences are logged to the previous log file
    // in the rotation (if any).  If verbose logging is enabled get the prefs again to log them.
    if (gContactSync.Preferences.mSyncPrefs.verboseLog.value) {
      gContactSync.Preferences.getSyncPrefs();
    }

    var lastVersionMajor   = gContactSync.Preferences.mSyncPrefs.lastVersionMajor.value;
    var lastVersionMinor   = gContactSync.Preferences.mSyncPrefs.lastVersionMinor.value;
    var lastVersionRelease = gContactSync.Preferences.mSyncPrefs.lastVersionRelease.value;
    var lastVersionSuffix  = gContactSync.Preferences.mSyncPrefs.lastVersionSuffix.value;

    gContactSync.Preferences.setSyncPref("synchronizing", false);

    // If this is the first time gContactSync is running (or the user never setup an account)
    // run the setup wizard.
    // If moving from 0.3.x or <0.4.0b1 then update the chat names and incorrect types
    // Otherwise if coming from pre-0.4.0rc1 update the incorrect types
    // The upgrade will take place during the next sync
    var runSetupWizard = false;
    if ((lastVersionMajor === 0) && (lastVersionMinor === 0) && (lastVersionRelease === 0)) {
      runSetupWizard = true;
    } else if (((lastVersionMajor === 0) && (lastVersionMinor < 4)) ||
        ((lastVersionMajor === 0) && (lastVersionMinor === 4) && (lastVersionRelease === 0) && (lastVersionSuffix.length > 0) && (lastVersionSuffix.charAt(0) === "a"))) {
      gContactSync.Preferences.setSyncPref("v04UpgradeNeeded", true);
    } else if ((lastVersionMajor === 0) && (lastVersionMinor === 4) && (lastVersionRelease === 0) && (lastVersionSuffix.length > 0) && ((lastVersionSuffix.charAt(0) === "a") || (lastVersionSuffix.charAt(0) === "b"))) {
      gContactSync.Preferences.setSyncPref("v04RCUpgradeNeeded", true);
    }
    if (gContactSync.Preferences.mSyncPrefs.overrideGetCardForEmail.value) {
      try {
        gContactSync.MessengerOverlay.originalGetCardForEmail = getCardForEmail;
        getCardForEmail = gContactSync.MessengerOverlay.getCardForEmail;
      } catch (e) {}
    }
    // Check for an auth token and either schedule a sync if at least one exists or show the new account wizard otherwise.
    if (runSetupWizard) {
      gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("notAuth"));
      gContactSync.Overlay.openAccountWizard(true);
    } else {
      gContactSync.Sync.schedule(gContactSync.Preferences.mSyncPrefs.initialDelayMinutes.value * 60000);
    }
  },
  /**
   * Rotates log files.
   * @param numLogsInRotation The total number of logs in the rotation.  Must be at least 1.
   */
  rotateLog: function MessengerOverlay_rotateLog(numLogsInRotation) {
    var file = gContactSync.FileIO.getProfileDirectory();
    file.append(gContactSync.FileIO.fileNames.FOLDER_NAME);

    // Remove the last file in the rotation
    var lastName = this.getLogFileNameFromNumber(numLogsInRotation - 1);
    file.append(lastName);
    if (file.exists()) {file.remove(false);}

    // Rename files
    for (var i = numLogsInRotation - 2; i >= 0; --i) {
      var name = this.getLogFileNameFromNumber(i);
      file = file.parent;
      file.append(name);
      if (file.exists() && file.isFile()) {
        file.moveTo(file.parent, lastName);
      }
      lastName = name;
    }
  },
  /**
   * Returns the name of the log file given the log index.
   * @param i The log file number.
   * @return {string} The name of the log file at the given index.
   */
  getLogFileNameFromNumber: function MessengerOverlay_getLogFileNameFromNumber(i) {
    var fileName = gContactSync.FileIO.fileNames.LOG_FILE;
    if (i) {fileName = fileName.replace(/log/, "log" + i);}
    return fileName;
  },
  /**
   * Calls the original SetBusyCursor() function from mailCore.js wrapped in a
   * try/catch block.  For some unknown reason, gContactSync causes
   * SetBusyCursor to fail after a synchronization with an update from
   * messenger.xul.
   * See Bug 22801 for more details.
   */
  SetBusyCursor: function MessengerOverlay_SetBusyCursor() {
    try {
      gContactSync.MessengerOverlay.mOriginalSetBusyCursor.apply(this, arguments);
    }
    catch (e) {
      gContactSync.LOGGER.VERBOSE_LOG("SetBusyCursor threw an exception.");
    }
  },
 /**
  * Returns an object with the first card and AB found with the given e-mail
  * address.
  * This is used to also search the ThirdEmail and FourthEmail properties as
  * added by gContactSync.
  *
  * @param aEmail {string} The e-mail address to search for.
  *
  * @returns {object} An object with the AB and contact, if found.
  *                   The object has 2 properties: book, containing the AB; and
  *                   card, containing the contact.  Both are null if no contact
  *                   was found with the given e-mail address, or if the e-mail
  *                   address was empty.
  */
  getCardForEmail: function MessengerOverlay_getCardForEmail(aEmail) {
    var result = { book: null, card: null };
 
    // abmanager should always exist as the original function doesn't exist in
    // TB 2 (or Seamonkey 2)
    if (!aEmail || !Components.classes["@mozilla.org/abmanager;1"]) {
      return result;
    }
 
    var abs = Components.classes["@mozilla.org/abmanager;1"]
                        .getService(Components.interfaces.nsIAbManager)
                        .directories;
 
    while (abs.hasMoreElements()) {
      var ab = abs.getNext()
                  .QueryInterface(Components.interfaces.nsIAbDirectory);
      try {
        // Search the original PrimaryEmail and SecondEmail fields
        var card = ab.cardForEmailAddress(aEmail);
        // Search ThirdEmail
        if (!card) {
          card = ab.getCardFromProperty("ThirdEmail", aEmail, false);
        }
        // Search FourthEmail
        if (!card) {
          card = ab.getCardFromProperty("FourthEmail", aEmail, false);
        }
        // If a card was found somewhere, setup result        
        if (card) {
          result.book = ab;
          result.card = card;
          // used in case ContactPhotos is installed
          try {
            ContactPhotos.mCurrentAb      = ab;
            ContactPhotos.mCurrentContact = card;
          } catch (e) {}
          return result;
        }
      }
      catch (ex) {}
    }
    return result;
  }
};
