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

/**
 * A worker for synchronizing contacts.  Calls postMessage to send data back to the main thread.
 *
 * @param aData {object} The sync data.
 */
function SyncWorker(aData) {

  var found       = " * Found a match, last modified:",
      bothChanged = " * Conflict detected: the contact has been updated in " +
                    "both Google and Thunderbird",
      bothGoogle  = "  - The Google contact will be updated",
      bothTB      = "  - The Thunderbird contact will be updated";

  var cardsToDelete = [],
      contactsToDelete = [],
      contactsToUpdate = [],
      contactsToAdd = [];

  // Iterate through TB Contacts and check for matches
  for (var i = 0, length = aData.mABCards.length; i < length; i++) {
    var tbContact  = aData.mABCards[i];
    log(tbContact.name + ": " + tbContact.id);
    // no ID = new contact
    if (!tbContact.id) {
      if (aData.mReadOnly) {
        log(" * The contact is new. Ignoring since read-only mode is on.");
        aData.mCurrentSummary.mLocal.mIgnored++;
      }
      else {
        log(" * This contact is new and will be added to Google.");
        aData.mCurrentSummary.mRemote.mAdded++;
        contactsToAdd.push(i);
      }
    }
    // if there is a matching Google Contact
    else if (aData.mGContacts[tbContact.id]) {
      gContact = aData.mGContacts[tbContact.id];
      // remove it from aData.mGContacts
      aData.mGContacts[tbContact.id]  = null;
      gCardDate = aData.mReadOnly ? 0 : gContact.lastModified; // TODO - should this be a 1?
      // 4 options
      // if both were updated
      log(found +
          "\n   - Google:      " + gCardDate +
          " (" + new Date(gCardDate) + ")" +
          "\n   - Thunderbird: " + (tbContact.lastModified * 1000) +
          " (" + new Date(tbContact.lastModified * 1000) + ")");
      // If there is a conflict, looks at the updateGoogleInConflicts
      // preference and updates Google if it's true, or Thunderbird if false
      if (gCardDate > aData.mLastSync && tbContact.lastModified > aData.mLastSync / 1000) {
        log(bothChanged);
        aData.mCurrentSummary.mConflicted++;
        if (aData.mWriteOnly || aData.mUpdateGoogleInConflicts) {
          log(bothGoogle);
          aData.mCurrentSummary.mRemote.mUpdated++;
          contactsToUpdate.push(i);
        }
        // update Thunderbird if writeOnly is off and updateGoogle is off
        else {
          log(bothTB);
          aData.mCurrentSummary.mLocal.mUpdated++;
          postMessage({mType: "updateTBCard", mTBCardIndex: i});
        }
      }
      // if the contact from Google is newer update the TB card
      else if (gCardDate > aData.mLastSync) {
        log(" * The contact from Google is newer...Updating the contact from Thunderbird");
        aData.mCurrentSummary.mLocal.mUpdated++;
        postMessage({mType: "updateTBCard", mTBCardIndex: i});
      }
      // if the TB card is newer update Google
      else if (tbContact.lastModified > aData.mLastSync / 1000) {
        log(" * The contact from Thunderbird is newer...Updating the contact from Google");
        aData.mCurrentSummary.mRemote.mUpdated++;
        contactsToUpdate.push(i);
      }
      // otherwise nothing needs to be done
      else {
        log(" * Neither contact has changed");
        aData.mCurrentSummary.mNotChanged++;
      }
    }
    // if there isn't a match, but the card is new, add it to Google
    else if (tbContact.lastModified > aData.mLastSync / 1000 ||
             isNaN(aData.mLastSync)) {
      log(" * Contact is new, adding to Google.");
      aData.mCurrentSummary.mRemote.mAdded++;
      contactsToAdd.push(i);
    }
    // Otherwise, delete the contact from the address book if writeOnly
    // mode isn't on
    else if (!aData.mWriteOnly) {
      log(" * Contact deleted from Google, deleting local copy");
      aData.mCurrentSummary.mLocal.mRemoved++;
      cardsToDelete.push(i);
    } else {
      aData.mCurrentSummary.mRemote.mIgnored++;
      log(" * Contact deleted from Google, ignoring since write-only mode is enabled");
    }
  }

  // Check for old Google contacts to delete and new contacts to add to TB
  log("**Looking for unmatched Google contacts**");
  for (var id in aData.mGContacts) {
    var gContact = aData.mGContacts[id];
    if (gContact) {
    
      // If writeOnly is on, then set the last modified date to 1 so TB grabs
      // all the contacts from Google during the first sync.
      var gCardDate = aData.mWriteOnly ? 1 : gContact.lastModified;
      log(gContact.name + " - " + gCardDate + "\n" + id);
      if (gCardDate > aData.mLastSync || isNaN(aData.mLastSync)) {
        log(" * The contact is new and will be added to Thunderbird");
        postMessage({mType: "newTBContact", mID: id});
        aData.mCurrentSummary.mLocal.mAdded++;
      }
      else if (!aData.mReadOnly) {
        log(" * The contact is old and will be deleted");
        aData.mCurrentSummary.mLocal.mRemoved++;
        contactsToDelete.push(id);
      }
      else {
        log (" * The contact was deleted in Thunderbird.  " +
             "Ignoring since read-only mode is on.");
        aData.mCurrentSummary.mLocal.mIgnored++;
      }
    }
  }

  postMessage({mType:             "done",
               mCurrentSummary:   aData.mCurrentSummary,
               mContactsToAdd:    contactsToAdd,
               mContactsToDelete: contactsToDelete,
               mContactsToUpdate: contactsToUpdate,
               mCardsToDelete:    cardsToDelete});
}

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
    SyncWorker(event.data);
  }
};

