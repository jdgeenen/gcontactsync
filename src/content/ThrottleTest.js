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
 * Portions created by the Initial Developer are Copyright (C) 2014
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

if (!com) {
  /** A generic wrapper variable */
  var com = {};
}

if (!com.gContactSync) {
  /** A wrapper for all GCS functions and variables */
  com.gContactSync = {};
}

/**
 * Runs a test to find the lowest necessary delay between requests to avoid 503 errors.
 * @class
 */
com.gContactSync.ThrottleTest = {

  /** Stores whether a test is in progress. */
  mTestInProgress: false,

  /** The number of iterations for the test. */
  mIters: 100,

  /**
   * Begins a throttle test.
   * @param aDelay {int} The delay to test.
   */
  start: function ThrottleTest_start(aDelay) {
    if (this.mTestInProgress) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("throttleTestAlreadyRunning"));
      return;
    }
    var abs = com.gContactSync.GAbManager.getSyncedAddressBooks(true);
    if (!abs.length) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("throttleTestNoABFound"));
      return;
    }
    this.mAB = abs[0].ab;
    this.mUsername = abs[0].username;
    this.mToken = com.gContactSync.LoginManager.getAuthToken(this.mUsername);
    var abCard = this.mAB.getAllContacts()[0];
    this.mURL = abCard.getValue("SelfURL");
    this.mNumReceived = 0;
    this.mNumErrors = 0;
    this.mNum503s = 0;
    this.mDelay = aDelay;
    this.mNumSent = 0;
    this.mTestInProgress = true;
    com.gContactSync.Preferences.setSyncPref("statusBarText",
                                             com.gContactSync.StringBundle.getStr("throttleTestTryingDelay") + " " +
                                             com.gContactSync.ThrottleTest.mDelay + " ms.");
    if (aDelay > 0) {
      setTimeout(com.gContactSync.ThrottleTest.next, Math.max(10000, com.gContactSync.ThrottleTest.mDelay));
    } else {
      this.next();
    }
  },

  /**
   * Sends the next request asynchronously.
   */
  next: function ThrottleTest_next() {

    var httpReq = new com.gContactSync.GHttpRequest("get",
                                                    com.gContactSync.ThrottleTest.mToken,
                                                    com.gContactSync.ThrottleTest.mURL,
                                                    null,
                                                    com.gContactSync.ThrottleTest.mUsername);
    httpReq.addHeaderItem("If-Match", "*");
    httpReq.mOnSuccess = com.gContactSync.ThrottleTest.onSuccess;
    httpReq.mOnError   = com.gContactSync.ThrottleTest.onError;
    httpReq.mOnOffline = com.gContactSync.ThrottleTest.onOffline;
    httpReq.mOn503     = com.gContactSync.ThrottleTest.on503;
    httpReq.send();
    ++com.gContactSync.ThrottleTest.mNumSent;
    if (com.gContactSync.ThrottleTest.mNumSent < com.gContactSync.ThrottleTest.mIters) {
      setTimeout(com.gContactSync.ThrottleTest.next, com.gContactSync.ThrottleTest.mDelay);
    }
  },

  /**
   * Called when an HTTP request finishes successfully.
   * @param {GHttpRequest} The HTTP request.
   */
  onSuccess: function ThrottleTest_onSuccess(httpReq) {
    com.gContactSync.ThrottleTest.onReceive();
  },

  /**
   * Called when an HTTP request returns an offline status.
   * @param {GHttpRequest} The HTTP request.
   */
  onOffline: function ThrottleTest_onOffline(httpReq) {
    com.gContactSync.Preferences.setSyncPref("statusBarText",
                                             com.gContactSync.StringBundle.getStr("offlineStatusText")); 
  },

  /**
   * Called when an HTTP request fails for an error other than a 503.
   * @param {GHttpRequest} The HTTP request.
   */
  onError: function ThrottleTest_onError(httpReq) {
    ++com.gContactSync.ThrottleTest.mNumErrors;
    com.gContactSync.LOGGER.LOG_ERROR("Error while updating contact",
                                      httpReq.responseText);
    com.gContactSync.ThrottleTest.onReceive();
  },

  /**
   * Called when an HTTP request fails for a 503.
   * @param {GHttpRequest} The HTTP request.
   */
  on503: function ThrottleTest_on503(httpReq) {
    ++com.gContactSync.ThrottleTest.mNum503s;
    com.gContactSync.LOGGER.LOG_ERROR("503", httpReq.responseText);
    com.gContactSync.ThrottleTest.onReceive();
  },

  /**
   * Called when an HTTP request finishes.
   * @param {GHttpRequest} The HTTP request.
   */
  onReceive: function ThrottleTest_onReceive() {
    ++com.gContactSync.ThrottleTest.mNumReceived;
    if (com.gContactSync.ThrottleTest.mNumReceived >= com.gContactSync.ThrottleTest.mIters) {
      com.gContactSync.ThrottleTest.mTestInProgress = false;
      if (com.gContactSync.ThrottleTest.mNumErrors) {
        com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("errorDuringThrottleTest"));
      } else if (com.gContactSync.ThrottleTest.mNum503s) {
        com.gContactSync.ThrottleTest.start(com.gContactSync.ThrottleTest.mDelay + 20);
      } else {
        com.gContactSync.alert(com.gContactSync.StringBundle.getStr("throttleTestMessage") + " " + com.gContactSync.ThrottleTest.mDelay);
        com.gContactSync.Preferences.setSyncPref("httpRequestDelay", com.gContactSync.ThrottleTest.mDelay);
        com.gContactSync.Preferences.setSyncPref("statusBarText",
                                                 com.gContactSync.StringBundle.getStr("throttleTestComplete"));
      }
    }
  }
};

