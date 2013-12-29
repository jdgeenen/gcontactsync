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
 * Portions created by the Initial Developer are Copyright (C) 2013
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
  /** Initializes the AccountSetupWizard class when the window has finished loading */
  function gCS_AccountSetupWizardLoadListener(e) {
    com.gContactSync.AccountSetupWizard.init();
    window.sizeToContent();
  },
false);

/**
 * Provides helper functions for the new account wizard.
 */
com.gContactSync.AccountSetupWizard = {
  NEW_ACCOUNT_IDS:      ["emailLabel", "email", "passwordLabel", "password"],
  EXISTING_ACCOUNT_IDS: ["existingAccountList"],
  mAuthToken:           "",
  mEmailAddress:        "",
  mAccounts:            [],
  /**
   * Initializes the first page of the wizard.
   */
  init: function AccountSetupWizard_init() {
    this.updateAccountIDs();
    this.addAccounts();
  },
  /**
   * Adds IMAP, POP3, and gContactSync accounts from the login manager to the dropdown.
   */
  addAccounts: function AccountSetupWizard_addAccounts() {
    com.gContactSync.LOGGER.VERBOSE_LOG("Adding accounts");
    this.mAccounts = [];
    var authTokens = com.gContactSync.LoginManager.getAuthTokens();
    var accountsMenuList = document.getElementById("existingAccountList");
    for (var username in authTokens) {
      if (this.accountAlreadyExists(username)) {continue;}
      com.gContactSync.LOGGER.VERBOSE_LOG(" * Adding existing auth token for " + username);
      this.mAccounts.push({username: username, token: authTokens[username]});
      accountsMenuList.appendItem(username);
    }
    var emailAccounts = com.gContactSync.LoginManager.getAllEmailAccts();
    for (var i = 0; i < emailAccounts.length; ++i) {
      if (this.accountAlreadyExists(emailAccounts[i].username)) {continue;}
      com.gContactSync.LOGGER.VERBOSE_LOG(" * Adding e-mail address: " + emailAccounts[i].username);
      this.mAccounts.push(emailAccounts[i]);
      accountsMenuList.appendItem(emailAccounts[i].username);
    }
    if (accountsMenuList.itemCount === 0) {
      document.getElementById("accountOption").selectedIndex = 1;
      document.getElementById("existingAccount").disabled = 1;
      accountsMenuList.appendItem(com.gContactSync.StringBundle.getStr('noAccountsFound'));
      this.updateAccountIDs();
    }
    accountsMenuList.selectedIndex = 0;
  },
  /**
   * Returns whether an account already exists for the given username.
   * @param {string} aUsername The username to check.
   * @return {boolean} Whether an account already exists for the given username.
   */
  accountAlreadyExists: function AccountSetupWizard_accountAlreadyExists(aUsername) {
    aUsername = aUsername.toLowerCase();
    for (var i = 0; i < this.mAccounts.length; ++i) {
      if (this.mAccounts[i].username.toLowerCase() === aUsername) {return true;}
    }
    return false;
  },
  /**
   * Updates the account-related elements to disable elements for the option not currently selected.
   */
  updateAccountIDs: function AccountSetupWizard_updateAccountIDs() {
    var option = document.getElementById("accountOption");
    var disableIDs = this.EXISTING_ACCOUNT_IDS;
    var enableIDs  = this.NEW_ACCOUNT_IDS;
    if (option.value === "existing") {
      disableIDs = this.NEW_ACCOUNT_IDS;
      enableIDs  = this.EXISTING_ACCOUNT_IDS;
    }
    for (var i = 0; i < disableIDs.length; ++i) {
      document.getElementById(disableIDs[i]).disabled = true;
    }
    for (var j = 0; j < enableIDs.length; ++j) {
      document.getElementById(enableIDs[j]).disabled = false;
    }
  },
  /**
   * Gets an auth token for the selected username if necessary (and possible), then returns whether the page may
   * advance now.  If this function must get an auth token it will advance the page upon successful completion
   * of the HTTP request.
   * @return {boolean} Whether the account page may advance now.
   */
  advanceAccountPage: function AccountSetupWizard_advancedAccountPage() {

    // Try to get a token for the account
    // If there's already a token it was advanced by a successful authentication.
    if (this.mAuthToken !== "") {
      return true;
    }

    var option = document.getElementById("accountOption");
    var password = "";

    com.gContactSync.LOGGER.VERBOSE_LOG("Advancing account page using a(n) " + option.value + " account.");

    if (option.value === "existing") {
      var index = document.getElementById("existingAccountList").selectedIndex;
      this.mEmailAddress = this.mAccounts[index].username;
      if ("token" in this.mAccounts[index]) {
        com.gContactSync.LOGGER.VERBOSE_LOG(" * Already have a token");
        this.mAuthToken = this.mAccounts[index].token;
        return true;
      }
      password = this.mAccounts[index].password;
    } else {
      var emailElem    = document.getElementById("email");
      var passwordElem = document.getElementById("password");
      this.mEmailAddress = emailElem.value;
      password = passwordElem.value;
      // This is a primitive way of validating an e-mail address, but Google takes
      // care of the rest.  It seems to allow getting an auth token w/ only the
      // username, but returns an error when trying to do anything w/ that token
      // so this makes sure it is a full e-mail address.
      if (this.mEmailAddress.indexOf("@") < 1) {
        com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("invalidEmail"));
        return false;
      }
    }

    com.gContactSync.LOGGER.VERBOSE_LOG(" * Requesting a token for " + this.mEmailAddress);

    var body    = com.gContactSync.gdata.makeAuthBody(this.mEmailAddress, password);
    var httpReq = new com.gContactSync.GHttpRequest("authenticate", null, null, body);
    // Move to the next page in the wizard upon successful authentication
    httpReq.mOnSuccess = function authSuccess(httpReq) {
      com.gContactSync.AccountSetupWizard.mAuthToken = httpReq.responseText.split("\n")[2];
      com.gContactSync.LoginManager.addAuthToken(aUsername, 'GoogleLogin ' + aAuthToken);
      document.getElementById("initialSetupWizard").advance();
    };
    // if it fails, alert the user and prompt them to try again
    httpReq.mOnError = function authError(httpReq) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr('authErr'));
      com.gContactSync.LOGGER.LOG_ERROR('Authentication Error - ' +
                                        httpReq.status,
                                        httpReq.responseText);
    };
    // if the user is offline, alert them and quit
    httpReq.mOnOffline = function authOffline(httpReq) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr('offlineStatusText'));
      com.gContactSync.LOGGER.LOG_ERROR('Authentication Error (offline) - ' +
                                        httpReq.status,
                                        httpReq.responseText);
    };
    httpReq.send();
    // Don't let the page advance until a successful response is returned.
    return false;
  },
  /**
   * Initializes the account settings (address books and groups) and selects the AB with
   * the name 'aSearch' if present.  If not found, creates an AB with the name this.mEmailAddress.
   * Does not show ABs that are already being synchronized.
   * @param {string} aSearch The AB to be highlighted.
   */
  setupAccountSettings: function AccountSetupWizard_setupAccountSettings(aSearch) {
    var abNameElem = document.getElementById("abName");
    abNameElem.removeAllItems();
    var abs = com.gContactSync.GAbManager.getAllAddressBooks();
    var selectedIndex = -1;
    var i = 0;
    aSearch = (aSearch || this.mEmailAddress).toLowerCase();
    for (var uri in abs) {
      // Skip over address books that are already synchronized
      if (abs.hasOwnProperty(uri) && !abs[uri].mPrefs.Username) {
        abNameElem.appendItem(abs[uri].getName(), uri);
        if (abs[uri].getName().toLowerCase() === aSearch) {
          selectedIndex = i;
        }
      }
      ++i;
    }
    if (selectedIndex === -1) {
      var name = aSearch;
      // If an AB with the e-mail address doesn't already exist (or is synchronized) find
      // the first AB of the form <email (#)> that 
      for (var j = 1; true; ++j) {
        var ab = com.gContactSync.GAbManager.getGAbByName(name, true);
        if (!ab || !ab.mPrefs.Username) {break;}
        name = aSearch + " (" + j + ")";
      }
      abNameElem.insertItemAt(0, name, 0);
      selectedIndex = 0;
    }
    abNameElem.selectedIndex = selectedIndex;
    com.gContactSync.Accounts.restoreGroups();
  },
  /**
   * Creates and returns a new address book after requesting a name for it then updates the AB list.
   * If an AB of any type already exists this function will do nothing.
   */
  newAddressBook: function AccountSetupWizard_newAddressBook() {
    var name = com.gContactSync.prompt(com.gContactSync.StringBundle.getStr("newABPrompt"), null, window);
    if (!name) {
      return;
    }
    var ab = com.gContactSync.GAbManager.getGAbByName(name, true);
    if (ab && ab.mPrefs.Username) {
      com.gContactSync.alertWarning(com.gContactSync.StringBundle.getStr("abAlreadySynchronized"));
      return;
    }
    this.setupAccountSettings(name);
  },
  /**
   * Finishes the wizard by setting up the selected AB to sync with the selected account and group.
   */
  finish: function AccountSetupWizard_finish() {
    var abName = document.getElementById("abName").label;
    var group  = document.getElementById("Groups").value;
    var syncGroups = String(group === "All"),
        myContacts = String(group !== "All" && group !== "false");
    // TODO combine with saveSelectedAccount
    com.gContactSync.LOGGER.LOG("***Account Wizard is synchronizing " + abName + " with " + this.mEmailAddress + " / " + group + "***");
    var ab = com.gContactSync.GAbManager.getGAbByName(abName);
    ab.savePref("Username", this.mEmailAddress);
    ab.savePref("Plugin", "Google");
    ab.savePref("Disabled", "false");
    ab.savePref("updateGoogleInConflicts", "true");
    ab.savePref("Primary",  "true");
    ab.savePref("syncGroups", syncGroups);
    ab.savePref("myContacts", myContacts);
    ab.savePref("myContactsName", group);
    ab.savePref("writeOnly", "false");
    ab.savePref("readOnly",  "false");
    ab.setLastSyncDate(0);
    return true;
  }
};

