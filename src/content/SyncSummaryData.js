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

/**
 * Stores synchronization summary data.
 * 
 * @class
 */
gContactSync.SyncSummaryData = function gCS_SyncSummaryData() {
  
  this.mLocal = {
    mAdded:      0,
    mRemoved:    0,
    mUpdated:    0,
    mConflicted: 0,
    mIgnored:    0
  };
  this.mRemote = {
    mAdded:      0,
    mRemoved:    0,
    mUpdated:    0,
    mIgnored:    0
  };
  this.mNotChanged = 0;
  this.mConflicted = 0;
}

/**
 * Adds another SyncSummaryData's counts to this one's.
 *
 * @param aSummaryData {SyncSummaryData} The SyncSummaryData to add.
 */
gContactSync.SyncSummaryData.prototype.addSummary = function SyncSummaryData_addSummary(aSummaryData) {

  // Local data
  this.mLocal.mAdded       += aSummaryData.mLocal.mAdded;
  this.mLocal.mRemoved     += aSummaryData.mLocal.mRemoved;
  this.mLocal.mUpdated     += aSummaryData.mLocal.mUpdated;
  this.mLocal.mConflicted  += aSummaryData.mLocal.mConflicted;
  this.mLocal.mIgnored     += aSummaryData.mLocal.mIgnored;

  // Remote data
  this.mRemote.mAdded      += aSummaryData.mRemote.mAdded;
  this.mRemote.mRemoved    += aSummaryData.mRemote.mRemoved;
  this.mRemote.mUpdated    += aSummaryData.mRemote.mUpdated;
  this.mRemote.mConflicted += aSummaryData.mRemote.mConflicted;
  this.mRemote.mIgnored    += aSummaryData.mRemote.mIgnored;

  // Both
  this.mNotChanged += aSummaryData.mNotChanged;
  this.mConflicted += aSummaryData.mConflicted;
}

/**
 * Prints summary data to the log and optionally shows an alert dialog.
 *
 * @param aAlert {boolean}   Set this to true to show the summary in an alert
 *                           dialog.
 * @param aOverall {boolean} Set this to true to show the overall summary
 *                           instead of a summary for the current AB.
 */
gContactSync.SyncSummaryData.prototype.print = function SyncSummaryData_print(aAlert, aOverall) {
  var getStr = function specialGetStr(aName) {
    return gContactSync.StringBundle.getStr(aName).replace(/%/g, " ");
  }
  var msg = "*****";
  if (aOverall || !gContactSync.Sync.mCurrentAb) {
    msg += getStr('countOverallSummary');
  } else {
    msg +=
      getStr('countSummaryFor') + " '" +
        gContactSync.Sync.mCurrentAb.getName() +
        "'";
  }
  msg +=  "*****" +
    "\n - " + getStr('countNotChanged') +
      this.mNotChanged +
    "\n - " + getStr('countConflicted') +
      this.mConflicted +
      "\t" + getStr('countConflictedDesc') +
    // Local summary
    "\n" + getStr('countLocalChanges') +
    "\n - " + getStr('countAdded') +
      this.mLocal.mAdded +
    "\n - " + getStr('countUpdated') +
      this.mLocal.mUpdated +
    "\n - " + getStr('countRemoved') +
      this.mLocal.mRemoved +
    "\n - " + getStr('countIgnored') +
      this.mLocal.mIgnored +
      "\t" + getStr('countReadOnlyMode') +
    // Remote summary
    "\n" + getStr('countRemoteChanges') +
    "\n - " + getStr('countAdded') +
      this.mRemote.mAdded +
    "\n - " + getStr('countUpdated') +
      this.mRemote.mUpdated +
    "\n - " + getStr('countRemoved') +
      this.mRemote.mRemoved +
    "\n - " + getStr('countIgnored') +
      this.mRemote.mIgnored +
      "\t" + getStr('countWriteOnlyMode') +
    "\n*****" + getStr('countEndSummary') + "*****";
  gContactSync.LOGGER.LOG("\n" + msg + "\n");
  if (aAlert) {
    // Alert dialogs aren't monospaced so replace all whitespace with a single
    // space
    gContactSync.alert(msg.replace(/[ ]{2,}/g, " "));
  }
}
