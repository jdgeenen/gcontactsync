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
 * Portions created by the Initial Developer are Copyright (C) 2014-2015
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

if (!com) {var com = {};} // A generic wrapper variable
// A wrapper for all GCS functions and variables
if (!com.gContactSync) {com.gContactSync = {};}

/**
 * A simple class to assist with OAuth2 authentication.
 * Calls the given callback when the browser passed to init has its source changed to the redirect URI.
 * Assumes the browser element's source is already pointed to the initial OAuth page.
 * @class
 */
com.gContactSync.OAuth2 = {
  /**
   * Initializes this class.
   * @param aBrowserElem {browser} Browser element.
   * @param aRedirectURI {string} The redirect URI to watch for.
   * @param aCallback {function} The function to call when the browser's source changes to the redirect URI.
   */
  init: function OAuth2_init(aBrowserElem, aRedirectURI, aCallback, aBrowserTitle) {
    this.mBrowserElem = aBrowserElem;
    this.mRedirectURI = aRedirectURI;
    this.mCallback = aCallback;
    this.mBrowserTitle = aBrowserTitle;
    setTimeout(this.checkTitle, 1000);
  },
  /**
   * Notify that an authorization code was received.  Sends a token request using the code.
   *
   * @param aCode {string} The authorization code.
   */
  onCodeReceived: function OAuth2_onCodeReceived(aCode) {
    com.gContactSync.LOGGER.LOG("Received an authorization code: " + aCode);
    this.mBrowserElem.loadURI("");
    var request = new com.gContactSync.GHttpRequest("TOKEN_REQUEST", aCode);
    request.mOnSuccess = com.gContactSync.OAuth2.onTokenReceived;
    request.mOnError = function onTokenError(aHttpReq) {
      com.gContactSync.alertError(aHttpReq.responseText);
    };
    request.send();
  },
  /**
   * Notify that an access token was received.  Saves the refresh token and advances the wizard.
   *
   * @param aHttpReq {XmlHttpRequest} The HTTP request.
   */
  onTokenReceived: function OAuth2_onTokenReceived(aHttpReq) {
    com.gContactSync.LOGGER.LOG("Received an access token + " + aHttpReq.responseText);
    com.gContactSync.OAuth2.mCallback(JSON.parse(aHttpReq.responseText));
  },
  /**
   * Checks the title of the browser for the requested title indicating a code.
   */
  checkTitle: function OAuth2_checkTitle() {
    var title = com.gContactSync.OAuth2.mBrowserElem.contentTitle;
    if (title && title.indexOf(com.gContactSync.OAuth2.mBrowserTitle) === 0) {
      com.gContactSync.OAuth2.onCodeReceived(title.substring(com.gContactSync.OAuth2.mBrowserTitle.length));
    } else {
      setTimeout(com.gContactSync.OAuth2.checkTitle, 500);
    }
  }
};
