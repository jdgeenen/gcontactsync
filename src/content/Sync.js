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
 * Synchronizes a Thunderbird Address Book with Google Contacts.
 * @class
 */
gContactSync.Sync = {
  /** Google contacts that should be deleted */
  mContactsToDelete: [],
  /** New contacts to add to Google */
  mContactsToAdd:    [],
  /** Contacts whose photos need to be written */
  mContactsToUploadPhoto: [],
  /** Contacts whose photos need to be downloaded */
  mContactsToDownloadPhoto: [],
  /** Contacts to update */
  mContactsToUpdate: [],
  /** Groups to delete */
  mGroupsToDelete:   [],
  /** Groups to add */
  mGroupsToAdd:      [],
  /** Groups to update */
  mGroupsToUpdate:   [],
  /** Groups to add (URIs) */
  mGroupsToAddURI:   [],
  /** The current authentication token */
  mCurrentAuthToken: {},
  /** The current username */
  mCurrentUsername:  {},
  /** The current address book being synchronized */
  mCurrentAb:        {},
  /** Synchronized address book */
  mAddressBooks:     [],
  /** The index of the AB being synced */
  mIndex:            0,
  /** The URI of a photo to be added to the newly created Google contact */
  mNewPhotoURI:      {},
  /** Temporarily set to true when a backup is necessary for this account */
  mBackup:           false,
  /** Temporarily set to true when the first backup is necessary */
  mFirstBackup:      false,
  /** Summary data from the current sync */
  mCurrentSummary:   {},
  /** Summary data from the entire synchronization */
  mOverallSummary:   {},
  /** Commands to execute when offline during an HTTP Request */
  mOfflineFunction: function Sync_offlineFunc(httpReq) {
    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr('offlineStatusText')); 
    gContactSync.Sync.finish(gContactSync.StringBundle.getStr('offlineStatusText'), false);
  },
  /** Commands to execute if a 503 is returned during an HTTP Request */
  m503Function: function Sync_503Func(httpReq) {
    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr('err503Short'));
    var str = gContactSync.StringBundle.getStr('err503') + "\n" + httpReq.responseText;
    gContactSync.alertError(str);
    gContactSync.Sync.finish(str, false);
  },
  /** True if a synchronization is scheduled */
  mSyncScheduled: false,
  /** used to store groups for the account being synchronized */
  mGroups:        {},
  /** stores the mail lists in the directory being synchronized */
  mLists:         {},
  /** override for the contact feed URL.  Intended for syncing one group only */
  mContactsUrl:   null,
  /** This should be set to true if the sync was run manually */
  mManualSync:    false,
  /** Stores a snapshot of the error count from synchronization up to, not including, the current AB */
  mPrevErrorCount: 0,
  /** The access token */
  mAccessToken: {},
  /** The access token type */
  mTokenType: {},
  /**
   * Performs the first steps of the sync process.
   * @param aManualSync {boolean} Set this to true if the sync was run manually.
   */
  begin: function Sync_begin(aManualSync, aAddressBooks) {
    // quit if still syncing.
    if (gContactSync.Preferences.mSyncPrefs.synchronizing.value) {
      return;
    }
    
    gContactSync.Sync.mManualSync = (aManualSync === true);
    
    // Reset the overall summary
    gContactSync.Sync.mOverallSummary = new gContactSync.SyncSummaryData();
    gContactSync.Sync.mCurrentSummary = new gContactSync.SyncSummaryData();
    
    gContactSync.Sync.mSyncScheduled  = false;
    gContactSync.Preferences.setSyncPref("synchronizing", true);
    gContactSync.Sync.mBackup         = false;
    gContactSync.LOGGER.mErrorCount   = 0; // reset the error count
    gContactSync.Sync.mPrevErrorCount = 0; // reset the error count
    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("syncing"));
    gContactSync.Sync.mIndex          = 0;
    gContactSync.Sync.mCurrentAb      = {};

    if (aAddressBooks) {
      gContactSync.Sync.mAddressBooks = aAddressBooks;
    } else {
      gContactSync.Sync.mAddressBooks = gContactSync.GAbManager.getSyncedAddressBooks(true);
    }

    // Upgrade checks
    if (gContactSync.Preferences.mSyncPrefs.v04UpgradeNeeded.value ||
        gContactSync.Preferences.mSyncPrefs.v04RCUpgradeNeeded.value) {
      gContactSync.version04Upgrade();
    }

    gContactSync.Overlay.updateVersion();

    if (gContactSync.Sync.mAddressBooks.length === 0) {
      gContactSync.alert(gContactSync.StringBundle.getStr("pleaseAuth"));
      return;
    }

    gContactSync.Sync.syncNextUser();
  },
  /**
   * Synchronizes the next address book in gContactSync.Sync.mAddressBooks.
   * If all ABs were synchronized, then this continues with gContactSync.Sync.finish();
   */
  syncNextUser: function Sync_syncNextUser() {

    // If the sync was successful, set the previous address book's last sync date (if it exists)
    if (gContactSync.Sync.mPrevErrorCount === gContactSync.LOGGER.mErrorCount &&
        gContactSync.Sync.mCurrentAb &&
        gContactSync.Sync.mCurrentAb.setLastSyncDate) {
      gContactSync.Sync.mCurrentAb.setLastSyncDate((new Date()).getTime());
    }
    // Log some summary data if an AB was just synchronized
    if (gContactSync.Sync.mCurrentAb &&
        gContactSync.Sync.mCurrentAb instanceof gContactSync.GAddressBook) {
      gContactSync.Sync.mCurrentSummary.print(false, false);
      gContactSync.Sync.mOverallSummary.addSummary(gContactSync.Sync.mCurrentSummary);
    }

    // Update the current error count snapshot
    gContactSync.Sync.mPrevErrorCount = gContactSync.LOGGER.mErrorCount;

    // Add the current summary to the overall summary then reset the current
    // summary
    gContactSync.Sync.mCurrentSummary = new gContactSync.SyncSummaryData();
    
    var obj = gContactSync.Sync.mAddressBooks[gContactSync.Sync.mIndex++];
    if (!obj) {
      gContactSync.Sync.finish("", false);
      return;
    }
    // make sure the user doesn't have to restart TB
    if (gContactSync.Preferences.mSyncPrefs.needRestart.value) {
      var restartStr = gContactSync.StringBundle.getStr("pleaseRestart");
      gContactSync.alert(restartStr);
      gContactSync.Overlay.setStatusBarText(restartStr);
      return;
    }
    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("syncing"));
    gContactSync.Sync.mCurrentUsername = obj.username;
    gContactSync.LOGGER.LOG("Starting synchronization for " + gContactSync.Sync.mCurrentUsername +
                                " at: " + new Date().getTime() + " (" + Date() + ")\n");
    gContactSync.Sync.mCurrentAb        = obj.ab;
    var refreshToken                        = gContactSync.LoginManager.getAuthTokens()[gContactSync.Sync.mCurrentUsername];
    gContactSync.Sync.mContactsUrl      = null;
    gContactSync.Sync.mBackup           = false;
    gContactSync.LOGGER.VERBOSE_LOG("Found Address Book with name: " +
                                        gContactSync.Sync.mCurrentAb.mDirectory.dirName +
                                        "\n - URI: " + gContactSync.Sync.mCurrentAb.mURI +
                                        "\n - Pref ID: " + gContactSync.Sync.mCurrentAb.getPrefId());
    if (gContactSync.Sync.mCurrentAb.mPrefs.Disabled === "true") {
      gContactSync.LOGGER.LOG("*** NOTE: Synchronization was disabled for this address book ***");
      gContactSync.Sync.mCurrentAb = null;
      gContactSync.Sync.syncNextUser();
      return;
    }
    // If an authentication token cannot be found for this username then
    // offer to let the user login with that account
    if (!refreshToken) {
      gContactSync.LOGGER.LOG_WARNING("Unable to find the auth token for: " +
                                          gContactSync.Sync.mCurrentUsername);
      if (gContactSync.confirm(gContactSync.StringBundle.getStr("noTokenFound") +
                  ": " + gContactSync.Sync.mCurrentUsername +
                  "\n" + gContactSync.StringBundle.getStr("ab") +
                  ": " + gContactSync.Sync.mCurrentAb.getName())) {
        gContactSync.Sync.mIndex--;
        gContactSync.gdata.requestNewRefreshToken(gContactSync.Sync.mCurrentUsername, function newRefreshToken(aResponse) {
          gContactSync.LoginManager.addAuthToken(gContactSync.Sync.mCurrentUsername, aResponse.refresh_token);
          gContactSync.Sync.syncNextUser();
        });
      } else {
        gContactSync.Sync.syncNextUser();
      }
      return;
    }
    var lastBackup = parseInt(obj.ab.mPrefs.lastBackup, 10),
        interval   = gContactSync.Preferences.mSyncPrefs.backupInterval.value * 24 * 3600 * 1000,
        prefix     = "";
    gContactSync.LOGGER.VERBOSE_LOG(" - Last backup was at " + lastBackup +
                                        ", interval is " + interval);
    this.mFirstBackup = !lastBackup && interval >= 0;
    this.mBackup      = this.mFirstBackup || interval >= 0 && new Date().getTime() - lastBackup > interval;
    prefix = this.mFirstBackup ? "init_" : "";
    if (this.mBackup) {
      gContactSync.GAbManager.backupAB(gContactSync.Sync.mCurrentAb,
                                           prefix,
                                           ".bak");
    }
    gContactSync.Sync.getAccessToken(refreshToken);
  },
  /**
   * Exchanges the refresh token for an access token.  On success, continues synchronization.
   *
   * @param aRefreshToken {string} A refresh token.
   */
  getAccessToken: function Sync_getAccessToken(aRefreshToken) {
    gContactSync.LOGGER.VERBOSE_LOG("Requesting access token");
    // Fetch an access token from the refresh token
    var request = new gContactSync.GHttpRequest("REFRESH_REQUEST", aRefreshToken);
    request.mOnSuccess = function getAccessTokenSuccess(aHttpRequest) {
      var response = JSON.parse(aHttpRequest.responseText);
      gContactSync.Sync.mCurrentAuthToken = response.token_type + " " + response.access_token;
      // getGroups must be called if the myContacts pref is set so it can find the
      // proper group URL
      if (gContactSync.Sync.mCurrentAb.mPrefs.syncGroups === "true" ||
          (gContactSync.Sync.mCurrentAb.mPrefs.myContacts !== "false" &&
           gContactSync.Sync.mCurrentAb.mPrefs.myContactsName !== "false")) {
        gContactSync.Sync.getGroups();
      }
      else {
        gContactSync.Sync.getContacts();
      }
    };
    request.mOnError = function getAccessTokenError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR(httpReq.responseText);
      gContactSync.Sync.syncNextUser(httpReq.responseText);
    };
    request.mOnOffline = gContactSync.Sync.mOfflineFunction;
    request.mOn503 = gContactSync.Sync.m503Function;
    request.send();
  },
  /**
   * Sends an HTTP Request to Google for a feed of all of the user's groups.
   * Calls gContactSync.Sync.syncGroups() if successful, or syncNextUser on
   * errors.
   */
  getGroups: function Sync_getGroups() {
    gContactSync.LOGGER.LOG("***Beginning Group - Mail List Synchronization***");
    var httpReq = new gContactSync.GHttpRequest("getGroups",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    null,
                                                    null);
    httpReq.mOnSuccess = function getGroupsSuccess(httpReq) {
      var backup      = gContactSync.Sync.mBackup,
          firstBackup = gContactSync.Sync.mFirstBackup,
          feed        = gContactSync.serializeFromText(httpReq.responseText,
                                                           backup);
      gContactSync.LOGGER.VERBOSE_LOG(feed);
      if (backup) {
        gContactSync.gdata.backupFeed(feed,
                                          gContactSync.Sync.mCurrentUsername + "_groups",
                                          (firstBackup ? "init_" : ""),
                                          ".xml");
      }
      gContactSync.Sync.syncGroups(httpReq.responseXML);
    };
    httpReq.mOnError   = function getGroupsError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR(httpReq.responseText);
      gContactSync.Sync.syncNextUser(httpReq.responseText);
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.mOn503 = gContactSync.Sync.m503Function;
    httpReq.send();
  },
  /**
   * Sends an HTTP Request to Google for a feed of all the user's contacts.
   * Calls gContactSync.Sync.sync with the response if successful or
   * gContactSync.Sync.syncNextUser on errors.
   */
  getContacts: function Sync_getContacts() {
    gContactSync.LOGGER.LOG("***Beginning Contact Synchronization***");
    var httpReq;
    if (gContactSync.Sync.mContactsUrl) {
      httpReq = new gContactSync.GHttpRequest("getFromGroup",
                                                  gContactSync.Sync.mCurrentAuthToken,
                                                  null,
                                                  null,
                                                  gContactSync.Sync.mContactsUrl);
    }
    else {
      httpReq = new gContactSync.GHttpRequest("getAll",
                                                  gContactSync.Sync.mCurrentAuthToken,
                                                  null,
                                                  null);
    }
    httpReq.mOnSuccess = function getContactsSuccess(httpReq) {
      // gContactSync.serializeFromText does not do anything if verbose
      // logging is disabled so the serialization won't waste time
      var backup      = gContactSync.Sync.mBackup,
          firstBackup = gContactSync.Sync.mFirstBackup,
          feed        = gContactSync.serializeFromText(httpReq.responseText,
                                                           backup);
      gContactSync.LOGGER.VERBOSE_LOG(feed);
      if (backup) {
        gContactSync.gdata.backupFeed(feed,
                                          gContactSync.Sync.mCurrentUsername,
                                          (firstBackup ? "init_" : ""),
                                          ".xml");
      }
      gContactSync.Sync.sync2(httpReq.responseXML);
    };
    httpReq.mOnError   = function getContactsError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR('Error while getting all contacts',
                                        httpReq.responseText);
      gContactSync.Sync.syncNextUser(httpReq.responseText);
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.mOn503 = gContactSync.Sync.m503Function;
    httpReq.send();
  },
  /**
   * Completes the synchronization process by writing the finish time to a file,
   * writing the sync details to a different file, scheduling another sync, and
   * writes the completion status to the status bar.
   * 
   * @param aError     {string}   Optional.  A string containing the error message.
   * @param aStartOver {boolean} Also optional.  True if the sync should be restarted.
   */
  finish: function Sync_finish(aError, aStartOver) {
    if (aError)
      gContactSync.LOGGER.LOG_ERROR("Error during sync", aError);
    if (gContactSync.LOGGER.mErrorCount > 0) {
      // if there was an error, display the error message unless the user is
      // offline
      if (gContactSync.Overlay.getStatusBarText() !== aError)
        gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("errDuringSync"));
    }
    else {
      gContactSync.Overlay.writeTimeToStatusBar();
      gContactSync.LOGGER.LOG("Finished Synchronization at: " + Date());
    }
    
    // Print a summary and alert the user if it was a manual sync and
    // alertSummary is set to true.
    gContactSync.Sync.mOverallSummary.print(
        gContactSync.Sync.mManualSync &&
        gContactSync.Preferences.mSyncPrefs.alertSummary.value,
        true);
    
    // reset some variables
    gContactSync.ContactConverter.mCurrentCard = {};
    gContactSync.Preferences.setSyncPref("synchronizing", false);
    gContactSync.Sync.mCurrentAb               = {};
    gContactSync.Sync.mContactsUrl             = null;
    gContactSync.Sync.mCurrentUsername         = {};
    gContactSync.Sync.mCurrentAuthToken        = {};
    // refresh the ab results pane
    // https://www.mozdev.org/bugs/show_bug.cgi?id=19733
    try {
      if (SetAbView !== undefined) {
        SetAbView(GetSelectedDirectory(), false);
      }
      
      // select the first card, if any
      if (gAbView && gAbView.getCardFromRow(0))
        SelectFirstCard();
      }
    catch (e) {}
    // start over, if necessary, or schedule the next synchronization
    if (aStartOver)
      gContactSync.Sync.begin(gContactSync.Sync.mManualSync,
                                  gContactSync.Sync.mAddressBook);
    else
      gContactSync.Sync.schedule(gContactSync.Preferences.mSyncPrefs.refreshInterval.value * 60000);
  },
  /**
   * Does the actual synchronization of contacts and modifies the AB as it goes.
   * Initializes arrays of Google contacts to add, remove, or update.
   * @param aAtom {XML} The ATOM/XML feed of contacts.
   */
  sync2: function Sync_sync2(aAtom) {
    // get the address book
    var ab = gContactSync.Sync.mCurrentAb,
        // get all the contacts from the feed and the cards from the address book
        googleContacts = aAtom.getElementsByTagName('entry'),
        abCards = ab.getAllContacts(),
        // get and log the last sync time (milliseconds since 1970 UTC)
        lastSync = parseInt(ab.mPrefs.lastSync, 10),
        cardsToDelete = [],
        maxContacts = gContactSync.Preferences.mSyncPrefs.maxContacts.value,
        // if there are more contacts than returned, increase the pref
        newMax;
    if (isNaN(lastSync)) {
      gContactSync.LOGGER.VERBOSE_LOG("lastSync was NaN, setting to 0");
      lastSync = 0;
    }
    // mark the AB as not having been reset if it gets this far
    ab.savePref("reset", false);
    
    // have to update the lists or TB 2 won't work properly
    gContactSync.Sync.mLists = ab.getAllLists();
    gContactSync.LOGGER.LOG("Last sync was at: " + lastSync +
                                " (" + new Date(lastSync) + ")");
    if ((newMax = gContactSync.gdata.contacts.getNumberOfContacts(aAtom)) >= maxContacts.value) {
      gContactSync.Preferences.setPref(gContactSync.Preferences.mSyncBranch, maxContacts.label,
                                           maxContacts.type, newMax + 50);
      gContactSync.Sync.finish("Max Contacts too low...resynchronizing", true);
      return;
    }
    gContactSync.Sync.mContactsToAdd = [];
    gContactSync.Sync.mContactsToUploadPhoto = [];
    gContactSync.Sync.mContactsToDownloadPhoto = [];
    gContactSync.Sync.mContactsToDelete = [];
    gContactSync.Sync.mContactsToUpdate = [];
    var gContact,
        gContacts = {},
        gContactInfo = {},
        abCardInfo = [];

    // Get all contacts from Google into GContact objects in an object
    // keyed by ID.
    for (var i = 0, length = googleContacts.length; i < length; i++) {
      gContact               = new gContactSync.GContact(googleContacts[i]);
      gContact.lastModified  = gContact.getLastModifiedDate();
      gContact.id            = gContact.getID(true);
      gContacts[gContact.id] = gContact;
    }
    // re-initialize the contact converter (in case a pref changed)
    gContactSync.ContactConverter.init();

    var gContactId;

    // If the sync settings for this AB specify to skip contacts without e-mail addresses
    // remove all the gContacts and cards without e-mail addresses.
    if (ab.mPrefs.skipContactsWithoutEmail === "true") {
      for (gContactId in gContacts) {
        if (gContacts[gContactId] && !gContacts[gContactId].getEmailAddress()) {
          gContactSync.LOGGER.VERBOSE_LOG("Skipping Google Contact '" + gContacts[gContactId].getName() + "' due to skipContactsWithoutEmail");
          delete gContacts[gContactId];
        }
      }
      for (i = 0; i < abCards.length; ++i) {
        if (!abCards[i].getEmailAddress()) {
          gContactSync.LOGGER.VERBOSE_LOG("Skipping TB Contact '" + abCards[i].getName() + "' due to skipContactsWithoutEmail");
          abCards.splice(i, 1);
          --i;
        }
      }
    }

    // If this is the first sync then iterate through TB contacts
    // If the contact matches a Google contact then set the TB contact's
    // GoogleID to its matching contact and LastModifiedDate to 0.
    // This prevents some duplicates on the first sync by basically overwritting
    // similar TB contacts during the first sync.
    // This is very basic, and won't merge duplicates in Thunderbird or dups
    // in Google; it just matches with the first contact it finds, if any.
    if (lastSync === 0) {
      gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("firstSyncContacts"));
      for (i = 0; i < abCards.length; i++) {

        // If this address book was previously synchronized with gContactSync there's no need to merge.
        // The contacts will conflict and the updateGoogleInConflicts pref will be used to resolve.
        if (!abCards[i] || abCards[i].getValue("GoogleID")) {continue;}

        for (var id in gContacts) {
          if (gContacts[id] &&
              gContactSync.GAbManager.compareContacts(
                abCards[i],
                gContacts[id],
                ["DisplayName", "PrimaryEmail"],
                ["fullName",    "email"],
                0.5)) {
            gContactSync.LOGGER.LOG(abCards[i].getName() + ": " + id);
            gContactSync.LOGGER.LOG(" * Merging");
            // Pass false to update TB during conflicts.  Other add-ons don't synchronize types so allowing Google to be updated
            // would reset types to their default values.
            var updated = gContactSync.ContactConverter.merge(abCards[i], gContacts[id], false);
            if (updated.google) {
              var toUpdate = {};
              toUpdate.gContact = gContacts[id];
              toUpdate.abCard   = abCards[i];
              gContactSync.Sync.mContactsToUpdate.push(toUpdate);
              this.mCurrentSummary.mRemote.mUpdated++;
            }
            if (updated.thunderbird) {
              this.mCurrentSummary.mLocal.mUpdated++;
            }
            delete gContacts[id];
            abCards.splice(i, 1);
            --i;
            break;
          }
        }
      }
    }

    for (gContactId in gContacts) {
      if (gContacts[gContactId]) {
        gContactInfo[gContactId] = {name: gContacts[gContactId].getName(), lastModified: gContacts[gContactId].lastModified};
      }
    }

    for (i = 0, length = abCards.length; i < length; ++i) {
      abCardInfo.push({id: abCards[i].getID(), name: abCards[i].getName(), lastModified: abCards[i].getValue("LastModifiedDate")});
    }

    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("syncing"));

    var worker = new Worker("chrome://gcontactsync/content/SyncWorker.js");
    var workerData = {
      mABCards:                 abCardInfo,
      mGContacts:               gContactInfo,
      mLastSync:                lastSync,
      mReadOnly:                (ab.mPrefs.readOnly === "true") && (lastSync > 0),
      mWriteOnly:               (ab.mPrefs.writeOnly === "true") && (lastSync > 0),
      mUpdateGoogleInConflicts: ab.mPrefs.updateGoogleInConflicts === "true",
      mCurrentSummary:          this.mCurrentSummary,
    };

    // Make this == Sync when receiving messages from the worker
    var self = this;
    worker.onmessage = function(event) {
      self.onworkermessage.call(self, event);
    };

    this.onworkermessage = function syncWorkerOnMessage(event) {
      if (event.data.mType === "log") {
        gContactSync.LOGGER.LOG(event.data.mMessage);
      } else if (event.data.mType === "newTBContact") {
        var newCard = ab.newContact();
        gContactSync.ContactConverter.makeCard(gContacts[event.data.mID], newCard);
        if (newCard.mUpdatePhoto) {
          this.mContactsToDownloadPhoto.push({abCard: newCard, gContact: gContacts[event.data.mID]});
        }
      } else if (event.data.mType === "updateTBCard") {
        var tbContact = abCards[event.data.mTBCardIndex];
        gContactSync.ContactConverter.makeCard(gContacts[tbContact.getID()], tbContact);
        if (tbContact.mUpdatePhoto) {
          this.mContactsToDownloadPhoto.push({abCard: tbContact, gContact: gContacts[tbContact.getID()]});
        }
      } else if (event.data.mType === "done") {

        for (var i in event.data.mCurrentSummary) {
          if (event.data.mCurrentSummary.hasOwnProperty(i)) {this.mCurrentSummary[i] = event.data.mCurrentSummary[i];}
        }
        for (i = 0, length = event.data.mContactsToAdd.length; i < length; ++i) {
          this.mContactsToAdd.push(abCards[event.data.mContactsToAdd[i]]);
        }
        for (i = 0, length = event.data.mContactsToUpdate.length; i < length; ++i) {
          var abCard = abCards[event.data.mContactsToUpdate[i]];
          this.mContactsToUpdate.push({abCard: abCard, gContact: gContacts[abCard.getID()]});
        }
        for (i = 0, length = event.data.mContactsToDelete.length; i < length; ++i) {
          this.mContactsToDelete.push(gContacts[event.data.mContactsToDelete[i]]);
        }
        for (i = 0, length = event.data.mCardsToDelete.length; i < length; ++i) {
          cardsToDelete.push(abCards[event.data.mCardsToDelete[i]]);
        }

        var threshold = gContactSync.Preferences.mSyncPrefs
                                                    .confirmDeleteThreshold.value;
        // Request permission from the user to delete > threshold contacts from a
        // single source
        // If the user clicks Cancel the AB is disabled
        if (threshold > 0 &&
              (cardsToDelete.length >= threshold ||
               gContactSync.Sync.mContactsToDelete.length >= threshold) &&
              !gContactSync.Sync.requestDeletePermission(cardsToDelete.length,
                                                             gContactSync.Sync.mContactsToDelete.length)) {
          // If canceled here then reset most remote counts and local deleted to 0
          this.mCurrentSummary.mLocal.mRemoved  = 0;
          this.mCurrentSummary.mRemote.mAdded   = 0;
          this.mCurrentSummary.mRemote.mRemoved = 0;
          this.mCurrentSummary.mRemote.mUpdated = 0;
          gContactSync.Sync.syncNextUser();
          return;
        }
        // delete the old contacts from Thunderbird
        if (cardsToDelete.length > 0) {
          ab.deleteContacts(cardsToDelete);
        }

        gContactSync.LOGGER.LOG("***Deleting contacts from Google***");
        // delete contacts from Google
        gContactSync.Sync.processDeleteQueue();
      }
    };
    worker.postMessage(workerData);
  },
  /**
   * Shows a confirmation dialog asking the user to give gContactSync permission
   * to delete the specified number of contacts from Google and Thunderbird.
   * If the user clicks Cancel then synchronization with the current address
   * book is disabled.
   * @param {int} The number of contacts about to be deleted from Thunderbird.
   * @param {int} The number of contacts about to be deleted from Google.
   * @returns {boolean} True if the user clicked OK, false if Cancel.
   */
  requestDeletePermission: function Sync_requestDeletePermission(aNumTB, aNumGoogle) {
    var warning = gContactSync.StringBundle.getStr("confirmDelete1") +
                  " '" + gContactSync.Sync.mCurrentAb.getName() + "'" +
                  "\nThunderbird: " + aNumTB +
                  "\nGoogle: "      + aNumGoogle +
                  "\n" + gContactSync.StringBundle.getStr("confirmDelete2");
    gContactSync.LOGGER.LOG("Requesting permission to delete " +
                                "TB: " + aNumTB + ", Google: " + aNumGoogle +
                                " contacts...");

    if (!gContactSync.confirm(warning)) {
      gContactSync.LOGGER.LOG(" * Permission denied, disabling AB");
      gContactSync.Sync.mCurrentAb.savePref("Disabled", true);
      gContactSync.alert(gContactSync.StringBundle.getStr("deleteCancel"));
      return false;
    }

    gContactSync.LOGGER.LOG(" * Permission granted");
    return true;
  },
  /**
   * Calls the given function after the timeout specified in the
   * httpRequestDelay pref.  If the pref is <= 0 then this function calls it
   * immediately.
   * This should help mitigate 503 errors if the pref is set.
   * @param {function} func The function to call.
   */
  delayedProcessQueue: function Sync_delayedProcessQueue(func) {
    if (gContactSync.Preferences.mSyncPrefs.httpRequestDelay.value > 0) {
      setTimeout(func,
                 gContactSync.Preferences.mSyncPrefs.httpRequestDelay.value);
    } else {
      func.call();
    }
  },
  /**
   * Deletes all contacts from Google included in the mContactsToDelete
   * array one at a time to avoid timing conflicts. Calls
   * gContactSync.Sync.processAddQueue() when finished.
   */
  processDeleteQueue: function Sync_processDeleteQueue() {
    var ab = gContactSync.Sync.mCurrentAb;
    if (!gContactSync.Sync.mContactsToDelete ||
        gContactSync.Sync.mContactsToDelete.length === 0) {
      gContactSync.LOGGER.LOG("***Adding contacts to Google***");
      gContactSync.Sync.processAddQueue();
      return;
    }
    // TODO if gContactSync.Sync.mContactsUrl is set should the contact just
    // be removed from that group or completely removed?
    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("deleting") + " " +
                                              gContactSync.Sync.mContactsToDelete.length + " " +
                                              gContactSync.StringBundle.getStr("remaining"));
    var contact = gContactSync.Sync.mContactsToDelete.shift();
    var editURL = contact.getValue("EditURL").value;
    gContactSync.LOGGER.LOG(" * " + contact.getName() + "  -  " + editURL);

    var httpReq = new gContactSync.GHttpRequest("delete",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    editURL,
                                                    null);
    httpReq.addHeaderItem("If-Match", "*");
    httpReq.mOnSuccess = function processDeleteSuccess(httpReq) {
      gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processDeleteQueue);
    };
    httpReq.mOnError   = function processDeleteError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR('Error while deleting contact',
                                        httpReq.responseText);
      gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processDeleteQueue);
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.mOn503 = gContactSync.Sync.m503Function;
    httpReq.send();
  },
  /**
   * Adds all cards to Google included in the mContactsToAdd array one at a 
   * time to avoid timing conflicts.  Calls
   * gContactSync.Sync.processUpdateQueue() when finished.
   */
  processAddQueue: function Sync_processAddQueue() {
    var ab = gContactSync.Sync.mCurrentAb;
    // if all contacts were added then update all necessary contacts
    if (!gContactSync.Sync.mContactsToAdd ||
        gContactSync.Sync.mContactsToAdd.length === 0) {
      gContactSync.LOGGER.LOG("***Updating contacts from Google***");
      gContactSync.Sync.processUpdateQueue();
      return;
    }
    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("adding") + " " +
                                              gContactSync.Sync.mContactsToAdd.length + " " +
                                              gContactSync.StringBundle.getStr("remaining"));
    var cardToAdd = gContactSync.Sync.mContactsToAdd.shift();
    gContactSync.LOGGER.LOG("\n" + cardToAdd.getName());

    // get the XML representation of the card
    // NOTE: cardToAtomXML adds the contact to the current group, if any
    var gcontact = gContactSync.ContactConverter.cardToAtomXML(cardToAdd);
    if (!gcontact) {
      gContactSync.LOGGER.LOG_WARNING("Skipping empty contact");
      return gContactSync.Sync.processAddQueue();
    }

    var string = gContactSync.serialize(gcontact.xml);
    if (gContactSync.Preferences.mSyncPrefs.verboseLog.value)
      gContactSync.LOGGER.LOG(" * XML of contact being added:\n" + string + "\n");
    var httpReq = new gContactSync.GHttpRequest("add",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    null,
                                                    string);
    gContactSync.Sync.mNewPhotoURI = gContactSync.Preferences.mSyncPrefs.sendPhotos.value ?
                                         gcontact.mNewPhotoURI : null;
    /* When the contact is successfully created:
     *  1. Get the card from which the contact was made
     *  2. Get a GContact object for the new contact
     *  3. Set the card's GoogleID attribute to match the new contact's ID
     *  4. Update the card in the address book
     *  5. Set the new contact's photo, if necessary
     *  6. Call this method again
     */
    var onCreated = function contactCreated(httpReq) {
      var ab       = gContactSync.Sync.mCurrentAb,
          contact  = gContactSync.ContactConverter.mCurrentCard,
          gcontact = new gContactSync.GContact(httpReq.responseXML);
      contact.setValue('GoogleID', gcontact.getID(true));
      contact.update();
      // if photos are allowed to be uploaded to Google then queue the request
      if (gContactSync.Preferences.mSyncPrefs.sendPhotos.value &&
          gContactSync.Sync.mNewPhotoURI) {
        gContactSync.Sync.mContactsToUploadPhoto.push({abCard: gContactSync.ContactConverter.mCurrentCard,
                                                          gContact: gcontact,
                                                          uri: gContactSync.Sync.mNewPhotoURI});
      }
      gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processAddQueue);
    };
    httpReq.mOnCreated = onCreated;
    httpReq.mOnError   = function contactCreatedError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR('Error while adding contact',
                                        httpReq.responseText);
      gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processAddQueue);
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.mOn503 = gContactSync.Sync.m503Function;
    httpReq.send();
  },
  /**
   * Updates all cards to Google included in the mContactsToUpdate array one at
   * a time to avoid timing conflicts.
   */
  processUpdateQueue: function Sync_processUpdateQueue() {

    var ab = gContactSync.Sync.mCurrentAb;

    if (!gContactSync.Sync.mContactsToUpdate ||
        (gContactSync.Sync.mContactsToUpdate.length === 0)) {

      gContactSync.LOGGER.LOG("***Uploading contact photos to Google***");
      gContactSync.Sync.processUpdatePhotoQueue();
      return;
    }

    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("updating") + " " +
                                              gContactSync.Sync.mContactsToUpdate.length + " " +
                                              gContactSync.StringBundle.getStr("remaining"));
    var obj      = gContactSync.Sync.mContactsToUpdate.shift();
    var gContact = obj.gContact;
    var abCard   = obj.abCard;

    var editURL = gContact.getValue("EditURL").value;
    gContactSync.LOGGER.LOG("\nUpdating " + gContact.getName());
    gContact = gContactSync.ContactConverter.cardToAtomXML(abCard, gContact);

    if (!gContact) {
      gContactSync.LOGGER.LOG_WARNING("Skipping empty contact");
      return gContactSync.Sync.processUpdateQueue();
    }

    var string = gContactSync.serialize(gContact.xml);
    if (gContactSync.Preferences.mSyncPrefs.verboseLog.value) {
      gContactSync.LOGGER.LOG(" * XML of contact being updated:\n" + string + "\n");
    }
    gContactSync.Sync.mNewPhotoURI = gContactSync.Preferences.mSyncPrefs.sendPhotos.value ?
                                         gContact.mNewPhotoURI : null;
    var httpReq = new gContactSync.GHttpRequest("update",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    editURL,
                                                    string);
    httpReq.addHeaderItem("If-Match", "*");
    httpReq.mOnSuccess = function processUpdateSuccess(httpReq) {

      // if photos are allowed to be uploaded to Google then queue the request
      if (gContactSync.Preferences.mSyncPrefs.sendPhotos.value &&
          gContactSync.Sync.mNewPhotoURI) {

        var gcontact = new gContactSync.GContact(httpReq.responseXML);
        gContactSync.Sync.mContactsToUploadPhoto.push({abCard: gContactSync.ContactConverter.mCurrentCard,
                                                          gContact: gcontact,
                                                          uri: gContactSync.Sync.mNewPhotoURI});
      }
      gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processUpdateQueue);
    };
    httpReq.mOnError   = function processUpdateError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR('Error while updating contact',
                                        httpReq.responseText);
      gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processUpdateQueue);
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.mOn503 = gContactSync.Sync.m503Function;
    httpReq.send();
  },
  /**
   * Uploads new and updated photos to Google.
   * Calls gContactSync.Sync.processDownloadPhotoQueue() when done.
   */
  processUpdatePhotoQueue: function Sync_processUpdatePhotoQueue() {

    var ab = gContactSync.Sync.mCurrentAb;

    if (!gContactSync.Sync.mContactsToUploadPhoto ||
        (gContactSync.Sync.mContactsToUploadPhoto.length === 0)) {

      gContactSync.LOGGER.LOG("***Download contact photos from Google***");
      gContactSync.Sync.processDownloadPhotoQueue();
      return;
    }

    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("uploadingPhotos") + " " +
                                              gContactSync.Sync.mContactsToUploadPhoto.length + " " +
                                              gContactSync.StringBundle.getStr("remaining"));
    var obj = gContactSync.Sync.mContactsToUploadPhoto.shift();
    gContactSync.LOGGER.LOG("\n" + obj.abCard.getName());
    obj.gContact.uploadPhoto(obj.uri);
    gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processUpdatePhotoQueue);
  },
  /**
   * Downloads new photos from Google.
   * Calls gContactSync.Sync.syncNextUser() when done.
   */
  processDownloadPhotoQueue: function Sync_processDownloadPhotoQueue() {

    var ab = gContactSync.Sync.mCurrentAb;

    if (!gContactSync.Sync.mContactsToDownloadPhoto ||
        (gContactSync.Sync.mContactsToDownloadPhoto.length === 0)) {

      if (gContactSync.Sync.mAddressBooks[gContactSync.Sync.mIndex]) {
        var delay = gContactSync.Preferences.mSyncPrefs.accountDelay.value;
        gContactSync.LOGGER.LOG("**About to wait " + delay +
                                    " ms before synchronizing the next account**");
        gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("waiting"));
        setTimeout(gContactSync.Sync.syncNextUser, delay);
      } else {
        gContactSync.Sync.syncNextUser();
      }
      return;
    }

    gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("downloadingPhotos") + " " +
                                              gContactSync.Sync.mContactsToDownloadPhoto.length + " " +
                                              gContactSync.StringBundle.getStr("remaining"));

    var obj = gContactSync.Sync.mContactsToDownloadPhoto.shift();
    gContactSync.LOGGER.LOG("\n" + obj.abCard.getName());
    var file = obj.gContact.writePhoto(gContactSync.Sync.mCurrentAuthToken);

    if (!file) {

      gContactSync.LOGGER.LOG_WARNING("Failed to write contact photo");

    } else {

      gContactSync.LOGGER.VERBOSE_LOG("Wrote photo...name: " + file.leafName);
      gContactSync.copyPhotoToPhotosDir(file);
      obj.abCard.setValue("PhotoName", file.leafName);
      obj.abCard.setValue("PhotoType", "file");
      obj.abCard.setValue("PhotoURI",
                          Components.classes["@mozilla.org/network/io-service;1"]
                                    .getService(Components.interfaces.nsIIOService)
                                    .newFileURI(file)
                                    .spec);
      obj.abCard.update();
    }

    gContactSync.Sync.delayedProcessQueue(gContactSync.Sync.processDownloadPhotoQueue);
  },
  /**
   * Syncs all contact groups with mailing lists.
   * @param aAtom {XML} The ATOM/XML feed of Groups.
   */
  syncGroups: function Sync_syncGroups(aAtom) {
    // reset the groups object
    gContactSync.Sync.mGroups         = {};
    gContactSync.Sync.mLists          = {};
    gContactSync.Sync.mGroupsToAdd    = [];
    gContactSync.Sync.mGroupsToDelete = [];
    gContactSync.Sync.mGroupsToUpdate = [];
    // if there wasn't an error, setup groups
    if (aAtom) {
      var ab         = gContactSync.Sync.mCurrentAb;
      var ns         = gContactSync.gdata.namespaces.ATOM;
      var lastSync   = parseInt(ab.mPrefs.lastSync, 10);
      var myContacts = ab.mPrefs.myContacts == "true" && ab.mPrefs.myContactsName;
      var arr        = aAtom.getElementsByTagNameNS(ns.url, "entry");
      var noCatch    = false;
      if (isNaN(lastSync)) {
        gContactSync.LOGGER.VERBOSE_LOG("lastSync was NaN, setting to 0");
        lastSync = 0;
      }
      // get the mailing lists if not only synchronizing my contacts
      if (!myContacts) {
        gContactSync.LOGGER.VERBOSE_LOG("***Getting all mailing lists***");
        gContactSync.Sync.mLists = ab.getAllLists(true);
        gContactSync.LOGGER.VERBOSE_LOG("***Getting all contact groups***");
        for (var i = 0; i < arr.length; i++) {
          try {
            var group = new gContactSync.Group(arr[i]);
            // add the ID to mGroups by making a new property with the ID as the
            // name and the title as the value for easy lookup for contacts
            var id = group.getID();
            var title = group.getTitle();
            var modifiedDate = group.getLastModifiedDate();
            gContactSync.LOGGER.LOG(" * " + title + " - " + id +
                                        " - last modified: " + modifiedDate);
            var list = gContactSync.Sync.mLists[id];
            // If this is the first sync and a list wasn't found then manually
            // search through each existing list to see if the names match.
            // Ignore lists with IDs as these are already being used.
            if (lastSync == 0 && !list) {
              for (var j in gContactSync.Sync.mLists) {
                var tmpList   = gContactSync.Sync.mLists[j];
                var tmpListID = tmpList.getGroupID();
                gContactSync.LOGGER.VERBOSE_LOG("  - comparing with " + tmpList.getName() +
                                                    " - " + tmpListID);
                if (tmpListID.indexOf("www.google.com/m8/feeds/groups") === -1 &&
                    tmpList.getName() == title) {
                  list = tmpList;
                  list.setGroupID(id);
                  gContactSync.LOGGER.LOG("  - Merged with " + tmpList.getName());
                  break;
                }
              }
            }
            gContactSync.Sync.mGroups[id] = group;
            if (modifiedDate < lastSync && lastSync) { // it's an old group
              if (list) {
                list.matched = true;
                // if the name is different, update the group's title
                var listName = list.getName();
                gContactSync.LOGGER.LOG("  - Matched with mailing list " + listName);
                if (listName != title) {
                  // You cannot rename system groups...so change the name back
                  // In the future system groups will be localized, so this
                  // must be ignored.
                  if (group.isSystemGroup()) {
                    // If write-only is on then ignore the name change
                    if (ab.mPrefs.writeOnly != "true")
                      list.setName(title);
                    gContactSync.LOGGER.LOG_WARNING("  - A system group was renamed in Thunderbird");
                  }
                  else if (ab.mPrefs.readOnly == "true") {
                    gContactSync.LOGGER.LOG(" - The mailing list's name has changed.  " +
                                                "Ignoring since read-only mode is on.");
                  }
                  else {
                    gContactSync.LOGGER.LOG("  - Going to rename the group to " + listName);
                    group.setTitle(listName);
                    gContactSync.Sync.mGroupsToUpdate.push(group);
                  }
                }
              }
              else {
                if (ab.mPrefs.readOnly == "true") {
                  gContactSync.LOGGER.LOG(" - A mailing list was deleted.  " +
                                              "Ignoring since read-only mode is on.");
                }
                else {
                  // System groups cannot be deleted.
                  // This would be difficult to recover from, so stop
                  // synchronization and reset the AB
                  if (group.isSystemGroup()) {
                    noCatch = true; // don't catch this error
                    gContactSync.LOGGER.LOG_ERROR("  - A system group was deleted from Thunderbird");
                    var restartStr = gContactSync.StringBundle.getStr("pleaseRestart");
                    if (gContactSync.confirm(gContactSync.StringBundle.getStr("resetConfirm"))) {
                      ab.reset();
                      gContactSync.Overlay.setStatusBarText(restartStr);
                      gContactSync.alert(restartStr);
                      gContactSync.Preferences.setSyncPref("needRestart", true);
                    }
                    // Throw an error to stop the sync
                    throw "A system group was deleted from Thunderbird";                  
                  }
                  else {
                    gContactSync.Sync.mGroupsToDelete.push(group);
                    gContactSync.LOGGER.LOG("  - Didn't find a matching mail list.  It will be deleted");
                  }
                }
              }
            }
            else { // it is new or updated
              if (list) { // the group has been updated
                gContactSync.LOGGER.LOG("  - Matched with mailing list " + listName);
                // if the name changed, update the mail list's name
                if (list.getName() != title) {
                  if (ab.mPrefs.writeOnly == "true") {
                    gContactSync.LOGGER.VERBOSE_LOG(" - The group was renamed, but write-only mode was enabled");
                  }
                  else {
                    gContactSync.LOGGER.LOG("  - The group's name changed, updating the list");
                    list.setName(title);
                    list.update();
                  }
                }
                list.matched = true;
              }
              else { // the group is new
                if (ab.mPrefs.writeOnly == "true") {
                  gContactSync.LOGGER.VERBOSE_LOG(" - The group is new, but write-only mode was enabled");
                }
                else {
                  // make a new mailing list with the same name
                  gContactSync.LOGGER.LOG("  - The group is new");
                  var list = ab.addList(title, id);
                  gContactSync.LOGGER.VERBOSE_LOG("  - List added to address book");
                }
              }
            }
          }
          catch (e) {
            if (noCatch) throw e;
            gContactSync.LOGGER.LOG_ERROR("Error while syncing groups: " + e);
          }
        }
        gContactSync.LOGGER.LOG("***Looking for unmatched mailing lists***");
        for (var i in gContactSync.Sync.mLists) {
          var list = gContactSync.Sync.mLists[i];
          if (list && !list.matched) {
            // if it is new, make a new group in Google
            if (i.indexOf("http://www.google.com/m8/feeds/groups/") == -1) {
              gContactSync.LOGGER.LOG("-Found new list named " + list.getName());
              gContactSync.LOGGER.VERBOSE_LOG(" * The URI is: " + list.getURI());
              if (ab.mPrefs.readOnly == "true") {
                gContactSync.LOGGER.LOG(" * Ignoring since read-only mode is on");  
              }
              else {
                gContactSync.LOGGER.LOG(" * It will be added to Google");
                gContactSync.Sync.mGroupsToAdd.push(list);
              }
            }
            // if it is old, delete it
            else {
                gContactSync.LOGGER.LOG("-Found an old list named " + list.getName());
                gContactSync.LOGGER.VERBOSE_LOG(" * The URI is: " + list.getURI());
                if (ab.mPrefs.writeOnly == "true") {
                  gContactSync.LOGGER.VERBOSE_LOG(" * Write-only mode was enabled so no action will be taken");
                }
                else {
                  gContactSync.LOGGER.LOG(" * It will be deleted from Thunderbird");
                  list.remove();
                }
            }
          }
        }
      }
      else {
        var groupName = ab.mPrefs.myContactsName.toLowerCase();
        gContactSync.LOGGER.LOG("Only synchronizing the '" +
                                    ab.mPrefs.myContactsName + "' group.");
        var group, id, sysId, title;
        var foundGroup = false;
        for (var i = 0; i < arr.length; i++) {
          try {
            group = new gContactSync.Group(arr[i]);
            // add the ID to mGroups by making a new property with the ID as the
            // name and the title as the value for easy lookup for contacts
            // Note: If someone wants to sync a group with the same name as a
            // system group then this method won't work because system groups
            // are first.
            id    = group.getID();
            sysId = group.getSystemId();
            title = group.getTitle();
            gContactSync.LOGGER.VERBOSE_LOG("  - Found a group named '"
                                                + title + "' with ID '"
                                                + id + "'");
            title = title ? title.toLowerCase() : "";
            sysId = sysId ? sysId.toLowerCase() : "";
            if (sysId == groupName || title == groupName) {
              foundGroup = true;
              break;
            }
          }
          catch (e) {gContactSync.alertError(e);}
        }
        if (foundGroup) {
          gContactSync.LOGGER.LOG(" * Found the group to synchronize: " + id);
          gContactSync.Sync.mContactsUrl = id;
          return gContactSync.Sync.getContacts();
        }
        else {
          var msg = " * Could not find the group '" + groupName + "' to synchronize."
          gContactSync.LOGGER.LOG_ERROR(msg);
          return gContactSync.Sync.syncNextUser();
        }
      }
    }
    gContactSync.LOGGER.LOG("***Deleting old groups from Google***");
    return gContactSync.Sync.deleteGroups();
  },
  /**
   * Deletes all of the groups in mGroupsToDelete one at a time to avoid timing
   * issues.  Calls gContactSync.Sync.addGroups() when finished.
   */
  deleteGroups: function Sync_deleteGroups() {
    var ab = gContactSync.Sync.mCurrentAb;
    if (gContactSync.Sync.mGroupsToDelete.length == 0
        || ab.mPrefs.readOnly == "true") {
      gContactSync.LOGGER.LOG("***Adding new groups to Google***");
      gContactSync.Sync.addGroups();
      return;
    }
    var group = gContactSync.Sync.mGroupsToDelete.shift();
    gContactSync.LOGGER.LOG("-Deleting group: " + group.getTitle());
    var httpReq = new gContactSync.GHttpRequest("delete",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    group.getEditURL(),
                                                    null);
    httpReq.mOnSuccess = gContactSync.Sync.deleteGroups;
    httpReq.mOnError   = function deleteGroupsError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR('Error while deleting group',
                                        httpReq.responseText);
      gContactSync.Sync.deleteGroups();
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.addHeaderItem("If-Match", "*");
    httpReq.send();
  },
  /**
   * The first part of adding a group involves creating the XML representation
   * of the mail list and then calling gContactSync.Sync.addGroups2() upon successful
   * creation of a group.
   */
  addGroups: function Sync_addGroups() {
    var ab = gContactSync.Sync.mCurrentAb;
    if (gContactSync.Sync.mGroupsToAdd.length == 0
        || ab.mPrefs.readOnly == "true") {
      gContactSync.LOGGER.LOG("***Updating groups from Google***");
      gContactSync.Sync.updateGroups();
      return;
    }
    var list = gContactSync.Sync.mGroupsToAdd[0];
    var group = new gContactSync.Group(null, list.getName());
    gContactSync.LOGGER.LOG("-Adding group: " + group.getTitle());
    var body = gContactSync.serialize(group.xml);
    if (gContactSync.Preferences.mSyncPrefs.verboseLog.value)
      gContactSync.LOGGER.VERBOSE_LOG(" * XML feed of new group:\n" + body);
    var httpReq = new gContactSync.GHttpRequest("addGroup",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    null,
                                                    body);
    httpReq.mOnCreated = gContactSync.Sync.addGroups2;
    httpReq.mOnError =   function addGroupError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR('Error while adding group',
                                        httpReq.responseText);
      gContactSync.Sync.mGroupsToAddURI.shift()
      gContactSync.Sync.addGroups();
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.send();
  },
  /**
   * The second part of adding a group involves updating the list from which
   * this group was created so the two can be matched during the next sync.
   * @param aResponse {XMLHttpRequest} The HTTP request.
   */
  addGroups2: function Sync_addGroups2(aResponse) {
    var group = new gContactSync.Group(aResponse.responseXML
                                   .getElementsByTagNameNS(gContactSync.gdata.namespaces.ATOM.url,
                                                           "entry")[0]);
    if (gContactSync.Preferences.mSyncPrefs.verboseLog.value)
      gContactSync.LOGGER.LOG(gContactSync.serializeFromText(aResponse.responseText));
    var list = gContactSync.Sync.mGroupsToAdd.shift();
    var id   = group.getID();
    list.setNickName(id);
    if (list.update)
      list.update();
    gContactSync.Sync.mLists[id] = list;
    gContactSync.Sync.addGroups();
  },
  /**
   * Updates all groups in mGroupsToUpdate one at a time to avoid timing issues
   * and calls gContactSync.Sync.getContacts() when finished.
   */
  updateGroups: function Sync_updateGroups() {
    var ab = gContactSync.Sync.mCurrentAb;
    if (gContactSync.Sync.mGroupsToUpdate.length == 0
        || ab.mPrefs.readOnly == "true") {
      gContactSync.Sync.getContacts();
      return;
    }
    var group = gContactSync.Sync.mGroupsToUpdate.shift();
    gContactSync.LOGGER.LOG("-Updating group: " + group.getTitle());
    var body = gContactSync.serialize(group.xml);
    if (gContactSync.Preferences.mSyncPrefs.verboseLog.value)
      gContactSync.LOGGER.VERBOSE_LOG(" * XML feed of group: " + body);
    var httpReq = new gContactSync.GHttpRequest("update",
                                                    gContactSync.Sync.mCurrentAuthToken,
                                                    group.getEditURL(),
                                                    body);
    httpReq.mOnSuccess = gContactSync.Sync.updateGroups;
    httpReq.mOnError   = function updateGroupError(httpReq) {
      gContactSync.LOGGER.LOG_ERROR("Error while updating group",
                                        httpReq.responseText);
      gContactSync.Sync.updateGroups();
    };
    httpReq.mOnOffline = gContactSync.Sync.mOfflineFunction;
    httpReq.addHeaderItem("If-Match", "*");
    httpReq.send();
  },
  /**
   * Schedules another sync after the given delay if one is not already scheduled,
   * there isn't a sync currently running, if the delay is greater than 0, and
   * finally if the auto sync pref is set to true.
   * @param aDelay {integer} The duration of time to wait before synchronizing
   *                         again.
   */
  schedule: function Sync_schedule(aDelay) {
    // only schedule a sync if the delay is greater than 0, a sync is not
    // already scheduled, and autosyncing is enabled
    if (aDelay > 0 && !gContactSync.Preferences.mSyncPrefs.synchronizing.value &&
        !gContactSync.Sync.mSyncScheduled &&
        gContactSync.Preferences.mSyncPrefs.autoSync.value) {
      gContactSync.Sync.mSyncScheduled = true;
      setTimeout(gContactSync.Sync.begin, aDelay);  
      gContactSync.LOGGER.VERBOSE_LOG("Next sync in: " + aDelay + " milliseconds");
    }
  }
};
