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

/**
 * A worker for synchronizing contacts.  Calls postMessage to send data back to the main thread.
 *
 * @param this.mData {object} The sync data.
 */
function SyncWorker(aData) {

  this.mResult = {
    mType: "done",
    mCardsToDelete: [],
    mContactsToDelete: [],
    mContactsToUpdate: [],
    mContactsToAdd: [],
    mCurrentSummary: aData.mCurrentSummary
  };

  this.mData = aData;
}

SyncWorker.prototype = {

  /**
   * Runs the SyncWorker and posts the results.
   */
  execute: function SyncWorker_execute() {

    this.loopThroughTBContacts();
    this.findUnmatchedContacts();

    postMessage(this.mResult);
  },

  /**
   * Handles synchronizing a Google and TB contact.
   *
   * @param aTBContact {TBContact} The Thunderbird contact.
   * @param aGContact {GContact} The Google contact.
   * @param aIndex {int} The TB contact index.
   */
  contactMatchFound: function SyncWorker_contactMatchFound(aTBContact, aGContact, aIndex) {

    log(" * Found a match, last modified:" +
        "\n   - Google:      " + aGContact.lastModified +
        " (" + new Date(aGContact.lastModified) + ")" +
        "\n   - Thunderbird: " + (aTBContact.lastModified * 1000) +
        " (" + new Date(aTBContact.lastModified * 1000) + ")");

    // If both contacts have been updated use the readOnly, writeOnly, and updateGoogleInConflicts to determine
    // which one has precedence.
    if ((aGContact.lastModified > this.mData.mLastSync) && (aTBContact.lastModified > (this.mData.mLastSync / 1000))) {

      log(" * Conflict detected: the contact has been updated in both Google and Thunderbird");

      if (this.mData.mReadOnly) {
        log("  - Pulling update into Thunderbird (read-only mode)");
        this.mResult.mCurrentSummary.mLocal.mIgnored++;
        this.mResult.mCurrentSummary.mLocal.mUpdated++;
        postMessage({mType: "updateTBCard", mTBCardIndex: aIndex});
      } else if (this.mData.mWriteOnly) {
        log("  - Pushing update to Google (write-only mode)");
        this.mResult.mCurrentSummary.mRemote.mIgnored++;
        this.mResult.mContactsToUpdate.push(aIndex);
      } else if (this.mData.mUpdateGoogleInConflicts) {
        log("  - Pushing update to Google (update Google in conflicts selected)");
        this.mResult.mCurrentSummary.mConflicted++;
        this.mResult.mCurrentSummary.mRemote.mUpdated++;
        this.mResult.mContactsToUpdate.push(aIndex);
      } else {
        log("  - Pulling update into Thunderbird (update TB in conflicts selected)");
        this.mResult.mCurrentSummary.mConflicted++;
        this.mResult.mCurrentSummary.mLocal.mUpdated++;
        postMessage({mType: "updateTBCard", mTBCardIndex: aIndex});
      }

    } else if (aGContact.lastModified > this.mData.mLastSync) {

      log(" * The Google contact has been updated");

      if (this.mData.mWriteOnly) {
        log("  - Ignoring due to write-only mode");
        this.mResult.mCurrentSummary.mRemote.mIgnored++;
      } else {
        log("  - Pulling update into Thunderbird");
        this.mResult.mCurrentSummary.mLocal.mUpdated++;
        postMessage({mType: "updateTBCard", mTBCardIndex: aIndex});
      }

    } else if (aTBContact.lastModified > (this.mData.mLastSync / 1000)) {

      log(" * The Thunderbird contact has been updated");

      if (this.mData.mReadOnly) {
        log("  - Ignoring due to read-only mode");
        this.mResult.mCurrentSummary.mLocal.mIgnored++;
      } else {
        log("  - Pushing update to Google");
        this.mResult.mCurrentSummary.mRemote.mUpdated++;
        this.mResult.mContactsToUpdate.push(aIndex);
      }

    } else {

      log(" * Neither contact has changed");
      this.mResult.mCurrentSummary.mNotChanged++;
    }
  },

  /**
   * Loops through each TB contact and handles it appropriately.
   * New contacts are pushed to Google (if read-only mode is off).
   * Contacts with a matching Google contact are updated if the LMD is 
   * Remaining contacts are deleted if write-only mode isn't set.
   */
  loopThroughTBContacts: function SyncWorker_loopThroughTBContacts() {

    // Iterate through TB Contacts and check for matches
    for (var i = 0, length = this.mData.mABCards.length; i < length; i++) {

      var tbContact  = this.mData.mABCards[i];
      log(tbContact.name + ": " + tbContact.id);

      // no ID = new contact
      if (!tbContact.id) {

        if (this.mData.mReadOnly) {
          log(" * The contact is new. Ignoring since read-only mode is on.");
          this.mResult.mCurrentSummary.mLocal.mIgnored++;
        } else {
          log(" * This contact is new and will be added to Google.");
          this.mResult.mCurrentSummary.mRemote.mAdded++;
          this.mResult.mContactsToAdd.push(i);
        }

      } else if (this.mData.mGContacts[tbContact.id]) {

        // There is a matching Google Contact
        this.contactMatchFound(tbContact, this.mData.mGContacts[tbContact.id], i);
        delete this.mData.mGContacts[tbContact.id];

      } else if (!this.mData.mWriteOnly) {

        // Otherwise, delete the contact from the address book if writeOnly isn't set.
        log(" * Contact deleted from Google, deleting local copy");
        this.mResult.mCurrentSummary.mLocal.mRemoved++;
        this.mResult.mCardsToDelete.push(i);

      } else {

        this.mResult.mCurrentSummary.mRemote.mIgnored++;
        log(" * Contact deleted from Google, ignoring since write-only mode is enabled");
      }
    }
  },

  /**
   * Searches for Google contacts that have no matching TB contact and deletes, adds, or ignores them.
   */
  findUnmatchedContacts: function SyncWorker_findUnmatchedContacts() {

    log("**Looking for unmatched Google contacts**");

    for (var id in this.mData.mGContacts) {

      var gContact = this.mData.mGContacts[id];
      
      // If writeOnly is on, then set the last modified date to 1 so TB grabs
      // all the contacts from Google during the first sync.
      var gCardDate = this.mData.mWriteOnly ? 1 : gContact.lastModified;
      log(gContact.name + " - " + gCardDate + "\n" + id);

      if (gCardDate > this.mData.mLastSync || isNaN(this.mData.mLastSync)) {

        log(" * The contact is new and will be added to Thunderbird");
        postMessage({mType: "newTBContact", mID: id});
        this.mResult.mCurrentSummary.mLocal.mAdded++;

      } else if (this.mData.mReadOnly) {

        log (" * The contact was deleted in Thunderbird.  " +
             "Ignoring since read-only mode is on.");
        this.mResult.mCurrentSummary.mLocal.mIgnored++;

      } else {

        log(" * The contact is old and will be deleted");
        this.mResult.mCurrentSummary.mLocal.mRemoved++;
        this.mResult.contactsToDelete.push(id);
      }
    }
  }
};

/**
 * Logs the given message.
 *
 * @param aMessage {string} The message.
 */
function log(aMessage) {
  postMessage({
    mType:    "log",
    mMessage: aMessage
  });
}

/**
 * Called on messages sent to this worker.  Calls SyncWorker if the event contains data.
 * 
 * @param event {event} The event.
 */
onmessage = function(event) {
  if (event.data) {
    var syncWorker = new SyncWorker(event.data);
    syncWorker.execute();
    close();
  }
};

