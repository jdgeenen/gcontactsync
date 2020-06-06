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

/**
 * Sets up an HTTP request to send to Google.
 * After calling this constructor and setting up any additional data, call the
 * send method.
 * 
 * @param aType       {string} The type of request.  Must be one of the following
 *                             authenticate, getAll, get, update, add, delete,
 *                             getGroups
 * @param aAuth       {string} The authorization token.
 * @param aUrl        {string} The url for the request, if unique for the type of
 *                             request.  Not required for authenticate, getAll,
 *                             getGroups, and add.
 * @param aBody       {string} The body of the request.
 * @param aOther      {string} Additional parameter to use when needed.
 *                             Currently this is only used for GET requests for
 *                             obtaining contacts in a specified group (pass the
 *                             Group ID in that case)
 * @param aStartIndex {number} The index to start the request from.
 * @constructor
 * @class
 * @extends gContactSync.HttpRequest
 */
gContactSync.GHttpRequest = function gCS_GHttpRequest(aType, aAuth, aUrl, aBody, aOther, aStartIndex) {
  gContactSync.HttpRequest.call(this);  // call the superclass' constructor
  this.mBody = aBody;
  // all urls in gdata use SSL.  If a URL is supplied, make sure it uses SSL
  if (aUrl && aUrl.indexOf("https://") < 0) {
    aUrl = aUrl.replace("http://", "https://");
  }
  switch (aType) {
  case "AUTH_SUB_SESSION":
  case "authsubsession":
    this.mContentType = this.CONTENT_TYPES.URL_ENC;
    this.mUrl         = gContactSync.gdata.AUTH_SUB_SESSION_URL;
    this.mType        = gContactSync.gdata.AUTH_SUB_SESSION_TYPE;
    break;
  case "TOKEN_REQUEST":
  case "tokenrequest":
    this.mContentType = this.CONTENT_TYPES.URL_ENC;
    this.mUrl         = gContactSync.gdata.TOKEN_REQUEST_URL;
    this.mType        = gContactSync.gdata.TOKEN_REQUEST_TYPE;
    this.addParameter("code", aAuth);
    this.addParameter("client_id", gContactSync.gdata.CLIENT_ID);
    this.addParameter("client_secret", gContactSync.gdata.CLIENT_SECRET);
    this.addParameter("redirect_uri", gContactSync.gdata.REDIRECT_URI);
    this.addParameter("grant_type", gContactSync.gdata.TOKEN_REQUEST_GRANT_TYPE);
    break;
  case "REFRESH_REQUEST":
  case "tokenrequest":
    this.mContentType = this.CONTENT_TYPES.URL_ENC;
    this.mUrl         = gContactSync.gdata.REFRESH_REQUEST_URL;
    this.mType        = gContactSync.gdata.REFRESH_REQUEST_TYPE;
    this.addParameter("refresh_token", aAuth);
    this.addParameter("client_id", gContactSync.gdata.CLIENT_ID);
    this.addParameter("client_secret", gContactSync.gdata.CLIENT_SECRET);
    this.addParameter("grant_type", gContactSync.gdata.REFRESH_REQUEST_GRANT_TYPE);
    break;
  case "AUTHENTICATE":
  case "authenticate":
    this.mContentType = this.CONTENT_TYPES.URL_ENC;
    this.mUrl         = gContactSync.gdata.AUTH_URL;
    this.mType        = gContactSync.gdata.AUTH_REQUEST_TYPE;
    break;
  case "GETALL":
  case "getAll":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = gContactSync.gdata.contacts.GET_ALL_URL +
                        gContactSync.Preferences.mSyncPrefs.maxContacts.value +
                        (aStartIndex ? "&start-index=" + encodeURIComponent(aStartIndex) : "");
    this.mType        = gContactSync.gdata.contacts.requestTypes.GET_ALL;
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "getFromGroup":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = gContactSync.gdata.contacts.GET_ALL_URL +
                        gContactSync.Preferences.mSyncPrefs.maxContacts.value +
                        (aStartIndex ? "&start-index=" + encodeURIComponent(aStartIndex) : "") +
                        "&group=" + encodeURIComponent(aOther);
    this.mType        = gContactSync.gdata.contacts.requestTypes.GET_ALL;
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "GETGROUPS":
  case "getGroups":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = gContactSync.gdata.contacts.GROUPS_URL;
    this.mType        = gContactSync.gdata.contacts.requestTypes.GET;
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "GET":
  case "get":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = aUrl; // the URL is unique and needs to be passed in
    this.mType        = gContactSync.gdata.contacts.requestTypes.GET;
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "UPDATE":
  case "update":
  case "updategroup":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = aUrl;
    this.mType        = "POST";  // for firewalls that block PUT requests
    this.addContentOverride(gContactSync.gdata.contacts.requestTypes.UPDATE);
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "ADD":
  case "add":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = gContactSync.gdata.contacts.ADD_URL;
    this.mType        = gContactSync.gdata.contacts.requestTypes.ADD;
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "addGroup":
    this.mContentType = this.CONTENT_TYPES.ATOM;
    this.mUrl         = gContactSync.gdata.contacts.ADD_GROUP_URL;
    this.mType        = gContactSync.gdata.contacts.requestTypes.ADD;
    this.addHeaderItem("Authorization", aAuth);
    break;
  case "DELETE":
  case "delete":
    this.mContentType = this.CONTENT_TYPES.URL_ENC;
    this.mUrl         = aUrl;
    this.mType        = "POST"; // for firewalls that block DELETE
    this.addContentOverride(gContactSync.gdata.contacts.requestTypes.DELETE);
    this.addHeaderItem("Content-length", 0); // required or there will be an error
    this.addHeaderItem("Authorization", aAuth);
    break;
  default:
    // if the input doesn't match one of the above throw an error
    throw "Invalid aType parameter supplied to the " +
          "gContactSync.GHttpRequest constructor" +
          gContactSync.StringBundle.getStr("pleaseReport");
  }
  // use version 3 of the contacts api
  this.addHeaderItem("GData-Version", "3");
  // handle Token Expired errors
  this.mOn401 = gContactSync.handle401;
  if (!this.mUrl) {
    throw "Error - no URL was found for the HTTP Request";
  }
};

