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
 * Portions created by the Initial Developer are Copyright (C) 2008-2015
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
* An extension of AddressBook that adds functionality specific to gContactSync.
* @param aDirectory {nsIAbDirectory} The actual directory.
* @param aNoPrefs   {boolean}        Set this to true to skip fetching the
*                                    preferences.
* @constructor
* @class
* @extends com.gContactSync.AddressBook
*/
com.gContactSync.GAddressBook = function gCS_GAddressBook(aDirectory, aNoPrefs) {
  // call the AddressBook constructor using this object
  com.gContactSync.AddressBook.call(this, aDirectory);

  // Preferences for this address book
  // If these aren't set the global preference with the same name, if any, is used
  // NOTE: All these preferences are converted to strings
  this.mPrefs = {
    Plugin:         "", // The name of the plugin to use
    Username:       "", // The username of the acct synced with
    Disabled:       "", // Temporarily disable synchronization with this AB
    // NOTE: These three prefs aren't combined into a single pref for backwards
    // compatibility with 0.2.x
    myContacts:     "", // true if only one group should be synced
    myContactsName: "", // The name of the group to sync
    syncGroups:     "", // Synchronize groups
    // NOTE: These two prefs aren't combined into a single pref for backwards
    // compatibility with 0.2.x
    readOnly:       "", // Fetch updates from Google but don't send any changes
    writeOnly:      "", // Send changes to the server, but don't fetch any changes
    updateGoogleInConflicts: "", // If a contact was updated in Google and TB then
                                 // this pref determines which contact to update
    lastSync:       "", // The last time this AB was synchronized
    lastBackup:     "", // The last time this AB was backed up
    reset:          "", // Whether this AB has been reset since the last sync
    skipContactsWithoutEmail: ""  // Whether this AB has been reset since the last sync
  };
  if (!aNoPrefs) {
    this.getPrefs();
  }
};

// Copy the AB prototype (methods and member variables)
com.gContactSync.GAddressBook.prototype = com.gContactSync.AddressBook.prototype;

// A prefix for all preferences used to prevent conflicts with other extensions
com.gContactSync.GAddressBook.prototype.prefPrefix = "gContactSync";

/**
 * Fetches all of this directory's preferences.  If the directory does not have
 * any given preferences this function will use the global preference's value,
 * if any.
 */
com.gContactSync.GAddressBook.prototype.getPrefs = function GAddressBook_getPrefs() {
  com.gContactSync.LOGGER.LOG("\nGetting Prefs for AB '" + this.getName() + "':");
  for (var i in this.mPrefs) {
    var isLastSync = (i === "lastSync");
    // all prefs except lastSync have the prefPrefix in from of them
    var val = this.getStringPref(isLastSync ? i : this.prefPrefix + i);
    // getStringPref returns 0 iff the pref doesn't exist
    // if the pref doesn't exist, then use the global gContactSync pref
    // AND set this AB's pref so this doesn't fall through next time
    // this behavior is mostly for forward compatibility
    if (val === 0) {
      com.gContactSync.LOGGER.VERBOSE_LOG("getPrefs fell through on " + i);
      var pref = com.gContactSync.Preferences.mSyncPrefs[i];
      val = pref ? String(pref.value) : "";
      if (!val && (i === "skipContactsWithoutEmail")) {val = "false";}
      this.savePref(i, val);
    } else if (isLastSync && isNaN(val)) {
      val = 0;
    }
    com.gContactSync.LOGGER.LOG(" * " + i + " = " + val);
    this.mPrefs[i] = val;
  }
};

/**
 * Save the value of a given preference for this address book.
 *
 * @param aName  {string} The name of the preference to set.
 * @param aValue {string} The value to set the preference to.
 */
com.gContactSync.GAddressBook.prototype.savePref = function GAddressBook_savePref(aName, aValue) {
  com.gContactSync.LOGGER.VERBOSE_LOG(" * Setting pref '" + aName + "' to value '" + aValue + "'");
  // all prefs except lastSync have the prefPrefix in from of them
  this.setStringPref((aName === "lastSync" ? aName : this.prefPrefix + aName), aValue);
  // in theory (and in testing) the preferences listener should already take
  // care of setting the preference in this.mPrefs...
  this.mPrefs[aName] = aValue;
};
 
/**
 * Sets the last time this address book was synchronized, in milliseconds
 * since the epoch.
 * @param aLastSync {integer} The last sync time.
 */
com.gContactSync.GAddressBook.prototype.setLastSyncDate = function GAddressBook_setLastSyncDate(aLastSync) {
  this.setStringPref("lastSync", aLastSync);
  // in theory (and in testing) the preferences listener should already take
  // care of setting the preference in this.mPrefs...
  this.mPrefs.lastSync = aLastSync;
};
 
