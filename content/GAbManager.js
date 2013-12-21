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
 * Portions created by the Initial Developer are Copyright (C) 2008-2011
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

if (!com) var com = {}; // A generic wrapper variable
// A wrapper for all GCS functions and variables
if (!com.gContactSync) com.gContactSync = {};

/**
 * An object that can obtain address books by the name or URI, find the synced
 * address books, and edit contacts.
 * @extends com.gContactSync.AbManager
 * @class
 */
com.gContactSync.GAbManager = com.gContactSync.AbManager;

/** Stores GAddressBook objects keyed by preference ID *AND* URI */
com.gContactSync.GAbManager.mABs = {};

/**
 * Resets all synchronized address books in the following ways:
 *  - Deletes all mailing lists
 *  - Deletes all contacts
 *  - Sets the last sync date to 0.
 * See AddressBook.reset for more details.
 *
 * It asks the user to restart Thunderbird when finished.
 *
 * @param showConfirm {boolean} Show a confirmation dialog first and quit if
 * the user presses Cancel.
 */
com.gContactSync.GAbManager.resetAllSyncedABs =
function GAbManager_resetSyncedABs(showConfirm) {
  if (showConfirm) {
    if (!com.gContactSync.confirm(com.gContactSync.StringBundle.getStr("confirmReset"))) {
      return false;
    }
  }

  com.gContactSync.LOGGER.LOG("Resetting all synchronized directories.");
  var abs = com.gContactSync.GAbManager.getSyncedAddressBooks(true),
      i,
      needRestart = false;;
  for (i in abs) {
    if (abs[i].ab && abs[i].ab.mPrefs.Disabled !== "true") {
      needRestart = abs[i].ab.reset() || needRestart;
    }
  }
  
  com.gContactSync.LOGGER.LOG("Finished resetting all synchronized directories.");
  if (needRestart) {
    com.gContactSync.alert(com.gContactSync.StringBundle.getStr("pleaseRestart"));
  }
  return true;
};
/**
 * Returns an object filled with GAddressBook objects.
 * The properties are the names of those address books.
 * @param aMakeArray {boolean} If this parameter evaluates as true then the
 *                             returned object will be an array.
 * @returns If aMakeArray then the returned object is an array of objects.
 *         Each object has a 'username' property with the username of this
 *         synced AB and an 'ab' property with a GAddressBook object.
 *         If !aMakeArray then the returned object is keyed by username and
 *         the value of that property is an array of GAddressBook objects.
 */
com.gContactSync.GAbManager.getSyncedAddressBooks =
function AbManager_getSyncedAddressBooks(aMakeArray) {
  this.mAddressBooks = {};
  var iter,
      abManager,
      dir,
      data,
      ab,
      username,
      arr = [],
      i,
      j;
  if (Components.classes["@mozilla.org/abmanager;1"]) { // TB 3
    abManager = Components.classes["@mozilla.org/abmanager;1"]
                          .getService(Components.interfaces.nsIAbManager);
    iter = abManager.directories;
  }
  else { // TB 2
    // obtain the main directory through the RDF service
    dir = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                    .getService(Components.interfaces.nsIRDFService)
                    .GetResource("moz-abdirectory://")
                    .QueryInterface(Components.interfaces.nsIAbDirectory);
    iter = dir.childNodes;
  }
  while (iter.hasMoreElements()) {
    data = iter.getNext();
    if (data instanceof Components.interfaces.nsIAbDirectory && (this.mVersion === 3 ||
        data instanceof Components.interfaces.nsIAbMDBDirectory)) {
      ab = this.getGAb(data);
      username = ab.mPrefs.Username;
      if (username && username.toLowerCase() !== "none") {
        if (!this.mAddressBooks[username])
          this.mAddressBooks[username] = [];
        this.mAddressBooks[username].push(ab);
      }
    }
  }
  if (!aMakeArray)
    return this.mAddressBooks;
  // now convert to an array
  arr = [];
  for (i in this.mAddressBooks) {
    for (j in this.mAddressBooks[i]) {
      arr.push({
        username: i,
        ab:       this.mAddressBooks[i][j]
      });
    }
  }
  return arr;
};

