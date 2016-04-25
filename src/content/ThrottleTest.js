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
 * Portions created by the Initial Developer are Copyright (C) 2014-2016
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
 * Runs a test to find the lowest necessary delay between requests to avoid 503 errors.
 * @class
 */
gContactSync.ThrottleTest = {

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
      gContactSync.alertError(gContactSync.StringBundle.getStr("throttleTestAlreadyRunning"));
      return;
    }
    var abs = gContactSync.GAbManager.getSyncedAddressBooks(true);
    if (!abs.length) {
      gContactSync.alertError(gContactSync.StringBundle.getStr("throttleTestNoABFound"));
      return;
    }
    this.mAB = abs[0].ab;
    this.mUsername = abs[0].username;
    this.mToken = gContactSync.LoginManager.getAuthToken(this.mUsername);
    var abCard = this.mAB.getAllContacts()[0];
    this.mURL = abCard.getValue("SelfURL");
    this.mNumReceived = 0;
    this.mNumErrors = 0;
    this.mNum503s = 0;
    this.mDelay = aDelay;
    this.mNumSent = 0;
    this.mTestInProgress = true;
    gContactSync.Preferences.setSyncPref("statusBarText",
                                             gContactSync.StringBundle.getStr("throttleTestTryingDelay") + " " +
                                             gContactSync.ThrottleTest.mDelay + " ms.");
    if (aDelay > 0) {
      setTimeout(gContactSync.ThrottleTest.next, Math.max(10000, gContactSync.ThrottleTest.mDelay));
    } else {
      this.next();
    }
  },

  /**
   * Sends the next request asynchronously.
   */
  next: function ThrottleTest_next() {

    var httpReq = new gContactSync.GHttpRequest("get",
                                                    gContactSync.ThrottleTest.mToken,
                                                    gContactSync.ThrottleTest.mURL,
                                                    null);
    httpReq.addHeaderItem("If-Match", "*");
    httpReq.mOnSuccess = gContactSync.ThrottleTest.onSuccess;
    httpReq.mOnError   = gContactSync.ThrottleTest.onError;
    httpReq.mOnOffline = gContactSync.ThrottleTest.onOffline;
    httpReq.mOn503     = gContactSync.ThrottleTest.on503;
    httpReq.send();
    ++gContactSync.ThrottleTest.mNumSent;
    if (gContactSync.ThrottleTest.mNumSent < gContactSync.ThrottleTest.mIters) {
      setTimeout(gContactSync.ThrottleTest.next, gContactSync.ThrottleTest.mDelay);
    }
  },

  /**
   * Called when an HTTP request finishes successfully.
   * @param {GHttpRequest} The HTTP request.
   */
  onSuccess: function ThrottleTest_onSuccess(httpReq) {
    gContactSync.ThrottleTest.onReceive();
  },

  /**
   * Called when an HTTP request returns an offline status.
   * @param {GHttpRequest} The HTTP request.
   */
  onOffline: function ThrottleTest_onOffline(httpReq) {
    gContactSync.Preferences.setSyncPref("statusBarText",
                                             gContactSync.StringBundle.getStr("offlineStatusText")); 
  },

  /**
   * Called when an HTTP request fails for an error other than a 503.
   * @param {GHttpRequest} The HTTP request.
   */
  onError: function ThrottleTest_onError(httpReq) {
    ++gContactSync.ThrottleTest.mNumErrors;
    gContactSync.LOGGER.LOG_ERROR("Error while updating contact",
                                      httpReq.responseText);
    gContactSync.ThrottleTest.onReceive();
  },

  /**
   * Called when an HTTP request fails for a 503.
   * @param {GHttpRequest} The HTTP request.
   */
  on503: function ThrottleTest_on503(httpReq) {
    ++gContactSync.ThrottleTest.mNum503s;
    gContactSync.LOGGER.LOG_ERROR("503", httpReq.responseText);
    gContactSync.ThrottleTest.onReceive();
  },

  /**
   * Called when an HTTP request finishes.
   * @param {GHttpRequest} The HTTP request.
   */
  onReceive: function ThrottleTest_onReceive() {
    ++gContactSync.ThrottleTest.mNumReceived;
    if (gContactSync.ThrottleTest.mNumReceived >= gContactSync.ThrottleTest.mIters) {
      gContactSync.ThrottleTest.mTestInProgress = false;
      if (gContactSync.ThrottleTest.mNumErrors) {
        gContactSync.alertError(gContactSync.StringBundle.getStr("errorDuringThrottleTest"));
      } else if (gContactSync.ThrottleTest.mNum503s) {
        gContactSync.ThrottleTest.start(gContactSync.ThrottleTest.mDelay + 20);
      } else {
        gContactSync.alert(gContactSync.StringBundle.getStr("throttleTestMessage") + " " + gContactSync.ThrottleTest.mDelay);
        gContactSync.Preferences.setSyncPref("httpRequestDelay", gContactSync.ThrottleTest.mDelay);
        gContactSync.Preferences.setSyncPref("statusBarText",
                                                 gContactSync.StringBundle.getStr("throttleTestComplete"));
      }
    }
  }
};

