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
 * Portions created by the Initial Developer are Copyright (C) 2008-2014
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
 * Sets up an HTTP request.<br>
 * The constructor is not all that useful so extend this class if you must
 * make repetitive HTTP requests.<br><br>
 * You may setup callbacks based on different HTTP status codes:
 * <ul>
 * <li>0 (offline): use <b>mOnError</b></li>
 * <li>200 (OK): use <b>mOnSuccess</b></li>
 * <li>201 (CREATED): use <b>mOnCreated</b></li>
 * <li>400 (BAD REQUEST): use <b>mOn401</b></li>
 * <li>401 (UNAUTHORIZED): use <b>mOn401</b></li>
 * <li>403 (FORBIDDEN): use <b>mOn401</b></li>
 * <li>503 (SERVICE_UNAVAILABLE): use <b>mOn503</b></li>
 * <li>&lt;anything else&gt;: use <b>mOnError</b></li>
 * </ul>
 * <br>Sample usage:
 * <pre>
 * // Create and setup a new HttpRequest
 * var myHttpRequest   = new com.gContactSync.HttpRequest();
 * myHttpRequest.mUrl  = "http://www.pirules.org";
 * myHttpRequest.mType = "GET";
 * myHttpRequest.addHeaderItem("Content-length", 0);
 * // setup the callbacks
 * myHttpRequest.mOnSuccess = function myRequestSuccess(aHttpReq) {
 *   com.gContactSync.alert("Request succeeded.  Content:\n\n" + aHttpReq.statusText);
 * };
 * myHttpRequest.mOnOffline = function myRequestOffline(aHttpReq) {
 *   com.gContactSync.alert("You are offline");
 * };
 * myHttpRequest.mOnError   = function myRequestError(aHttpReq) {
 *   com.gContactSync.alert("Request failed...Status: " + aHttpReq.status); 
 * };
 * // send the request
 * myHttpRequest.send();
 * </pre>
 * @constructor
 * @class
 */
com.gContactSync.HttpRequest = function gCS_HttpRequest() {
  if (window.XMLHttpRequest) {
    this.mHttpRequest = new XMLHttpRequest();
  }

  if (!this.mHttpRequest) {
    throw "Error - could not create an XMLHttpRequest" +
          com.gContactSync.StringBundle.getStr("pleaseReport");
  }

  this.mParameters = [];
};