/**
 * Backs up the given address book.  This consists of copying the Mork Address
 * Book (MAB) file into the gContactSync directory.
 * The backup is prefixed with the value of aPrefix (if not blank) followed by
 * the original name of the file and ended with the value of aSuffix.
 * NOTE: If a file already exists with the 
 * @param aAb {GAddressBook} The address book to backup.
 * @returns {boolean} True if the AB was successfully backed up
 */
com.gContactSync.GAbManager.backupAB = function GAbManager_backupAB(aAB, aPrefix, aSuffix) {
  var destFile    = com.gContactSync.FileIO.getProfileDirectory(),
      uri         = aAB.mURI,
      srcFileName = uri.substr(1 + uri.lastIndexOf("/")),
      srcFile     = com.gContactSync.FileIO.getProfileDirectory(),
      lines       = [];
  // the source file is profile_dir/{FileNameFromURI}
  srcFile.append(srcFileName);
  // the destination is profile_dir/gcontactsync/{aPrefix}{FileName}{aSuffix}
  destFile.append(com.gContactSync.FileIO.fileNames.FOLDER_NAME);
  destFile.append(com.gContactSync.FileIO.fileNames.AB_BACKUP_DIR);
  destFile.append((aPrefix || "") + srcFileName + (aSuffix || ""));
  com.gContactSync.LOGGER.LOG("Beginning a backup of the Address Book:\n" +
                              srcFile.path + "\nto:\n" + destFile.path);
  // make sure the AB we are copying exists
  if (!srcFile.exists()) {
    com.gContactSync.LOGGER.LOG_ERROR("The source file does not exist");
    return false;
  }
  if (com.gContactSync.FileIO.copyFile(srcFile, destFile)) {
    aAB.savePref("lastBackup", (new Date()).getTime());
    com.gContactSync.LOGGER.LOG(" - Backup finished successfully");
    return true;
  }
  com.gContactSync.LOGGER.LOG(" - Unable to read the source address book");
  return false;
};

/**
 * Returns a GAddressBook object for the given URI.
 * If a GAddressBook for the URI or directory's pref branch has already been
 * returned and is still stored, it is returned and no new object is created.
 */
com.gContactSync.GAbManager.getGAbByURI = function GAbManager_getGAbByURI(aURI) {
  // first check if a GAddressBook object for the URI already exists
  var ab = com.gContactSync.GAbManager.mABs[aURI]
  if (ab) {
    return ab;
  }
  // if it hasn't been obtained yet, get the nsIAbDirectory through its URI
  // then get a GAddressBook object from that and add it to
  // com.gContactSync.GAbManager.mABs
  return com.gContactSync.GAbManager.getGAb(com.gContactSync.GAbManager.getAbByURI(aURI));
};

/**
 * Returns a GAddressBook object for the given nsIAbDirectory.
 * If a GAddressBook for the directory's URI or pref branch has already been
 * returned and is still stored, it is returned and no new object is created.
 */
com.gContactSync.GAbManager.getGAb = function GAbManager_getGAb(aDirectory, aNoPrefs) {
  if (!aDirectory) {
    return aDirectory;
  }
  // first check if a GAddressBook object for the URI already exists
  // if so, return it
  var uri = aDirectory.URI || aDirectory.getDirUri();
  if (uri && com.gContactSync.GAbManager.mABs[uri]) {
    return com.gContactSync.GAbManager.mABs[uri];
  }
  // otherwise create a new GAddressBook object and add it to
  // com.gContactSync.GAbManager.mABs
  var ab  = new com.gContactSync.GAddressBook(aDirectory, aNoPrefs);
  com.gContactSync.GAbManager.mABs[ab.mURI] = ab;
  com.gContactSync.GAbManager.mABs[ab.getPrefId()] = ab;
  return ab;
};