// get the superclass' prototype
gContactSync.GHttpRequest.prototype = new gContactSync.HttpRequest();

/**
 * Handles 'Token Expired' errors.
 * If a sync is in progress:
 *  - Alert the user
 *  - Show the OAuth dialog
 *  - Save the new refresh token
 *  - Restart the sync
 */
gContactSync.handle401 = function gCS_handle401() {
  gContactSync.LOGGER.LOG("***Found an expired token***");
  if (!gContactSync.Preferences.mSyncPrefs.synchronizing.value || !gContactSync.Sync.mCurrentUsername) {
    return;
  }
  gContactSync.alertWarning(gContactSync.StringBundle.getStr("tokenExpiredMsg"));
  gContactSync.gdata.requestNewRefreshToken(gContactSync.Sync.mCurrentUsername, gContactSync.finish401);
};

/**
 * Called after the re-authentication HTTP request is sent after a 401 error
 * @param aResponse {object} The JSON response to the OAuth2 request.
 */
gContactSync.finish401 = function gCS_finish401(aResponse) {
  var username = gContactSync.Sync.mCurrentUsername;
  if (username && aResponse) {
    // Remove the auth token if it wasn't already
    if (gContactSync.LoginManager.mAuthTokens[username]) {
      gContactSync.LOGGER.VERBOSE_LOG(" * Removing old auth token");
      gContactSync.LoginManager.removeAuthToken(username);
    }
    gContactSync.LoginManager.addAuthToken(username, aResponse.refresh_token);
    gContactSync.Sync.mIndex--;
    gContactSync.Sync.syncNextUser();
  }
};