/**
 * 'Resets' this address book making it appear to be brand new and never
 * synchronized.
 * The username is NOT erased.
 * 
 * This includes:
 *   - Creating a backup
 *   - Deleting all mailing lists
 *   - Deleting all contacts
 *   - Setting primary to true
 *   - Setting the last sync date to 0
 * @returns {boolean} True if the AB was reset, false otherwise.
 */
com.gContactSync.GAddressBook.prototype.reset = function GAddressBook_reset() {
  com.gContactSync.LOGGER.LOG("Resetting the " + this.getName() + " directory.");
  var lists, i, dt;
  if (this.mPrefs.reset === "true") {
    com.gContactSync.LOGGER.LOG_WARNING("An attempt was made to reset an AB which was already reset.  Ignoring request.");
    return false;
  }
  dt = new Date().toLocaleFormat("%Y_%m_%d_");
  com.gContactSync.GAbManager.backupAB(this, "reset_" + dt, ".bak");
  try {
    lists = this.getAllLists(true);
  }
  catch (e) {
    com.gContactSync.LOGGER.LOG_ERROR("Unable to get all lists", e);
    lists = {};
  }
  com.gContactSync.LOGGER.VERBOSE_LOG(" * Deleting all lists");
  for (i in lists) {
    if (lists[i] instanceof com.gContactSync.GMailList) {
      com.gContactSync.LOGGER.VERBOSE_LOG("  - Deleting list " + lists[i].getName());
      lists[i].remove();
    }
  }
  com.gContactSync.LOGGER.VERBOSE_LOG(" * Finished deleting lists");
  com.gContactSync.LOGGER.VERBOSE_LOG(" * Deleting all contacts");
  this.deleteContacts(this.getAllContacts());
  com.gContactSync.LOGGER.VERBOSE_LOG(" * Setting Last Sync Date to 0");
  this.setLastSyncDate(0);
  com.gContactSync.LOGGER.LOG("Finished resetting the directory.");
  // mark the AB as having been reset
  this.savePref("reset", true);
  return true;
};

/**
 * Updates the LastModifiedDate of every contact in this address book so
 * it gets updated during the next sync.
 */
com.gContactSync.GAddressBook.prototype.replaceToServer = function GAddressBook_replaceToServer() {
  var contacts = this.getAllContacts(),
      time     = (new Date()).getTime();
  
  // Set the LastModifiedDate to right now so each contact will get sent to
  // Google during the next sync.  Also update the card in the AB.
  for (var i = 0; i < contacts.length; i++) {
    contacts[i].setValue("LastModifiedDate", time, true);
  }
};

/**
 * Returns a new GMailList object given the same parameters as the GMailList
 * constructor.
 *
 * See the GMailList constructor for the most recent comments.
 *
 * @param aList {Ci.nsIAbDirectory}       The actual nsIAbDirectory
 *                                        representation of a mailing list.
 * @param aParentDirectory {GAddressBook} The parent directory (as an
 *                                        AddressBook object) containing this
 *                                        mailing list.
 * @param aNew             {boolean}      Set as true for new mailing lists where
 *                                        no attempt should be made to fetch the
 *                                        contacts contained in the list.
 * @returns {GMailList} A new GMailList.
 */
com.gContactSync.GAddressBook.prototype.newListObj = function GAddressBook_newListObj(aList, aParentDirectory, aNew) {
  return new com.gContactSync.GMailList(aList, aParentDirectory, aNew);
};

/**
 * Returns an an object containing GMailList objects whose attribute name is
 * the name of the mail list.
 * @param skipGetCards {boolean} True to skip getting the cards of each list.
 * @returns {object} An object containing GMailList objects.
 */
com.gContactSync.GAddressBook.prototype.getAllLists = function GAddressBook_getAllLists(skipGetCards) {
  // same in Thunderbird 2 and 3
  com.gContactSync.LOGGER.VERBOSE_LOG("Searching for mailing lists:");
  var iter = this.mDirectory.childNodes,
      obj  = {},
      list,
      id,
      data;
  while (iter.hasMoreElements()) {
    data = iter.getNext();
    if (data instanceof Components.interfaces.nsIAbDirectory && data.isMailList) {
      list    = this.newListObj(data, this, skipGetCards);
      id      = list.getGroupID();
      obj[id] = list;
      com.gContactSync.LOGGER.VERBOSE_LOG(" * " + list.getName() + " - " + id);
    }
  }
  return obj;
};