com.gContactSync.HttpRequest.prototype = {
  /** Content types */
  CONTENT_TYPES: {
    /** URL encoded */
    URL_ENC: "application/x-www-form-urlencoded",
    /** ATOM/XML */
    ATOM:    "application/atom+xml",
    /** XML */
    XML:     "application/xml"
  },
  /**
   * Adds a content override to the header in case a firewall blocks DELETE or
   * PUT requests.
   * @param aType {string} The type of override.  Must be DELETE or PUT.
   */
  addContentOverride: function HttpRequest_addContentOverride(aType) {
    switch (aType) {
    case "delete":
    case "DELETE":
      this.addHeaderItem("X-HTTP-Method-Override", "DELETE");
      break;
    case "put":
    case "PUT":
      this.addHeaderItem("X-HTTP-Method-Override", "PUT");
      break;
    default:
      throw "Error - type sent to addContentOverride must be DELETE or PUT";
    }
  },
  /**
   * Adds a header label/value pair to the arrays of header information
   * @param aLabel {string} The label for the header.
   * @param aValue {string} The value for the header.
   */
  addHeaderItem: function HttpRequest_addHeaderItem(aLabel, aValue) {
    if (!this.mHeaderLabels) {
      this.mHeaderLabels = [];
      this.mHeaderValues = [];
    }
    this.mHeaderLabels.push(aLabel);
    this.mHeaderValues.push(aValue);
  },
  /**
   * Adds a parameter/value pair to the request.
   * @param aParameter {string} The parameter.
   * @param aValue {string} The value.
   */
  addParameter: function HttpRequest_addParameter(aLabel, aValue) {
    if (aValue) {
      this.mParameters.push(aLabel + "=" + encodeURIComponent(aValue));
    } else {
      this.mParameters.push(aLabel);
    }
  },
  /**
   * Sends the HTTP Request with the information stored in the object.<br>
   * Note: Setup everything, including the callbacks for different statuses
   *       including mOnSuccess, mOnError, mOnFail, and mOnCreated first.<br>
   * See the class documentation for a sample request.
   */
  send: function HttpRequest_send() {

    var params = this.mParameters.join("&");

    // log the basic info for debugging purposes
    com.gContactSync.LOGGER.VERBOSE_LOG("HTTP Request being formed");
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Caller is: " + this.send.caller.name);
    com.gContactSync.LOGGER.VERBOSE_LOG(" * URL: " + this.mUrl);
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Type: " + this.mType);
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Content-Type: " + this.mContentType);

    if (params.length) {
      com.gContactSync.LOGGER.VERBOSE_LOG(" * Parameters: " + params);
      if (this.mType === "POST") {
        this.mBody = this.mBody ? params + this.mBody : params;
      } else {
        this.mUrl = this.mUrl + "?" + params;
      }
    }
    
    this.mHttpRequest.open(this.mType, this.mUrl, true); // open the request

    // set the header
    this.addHeaderItem("Content-Type", this.mContentType);
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Setting up the header: ");

    for (var i = 0; i < this.mHeaderLabels.length; i++) {
      com.gContactSync.LOGGER.VERBOSE_LOG("   o " + this.mHeaderLabels[i] +
                                          ": " + this.mHeaderValues[i]);
      this.mHttpRequest.setRequestHeader(this.mHeaderLabels[i],
                                         this.mHeaderValues[i]);
    }

    var httpReq   = this.mHttpRequest,
        onSuccess = this.mOnSuccess,
        onOffline = this.mOnOffline,
        onFail    = this.mOnError,
        onCreated = this.mOnCreated,
        on401     = this.mOn401,
        on503     = this.mOn503;

    // Use the requested timeout value.  Timeouts result in readyState = 4, status = 0 and
    // are handled by the offline callback.
    httpReq.timeout = com.gContactSync.Preferences.mSyncPrefs.httpRequestTimeout.value;

    httpReq.onreadystatechange = function httpReq_readyState() {
      var callback = [];
      // if the request is done then check the status
      if (httpReq.readyState === 4) {
        // this may be called after the address book window is closed
        // if the window is closed there will be an exception thrown as
        // explained here - https://www.mozdev.org/bugs/show_bug.cgi?id=20527
        com.gContactSync.LOGGER.VERBOSE_LOG(" * The request has finished with status: " +
                                            httpReq.status + "/" +
                                            (httpReq.status ? httpReq.statusText : "offline"));
        if (httpReq.status) {
          com.gContactSync.LOGGER.VERBOSE_LOG(" * Headers:\n" +
                                              httpReq.getAllResponseHeaders() + "\n");
        }
          
        switch (httpReq.status) { 
        case 0: // the user is offline
          callback = onOffline || onFail;
          break;
        case 201: // 201 CREATED
          callback = onCreated;
          break;
        case 200: // 200 OK
          callback = onSuccess;
          break;
        case 400: // 400 Bad Request (typically invalid_grant)
        case 401: // 401 Unauthorized (Token Expired in Gmail)
        case 403: // 403 Forbidden (typically invalid_grant caused by username/token mismatch)
          callback = on401 || onFail;
          break;
        case 503: // 503 Service unavailble (Server is busy, user exceeded quota, etc.)
          callback = on503 || onFail;
          break;
        default: // other status
          callback = onFail;
        }
        if (callback) {
          com.gContactSync.LOGGER.VERBOSE_LOG(" * Running the function callback");
          callback.call(this, httpReq);
        }
      } // end of readyState
    };
    try {
      this.mHttpRequest.send(this.mBody); // send the request
    } catch (e) {
      com.gContactSync.LOGGER.LOG_ERROR(" * Error sending request", e);
      this.mOnError(this.mHttpRequest);
    }
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Request Sent");
  }
};