/**
 * Returns an object filled with GAddressBook objects keyed by URI.
 * @param aDirType {int} The type of directory (2 is the usual Mork AB)
 * @returns {object} An object filled with GAddressBook objects keyed by URI.
 */
com.gContactSync.GAbManager.getAllAddressBooks = function GAbManager_getAllAddressBooks(aDirType, aSkipPrefs) {
  var iter,
      abManager,
      dir,
      abs = {},
      data,
      ab,
      dirType;
  if (Components.classes["@mozilla.org/abmanager;1"]) { // TB 3
    abManager = Components.classes["@mozilla.org/abmanager;1"]
                          .getService(Components.interfaces.nsIAbManager);
    iter = abManager.directories;
  }
  else { // TB 2
    // obtain the main directory through the RDF service
    dir = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                    .getService(Components.interfaces.nsIRDFService)
                    .GetResource("moz-abdirectory://")
                    .QueryInterface(Components.interfaces.nsIAbDirectory);
    iter = dir.childNodes;
  }
  while (iter.hasMoreElements()) {
    data = iter.getNext();
    if (data instanceof Components.interfaces.nsIAbDirectory && (this.mVersion === 3 ||
        data instanceof Components.interfaces.nsIAbMDBDirectory)) {

      // If data isn't a valid AB then skip to the next one.
      try {
        ab = this.getGAb(data, aSkipPrefs);
      } catch (e) {
        continue;
      }
      dirType = ab.getDirType();
      // If no dir type was passed or the type matches then add it to abs
      if (this.mVersion < 3 || aDirType === undefined || dirType === aDirType)
        abs[ab.mURI] = ab;
    }
  }
  return abs;
};

/**
 * Compares two contacts and returns true if they are similar in enough
 * attributes to be considered the same.
 *
 * @param aContact0 The first contact.  Can be a TBContact or GContact.
 * @param aContact1 The second contact.  Can be a TBContact or GContact.
 * @param aAttributeList0 The list of attributes in aContact0 to compare.
 * @param aAttributeList1 The list of attributes in aContact1 to compare.
 * @param aThreshold The ratio of (num matching attributes) / (num non-empty attributes)
 *                   at which the two contacts should be considered equal.
 * @returns {boolean} True if aContact0 and aContact1 share enough attributes.
 */
com.gContactSync.GAbManager.compareContacts = function GAbManager_compareContacts(aContact0, aContact1, aAttributeList0, aAttributeList1, aThreshold) {
  var hitCount = 0, valCount = 0;
  com.gContactSync.LOGGER.VERBOSE_LOG("Comparing '" + aContact0.getName() + "' and '" + aContact1.getName() + "'");
  if (aAttributeList0.length != aAttributeList1.length)
    throw "Error - attribute lists don't match in length";

  for (var i = 0; i < aAttributeList0.length; i++) {
    var val0 = aContact0.getValue(aAttributeList0[i]),
        val1 = aContact1.getValue(aAttributeList1[i]);
    if (val0 && aContact0 instanceof com.gContactSync.GContact)
      val0 = val0.value;
    if (val1 && aContact1 instanceof com.gContactSync.GContact)
      val1 = val1.value;
    com.gContactSync.LOGGER.VERBOSE_LOG(" * " + aAttributeList0[i] + ": '" + val0 + "'" +
                                        " "   + aAttributeList1[i] + ": '" + val1 + "'");
    if (val0 && val1) {
      valCount++;
      if (val0 == val1) hitCount++;
    }
  }

  com.gContactSync.LOGGER.VERBOSE_LOG(" * Hit count: " + hitCount +
                                      " Value count: " + valCount +
                                      " threshold (%): " + (aThreshold * 100));

  return valCount && ((hitCount / valCount) >= aThreshold);
};
