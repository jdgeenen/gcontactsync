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
 * Portions created by the Initial Developer are Copyright (C) 2008-2013
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

/**
 * Stores and retrieves the authentication token from the login manager.
 * Does NOT store the password and username.
 * @class
 */
com.gContactSync.LoginManager = {
  /** The hostname used in the login manager */
  mHostname:      "chrome://gContactSync/oauth",
  /** The URL in the login manager */
  mSubmitURL:     "User Refresh Token",
  /** The HTTP realm */
  mHttpRealm:     null,
  /** The username field */
  mUsernameField: "",
  /** The password field */
  mPasswordField: "",
  /** An object with authentication tokens keyed by username */
  mAuthTokens:    {},
  /** The number of authentication tokens found */
  mNumAuthTokens: 0,
  /**
   * Stores the token in the Login Manager.
   * @param aUsername {string} The username (e-mail address).
   * @param aToken    {string} The authentication token from Google.
   */
  addAuthToken: function LoginManager_addAuthToken(aUsername, aToken) {
    if (this.mNumAuthTokens === 0) {
      this.getAuthTokens();
    }
    // Thunderbird 2
    if ("@mozilla.org/passwordmanager;1" in Components.classes) {
      var passwordManager =  Components.classes["@mozilla.org/passwordmanager;1"]
                                       .getService(Components.interfaces.nsIPasswordManager);
      passwordManager.addUser(this.mHostname, aUsername, aToken);
      this.mAuthTokens[aUsername] = aToken;
      this.mNumAuthTokens++;
    }
    // Thunderbird 3, Seamonkey 2
    else if ("@mozilla.org/login-manager;1" in Components.classes) {
      var loginManager =  Components.classes["@mozilla.org/login-manager;1"]
                                    .getService(Components.interfaces.nsILoginManager),
          nsLoginInfo  = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                                    Components.interfaces.nsILoginInfo,
                                                    "init"),
          extLoginInfo = new nsLoginInfo(this.mHostname, this.mSubmitURL,
                                         this.mHttpRealm, aUsername, aToken,
                                         this.mUsernameField, this.mPasswordField);
      loginManager.addLogin(extLoginInfo);
      this.mAuthTokens[aUsername] = aToken;
      this.mNumAuthTokens++;
    }
  },
  /**
   * Gets the tokens in the Login Manager.
   * @returns {object} The auth tokens, if any, null otherwise.
   */
  getAuthTokens: function LoginManager_getAuthTokens() {
    this.mAuthTokens = {};
    this.mNumAuthTokens = 0;
    // Thunderbird 2
    if ("@mozilla.org/passwordmanager;1" in Components.classes) {
      var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                      .getService(Components.interfaces.nsIPasswordManager),
          iter = passwordManager.enumerator;
      while (iter.hasMoreElements()) {
        try {
          var pass = iter.getNext().QueryInterface(Components.interfaces.nsIPassword);
          if (pass.host === this.mHostname) {
            this.mAuthTokens[pass.user] = pass.password;
            this.mNumAuthTokens++;
          }
        } catch (e) {}
      }
    }
    // Thunderbird 3, Seamonkey 2
    else if ("@mozilla.org/login-manager;1" in Components.classes) {
      var loginManager =  Components.classes["@mozilla.org/login-manager;1"]
                                    .getService(Components.interfaces.nsILoginManager);
      // Find users for the given parameters
      var logins = loginManager.findLogins({}, this.mHostname, this.mSubmitURL,
                                           this.mHttpRealm);
      // Find user from returned array of nsILoginInfo objects
      for (var i = 0; i < logins.length; i++) {
        this.mAuthTokens[logins[i].username] = logins[i].password;
        this.mNumAuthTokens++;
      }
    }
    return this.mAuthTokens;
  },
  /**
   * Gets the token in the Login Manager.
   * @returns {string} The auth token, if present, null otherwise.
   */
  getAuthToken: function LoginManager_getAuthToken(aUsername) {
    if  (this.mNumAuthTokens === 0) {
      this.getAuthTokens();
    }
    return this.mAuthTokens ? this.mAuthTokens[aUsername] : null;
  },
  /**
   * Removes the auth token from the Login Manager.
   * @returns {boolean} True if the auth token was successfully removed.
   */
  removeAuthToken: function LoginManager_removeAuthToken(aUsername) {
    // Thunderbird 2
    if ("@mozilla.org/passwordmanager;1" in Components.classes) {
      var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                      .getService(Components.interfaces.nsIPasswordManager);
      try {
        passwordManager.removeUser(this.mHostname, aUsername);
        this.mAuthTokens[aUsername] = null;
        this.mNumAuthTokens--;
      }
      catch (e) {
        com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("removeLoginFailure") + "\n\n" + e);
      }
    }
    // Thunderbird 3, Seamonkey 2
    else if ("@mozilla.org/login-manager;1" in Components.classes) {
      var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                   .getService(Components.interfaces.nsILoginManager);
      // Find logins for the given parameters
      var logins = loginManager.findLogins({}, this.mHostname, this.mSubmitURL,
                                            this.mHttpRealm);
      aUsername = aUsername.toLowerCase();
      // Find user from returned array of nsILoginInfo objects
      for (var i = 0; i < logins.length; i++) {
        if (logins[i].username.toLowerCase() === aUsername) {
          try {
            com.gContactSync.LOGGER.VERBOSE_LOG("Found the login to remove");
            loginManager.removeLogin(logins[i]);
            this.mAuthTokens[aUsername] = null;
            this.mNumAuthTokens--;
            return;
          }
          catch (ex) {
            com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("removeLoginFailure") + "\n\n" + ex);
          }
        }
      }
      // Could not find the login...
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("removeLoginFailure"));
    }
  },
  /**
   * Returns an array of all e-mail account usernames matching an optional
   * pattern.
   *
   * @param aPattern {RegExp} A RegExp to match against.  If not provided all
   *                          IMAP & mailbox usernames are returned.
   */
  getAllEmailAccts: function LoginManager_getAllEmailAccts(aPattern) {
    var arr = [];
    // Thunderbird 2
    if ("@mozilla.org/passwordmanager;1" in Components.classes) {
      var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                      .getService(Components.interfaces.nsIPasswordManager),
          iter = passwordManager.enumerator;
      while (iter.hasMoreElements()) {
        try {
          var pass = iter.getNext().QueryInterface(Components.interfaces.nsIPassword);
          if (pass.host.indexOf("imap://") === 0 || pass.host.indexOf("mailbox://") === 0) {
            if (!aPattern || aPattern.test(pass.user)) {
              arr.push({username: pass.user, hostname: pass.host, password: pass.password});
            }
          }
        } catch (e) {}
      }
    }
    // Thunderbird 3, Seamonkey 2
    else if ("@mozilla.org/login-manager;1" in Components.classes) {
      var loginManager =  Components.classes["@mozilla.org/login-manager;1"]
                                    .getService(Components.interfaces.nsILoginManager),
      // Find users for the given parameters
          count  = {},
          out    = {},
          logins = loginManager.getAllLogins(count, out),
          i      = 0,
          hostname;
      // Find user from returned array of nsILoginInfo objects
      for (; i < logins.length; i++) {
        hostname = logins[i].hostname;
        if (hostname.indexOf("imap://") === 0 || hostname.indexOf("mailbox://") === 0) {
          if (!aPattern || aPattern.test(logins[i].username)) {
            arr.push({username: logins[i].username, hostname: hostname, password: logins[i].password});
          }
        }
      }
    }
    return arr;
  }
};
