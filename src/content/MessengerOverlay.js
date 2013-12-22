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
 * Portions created by the Initial Developer are Copyright (C) 2010
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

if (!com) var com = {}; // A generic wrapper variable
// A wrapper for all GCS functions and variables
if (!com.gContactSync) com.gContactSync = {};

window.addEventListener("load",
  /** Initializes the MessengerOverlay class when the window has finished loading */
  function gCS_mainOverlayLoadListener(e) {
    // introduce a slight delay before initializing to let FileIO load in TB 2
    setTimeout(com.gContactSync.MessengerOverlay.initialize, 100);
  },
false);

/**
 * The main overlay removes old log files and logs basic information about
 * the version of gContactSync and Thunderbird.
 * Also resets the needRestart pref to false.
 * @class
 */
com.gContactSync.MessengerOverlay = {
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
    com.gContactSync.Preferences.setSyncPref("needRestart", false);
    // remove the old log file
    if (com.gContactSync.FileIO.mLogFile && com.gContactSync.FileIO.mLogFile.exists()) {
      com.gContactSync.FileIO.mLogFile.remove(false); // delete the old log file
    }

    // override SetBusyCursor to wrap it in a try/catch block as it and
    // this add-on do not get along...
    com.gContactSync.MessengerOverlay.mOriginalSetBusyCursor = SetBusyCursor;
    SetBusyCursor = com.gContactSync.MessengerOverlay.SetBusyCursor;

    // log some basic system and application info
    com.gContactSync.LOGGER.LOG(
        "Loading gContactSync at " + new Date() +
        "\n * Version is:       " + com.gContactSync.getVersionString() +
        "\n * Last version was: " + com.gContactSync.getVersionString(true) +
        "\n * User Agent:       " + navigator.userAgent +
        "\n * Log location:     " + com.gContactSync.FileIO.mLogFile.path +
        "\n");
    var lastVersionMajor   = com.gContactSync.Preferences.mSyncPrefs.lastVersionMajor.value;
    var lastVersionMinor   = com.gContactSync.Preferences.mSyncPrefs.lastVersionMinor.value;
    var lastVersionRelease = com.gContactSync.Preferences.mSyncPrefs.lastVersionRelease.value;
    var lastVersionSuffix  = com.gContactSync.Preferences.mSyncPrefs.lastVersionSuffix.value;

    com.gContactSync.Preferences.setSyncPref("synchronizing", false);

    // On the first run display a login prompt
    if (!lastVersionMinor) {
      com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr("notAuth"));
      com.gContactSync.MessengerOverlay.promptLogin();
    } else {

      // If moving from 0.3.x or <0.4.0b1 then update the chat names
      // The upgrade will take place during the next sync
      if (((lastVersionMajor == 0) && (lastVersionMinor < 4)) ||
          ((lastVersionRelease == 0) && (lastVersionSuffix.length > 0) && (lastVersionSuffix.charAt(0) == "a"))) {
        com.gContactSync.Preferences.setSyncPref("v04UpgradeNeeded", true);
      }

      com.gContactSync.MessengerOverlay.updateVersion();
      com.gContactSync.Sync.schedule(com.gContactSync.Preferences.mSyncPrefs.initialDelayMinutes.value * 60000);
    }
    if (com.gContactSync.Preferences.mSyncPrefs.overrideGetCardForEmail.value) {
      try {
        com.gContactSync.MessengerOverlay.originalGetCardForEmail = getCardForEmail;
        getCardForEmail = com.gContactSync.MessengerOverlay.getCardForEmail;
      } catch (e) {}
    }
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
      com.gContactSync.MessengerOverlay.mOriginalSetBusyCursor.apply(this, arguments);
    }
    catch (e) {
      com.gContactSync.LOGGER.VERBOSE_LOG("SetBusyCursor threw an exception.");
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
            com.ContactPhotos.mCurrentAb      = ab;
            com.ContactPhotos.mCurrentContact = card;
          } catch (e) {}
          return result;
        }
      }
      catch (ex) {}
    }
    return result;
  },
  /**
   * Checks to see whether or not there is an authentication token in the login
   * manager.  If so, it begins a sync.  If not, it shows the login prompt.
   */
  checkAuthentication: function MessengerOverlay_checkAuthentication() {
    if (com.gContactSync.gdata.isAuthValid()) {
      com.gContactSync.MessengerOverlay.updateVersion();  // Make sure the version has been updated
      if (com.gContactSync.MessengerOverlay.mUsername) {
        var name = com.gContactSync.Preferences.mSyncPrefs.addressBookName.value;
        var ab   = com.gContactSync.GAbManager.getGAb(com.gContactSync.GAbManager.getAbByName(name));
        ab.savePref("Username", com.gContactSync.MessengerOverlay.mUsername);
        ab.setLastSyncDate(0);
        com.gContactSync.Sync.begin(false, null);
      } else {
        com.gContactSync.Sync.schedule(com.gContactSync.Preferences.mSyncPrefs.initialDelayMinutes.value * 60000);
      }
    } else {
      com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr("notAuth"));
      com.gContactSync.MessengerOverlay.promptLogin();
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
  },
  /**
   * Prompts the user to enter his or her Google username and password and then
   * gets an authentication token to store and use.
   */
  promptLogin: function MessengerOverlay_promptLogin() {
    var prompt   = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                             .getService(Components.interfaces.nsIPromptService)
                             .promptUsernameAndPassword;
    var username = {};
    var password = {};
    // opens a username/password prompt
    var ok = prompt(window, com.gContactSync.StringBundle.getStr("loginTitle"),
                    com.gContactSync.StringBundle.getStr("loginText"), username, password, null,
                    {value: false});
    if (!ok)
      return false;

    // This is a primitive way of validating an e-mail address, but Google takes
    // care of the rest.  It seems to allow getting an auth token w/ only the
    // username, but returns an error when trying to do anything w/ that token
    // so this makes sure it is a full e-mail address.
    if (username.value.indexOf("@") < 1) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("invalidEmail"));
      return com.gContactSync.MessengerOverlay.promptLogin();
    }
    
    // fix the username before authenticating
    username.value = com.gContactSync.fixUsername(username.value);
    var body     = com.gContactSync.gdata.makeAuthBody(username.value, password.value);
    var httpReq  = new com.gContactSync.GHttpRequest("authenticate", null, null, body);
    // if it succeeds and Google returns the auth token, store it and then start
    // a new sync
    httpReq.mOnSuccess = function authSuccess(httpReq) {
      com.gContactSync.MessengerOverlay.login(username.value,
                                     httpReq.responseText.split("\n")[2]);
    };
    // if it fails, alert the user and prompt them to try again
    httpReq.mOnError = function authError(httpReq) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr('authErr'));
      com.gContactSync.LOGGER.LOG_ERROR('Authentication Error - ' +
                                        httpReq.status,
                                        httpReq.responseText);
      com.gContactSync.MessengerOverlay.promptLogin();
    };
    // if the user is offline, alert them and quit
    httpReq.mOnOffline = com.gContactSync.Sync.mOfflineFunction;
    httpReq.send();
    return true;
  },
  /**
   * Stores the given auth token in the login manager and starts the setup
   * window that will begin the first synchronization when closed.
   * @param aAuthToken {string} The authentication token to store.
   */
  login: function MessengerOverlay_login(aUsername, aAuthToken) {
    com.gContactSync.LoginManager.addAuthToken(aUsername, 'GoogleLogin ' + aAuthToken);
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr("initialSetup"));
    var setup = window.open("chrome://gcontactsync/content/FirstLogin.xul",
                            "SetupWindow",
                            "chrome,resizable=yes,scrollbars=no,status=no");
    com.gContactSync.MessengerOverlay.mUsername = aUsername;
    // when the setup window loads, set its onunload property to begin a sync
    setup.onload = function onloadListener() {
      setup.onunload = function onunloadListener() {
        com.gContactSync.MessengerOverlay.checkAuthentication();
      };
    };
  }
};
