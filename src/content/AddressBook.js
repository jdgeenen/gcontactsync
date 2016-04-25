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
 * A class for a Thunderbird Address Book with methods to add, modify, obtain, 
 * and delete cards.
 * @param aDirectory {nsIAbDirectory} The actual directory.
 * @constructor
 * @class
 */
gContactSync.AddressBook = function gCS_AddressBook(aDirectory) {
  this.mDirectory = aDirectory;
  // make sure the directory is valid
  if (!this.isDirectoryValid(this.mDirectory))
    throw "Invalid directory supplied to the AddressBook constructor" +
          "\nCalled by: " + this.caller +
          gContactSync.StringBundle.getStr("pleaseReport");
  // get the directory's URI
  if (this.mDirectory.URI)
    this.mURI = this.mDirectory.URI;
  else {
    this.mDirectory.QueryInterface(Components.interfaces.nsIAbMDBDirectory);
    this.mURI = this.mDirectory.getDirUri();
  }
};

gContactSync.AddressBook.prototype = {
  /** The Uniform Resource Identifier (URI) of the directory */
  mURI:         {},
  /** The cards within this address book */
  mContacts:       [],
  /** set to true when mContacts should be updated */
  mContactsUpdate: false,
  /**
   * Adds the contact to this address book and returns the added contact.
   * @param aContact {TBContact} The contact to add.
   * @returns {TBContact} The newly-added contact.
   */
  addContact: function AddressBook_addContact(aContact) {
    if (!(aContact instanceof gContactSync.TBContact)) {
      throw "Invalid aContact sent to AddressBook.addContact";
    }
    try {
      var newContact = new gContactSync.TBContact(this.mDirectory.addCard(aContact.mContact),
                                                      this);
      this.mContacts.push(newContact);
      return newContact;
    }
    catch (e) {
      gContactSync.LOGGER.LOG_ERROR("Unable to add card to the directory with URI: " +
                       this.mURI, e);
    }
    return null;
  },
  /**
   * Returns an array of all of the cards in this Address Book.
   * @returns {array} An array of the TBContacts in this Address Book.
   */
  getAllContacts: function AddressBook_getAllContacts() {
    this.mContacts = [];
    var iter = this.mDirectory.childCards,
        data;
    if (iter instanceof Components.interfaces.nsISimpleEnumerator) { // Thunderbird 3
      while (iter.hasMoreElements()) {
        data = iter.getNext();
        if (data instanceof Components.interfaces.nsIAbCard && !data.isMailList)
          this.mContacts.push(new gContactSync.TBContact(data, this));
      }
    }
    else if (iter instanceof Components.interfaces.nsIEnumerator) { // TB 2
      // use nsIEnumerator...
      try {
        iter.first();
        do {
          data = iter.currentItem();
          if (data instanceof Components.interfaces.nsIAbCard &&
              !data.isMailList)
            this.mContacts.push(new gContactSync.TBContact(data, this));
          iter.next();
        } while (Components.lastResult === 0);
      // An error is expected when finished
      }
      catch (e) {
        gContactSync.LOGGER.VERBOSE_LOG("(This error is expected): " + e);
      }
    }
    else {
      gContactSync.LOGGER.LOG_ERROR("Could not iterate through an address book's contacts");
      throw "Couldn't find an address book's contacts";
    }
    return this.mContacts;
  },
  /**
   * Returns an an object containing MailList objects whose attribute name is
   * the name of the mail list.
   * @param skipGetCards {boolean} True to skip getting the cards of each list.
   * @returns An object containing MailList objects.
   */
  getAllLists: function AddressBook_getAllLists(skipGetCards) {
    // same in Thunderbird 2 and 3
    gContactSync.LOGGER.VERBOSE_LOG("Searching for mailing lists:");
    var iter = this.mDirectory.childNodes,
        obj = {},
        list,
        id,
        data;
    while (iter.hasMoreElements()) {
      data = iter.getNext();
      if (data instanceof Components.interfaces.nsIAbDirectory && data.isMailList) {
        list    = this.newListObj(data, this, skipGetCards);
        obj.push(list);
        gContactSync.LOGGER.VERBOSE_LOG(" * " + list.getName() + " - " + id);
      }
    }
    return obj;
  },
  /**
   * Finds and returns the first Mail List that matches the given nickname in
   * this address book.
   * @param aNickName {string} The nickname to search for.  If null then this
   *                           function returns nothing.
   * @returns {MailList} A new MailList object containing a list that matches the
   *                    nickname or nothing if the list wasn't found.
   */
  getListByNickName: function AddressBook_getListByNickName(aNickName) {
    if (!aNickName)
      return null;
    // same in Thunderbird 2 and 3
    var iter = this.mDirectory.childNodes,
        data;
    while (iter.hasMoreElements()) {
      data = iter.getNext();
      if (data instanceof Components.interfaces.nsIAbDirectory && data.isMailList &&
          data.listNickName === aNickName) {
        return this.newListObj(data, this, true);
      }
    }
    return null;
  },
  /**
   * Creates a new mail list, adds it to the address book, and returns a
   * MailList object containing the list.
   * @param aName     {string} The new name for the mail list.
   * @param aNickName {string} The nickname for the mail list.
   * @returns {MailList} A new MailList object containing the newly-made List
   *                    with the given name and nickname.
   */
  addList: function AddressBook_addList(aName, aNickName) {
    if (!aName)
      throw "Error - aName sent to addList is invalid";
    if (!aNickName)
      throw "Error - aNickName sent to addList is invalid";
    var list          = Components.classes["@mozilla.org/addressbook/directoryproperty;1"]
                                  .createInstance(Components.interfaces.nsIAbDirectory),
        realList;
    list.isMailList   = true;
    list.dirName      = aName;
    list.listNickName = aNickName;
    this.mDirectory.addMailList(list);
    // list can't be QI'd to an MDBDirectory, so the new list has to be found...
    realList  = this.getListByNickName(aNickName);
    return realList;
  },
  /**
   * Deletes the nsIAbCards from the nsIAbDirectory Address Book.  If the cards
   * aren't in the book nothing will happen.
   * @param aContacts {array} The cards to delete from the directory
   */
  deleteContacts: function AddressBook_deleteContacts(aContacts) {
    if (!(aContacts && aContacts.length > 0))
      return;
    var arr,
        i = 0;
    if (gContactSync.AbManager.mVersion === 3) { // TB 3
      arr = Components.classes["@mozilla.org/array;1"]
                      .createInstance(Components.interfaces.nsIMutableArray);
      for (; i < aContacts.length; i++) {
        if (aContacts[i] instanceof gContactSync.TBContact) {
          arr.appendElement(aContacts[i].mContact, false);
        }
        else {
          gContactSync.LOGGER.LOG_WARNING("Found an invalid contact sent " +
                                              "AddressBook.deleteContacts");
        }
      }
    }
    else { // TB 2
      arr =  Components.classes["@mozilla.org/supports-array;1"]
                       .createInstance(Components.interfaces.nsISupportsArray);
      for (; i < aContacts.length; i++) {
        if (aContacts[i] instanceof gContactSync.TBContact) {
          arr.AppendElement(aContacts[i].mContact, false);
        }
        else {
          gContactSync.LOGGER.LOG_WARNING("Found an invalid contact sent " +
                                              "AddressBook.deleteContacts");
        }
      }
    }
    try {
      if (arr) { // make sure arr isn't null (mailnews bug 448165)
        this.mContactsUpdate = true; // update mContacts when used
        this.mDirectory.deleteCards(arr);
      }
    }
    catch (e) {
      gContactSync.LOGGER.LOG_WARNING("Error while deleting cards from an AB", e);
    }
  },
  /**
   * Updates a card (commits changes) in this address book.
   * @param aContact {TBContact} The card to update.
   */
  updateContact: function AddressBook_updateContact(aContact) {
    if (!(aContact instanceof gContactSync.TBContact)) {
      throw "Invalid aContact sent to AddressBook.updateContact";
    }
    this.mContactsUpdate = true;
    if (this.mDirectory && this.mDirectory.modifyCard)
      this.mDirectory.modifyCard(aContact.mContact);
    else if (aContact.mContact.editCardToDatabase)
      aContact.mContact.editCardToDatabase(this.mURI);
  },
  /**
   * Checks the validity of a mailing list and throws an error if it is invalid.
   * @param aList        {nsIAbDirectory} An object that should be a mailing list.
   * @param aMethodName  {string} The name of the method calling checkList (used
   *                              when throwing the error)
   */
  checkList: function AddressBook_checkList(aList, aMethodName) {
    // if it is a MailList object, get it's actual list
    var list = aList && aList.mList ? aList.mList : aList;
    if (!list || !(list instanceof Components.interfaces.nsIAbDirectory) || !list.isMailList) {
      throw "Invalid list: " + aList + " sent to the '" + aMethodName +
            "' method" +  gContactSync.StringBundle.getStr("pleaseReport");
    }
  },
  /**
   * Checks the validity of a directory and throws an error if it is invalid.
   * @param aDirectory  {nsIAbDirectory} The directory to check.
   * @param aMethodName {strong} The name of the method calling checkDirectory
   *                             (used when throwing the error)
   */
  checkDirectory: function AddressBook_checkDirectory(aDirectory, aMethodName) {
    if (!this.isDirectoryValid(aDirectory))
      throw "Invalid Directory: " + aDirectory + " sent to the '" +
            aMethodName + "' method" +
            gContactSync.StringBundle.getStr("pleaseReport");
  },
  /**
   * Checks the validity of a directory and returns false if it is invalid.
   * @param aDirectory {nsIAbDirectory} The directory to check.
   */
  isDirectoryValid: function AddressBook_isDirectoryValid(aDirectory) {
    return aDirectory && aDirectory instanceof Components.interfaces.nsIAbDirectory &&
           aDirectory.dirName !== "" &&
          (gContactSync.AbManager.mVersion === 3 || 
           aDirectory instanceof Components.interfaces.nsIAbMDBDirectory);
  },
  /**
   * Creates and returns a new TBContact in this address book.
   * NOTE: The contact is already added to this address book.
   * @returns {TBContact} A new TBContact in this address book.
   */
  newContact: function AddressBook_newContact() {
    return this.addContact(new gContactSync
                                  .TBContact(Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                                                       .createInstance(Components.interfaces.nsIAbCard),
                                             this));
  },
  /**
   * Returns true if the directory passed in is the same as the directory
   * stored by this AddressBook object.  Two directories are considered the same
   * if and only if their Uniform Resource Identifiers (URIs) are the same.
   * @param aOtherDir The directory to compare with this object's directory.
   * @returns {boolean} True if the URI of the passed directory is the same as
   *                   the URI of the directory stored by this object.
   */
  equals: function AddressBook_equals(aOtherDir) {
    // return false if the directory isn't valid
    if (!this.isDirectoryValid(aOtherDir))
      return false;
    // compare the URIs
    if (this.mDirectory.URI)
      return this.mDirectory.URI === aOtherDir.URI;
    return this.mDirectory.getDirUri() === aOtherDir.getDirUri();
  },
  /**
   * Returns the card in this directory, if any, with the same (not-null)
   * value for the GoogleID attribute, or, if the GoogleID is null, if the
   *         display name, primary, and second emails are the same.
   * @param aContact {TBContact} The card being searched for.
   * @returns {TBContact} The card in this AB, if any, with the same, and
   *                     non-null value for its GoogleID attribute, or, if the
   *                     GoogleID is null, if the display name, primary, and
   *                     second emails are the same.
   */
  hasContact: function AddressBook_hasContact(aContact) {
    if (!(aContact instanceof gContactSync.TBContact)) {
      throw "Invalid aContact sent to AddressBook.hasContact";
    }
    // get all of the cards in this list again, if necessary
    if (this.mContactsUpdate || this.mContacts.length === 0) {
      this.getAllContacts();
    }
    for (var i = 0, length = this.mContacts.length; i < length; i++) {
      var contact    = this.mContacts[i],
          aContactID = aContact.getID();
      // if it is an old card (has id) compare IDs
      if (aContactID) {
        if (aContactID === contact.getID()) {
          return contact;
        }
      }
      // else check that display name, primary and second email are equal
      else if (aContact.getValue("DisplayName")  === contact.getValue("DisplayName") &&
               aContact.getValue("PrimaryEmail") === contact.getValue("PrimaryEmail") &&
               aContact.getValue("SecondEmail")  === contact.getValue("SecondEmail")) {
        return contact;
      }
    }
    return null;
  },
  /**
   * Sets the preference id for this mailing list.  The update method must be
   * called in order for the change to become permanent.
   * @param aPrefId {string} The new preference ID for this mailing list.
   */
  setPrefId: function AddressBook_setPrefId(aPrefId) {
    this.mDirectory.dirPrefId = aPrefId;
  },
  /**
   * Returns the preference ID of this directory prefixed with
   * "extensions.gContactSync."
   * @returns {string} The preference ID of this directory.
   */
  getPrefId: function AddressBook_getPrefId() {
    return "extensions.gContactSync." + this.mDirectory.dirPrefId + ".";
  },
  /**
   * Gets and returns the string preference, if possible, with the given name.
   * Returns null if this list doesn't have a preference ID or if there was an
   * error getting the preference.
   * @param aName         {string} The name of the preference to get.
   * @param aDefaultValue {string} The value to set the preference at if it
   *                               fails.  Only used in Thunderbird 3.
   * @returns {string} The value of the preference with the given name in the
   *                  preference branch specified by the preference ID, if
   *                  possible.  Otherwise null.
   */
  getStringPref: function AddressBook_getStringPref(aName, aDefaultValue) {
    var id = this.getPrefId();
    if (!id)
      return null;
    try {
      var branch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService)
                             .getBranch(id)
                             .QueryInterface(Components.interfaces.nsIPrefBranch2);
      var value = branch.getCharPref(aName);
      //gContactSync.LOGGER.VERBOSE_LOG("-Found the value: " + value);
      return value;
    }
    // keep going if the preference doesn't exist for backward-compatibility
    catch (e) {}
    // now if a value was not found, use the old branch ID
    // this is for backwards compatibility with 0.3.0a1pre2/0.2.11 and below,
    try {
      id = this.mDirectory.dirPrefId;
      branch = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefService)
                         .getBranch(id)
                         .QueryInterface(Components.interfaces.nsIPrefBranch2);
      value = branch.getCharPref(aName);
      // if the value exists (if it gets here, a value exists):
      //  1) Create the pref using the new branch/method
      //  2) Delete the old pref
      this.setStringPref(aName, value);
      branch.clearUserPref(aName);
      gContactSync.LOGGER.VERBOSE_LOG("Found and removed an obsolete pref: " +
                                          aName + " - " + value);
      return value;
    }
    // an error is expected if the value isn't present
    catch (e) {
      return 0;
    }
    return null;
  },
  /**
   * Sets the string preference, if possible, with the given name and value.
   * @param aName  {string} The name of the preference to set.
   * @param aValue {string} The value to which the preference is set.
   */
  setStringPref: function AddressBook_setStringPref(aName, aValue) {
    var id = this.getPrefId();
    gContactSync.LOGGER.VERBOSE_LOG("Setting pref named: " + aName + " to value: " + aValue +
                       " to the branch: " + id);
    if (!id) {
      gContactSync.LOGGER.VERBOSE_LOG("Invalid ID");
      return;
    }
    if (!aName) {
      gContactSync.LOGGER.VERBOSE_LOG("Invalid name");
      return;
    }
    try {
      var branch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService)
                             .getBranch(id)
                             .QueryInterface(Components.interfaces.nsIPrefBranch2);
      branch.setCharPref(aName, aValue);
    } catch (e) { gContactSync.LOGGER.LOG_WARNING("Error while setting directory pref", e); }
  },

  /**
   * Returns the name of this address book.
   * @returns {string} The name of this address book.
   */
  getName: function AddressBook_getName() {
    return this.mDirectory.dirName;
  },
  /**
   * Sets the name of this address book.  Throws an error if the name is set to
   * either the PAB or CAB's name.
   * @param aName {string} The new name for this directory.
   */
  setName: function AddressBook_setName(aName) {
    // make sure it isn't being set to the PAB or CAB name and make sure that
    // this isn't the PAB or CAB
    var pab = gContactSync.AbManager.getAbByURI("moz-abmdbdirectory://abook.mab");
    var cab = gContactSync.AbManager.getAbByURI("moz-abmdbdirectory://history.mab");
    if (aName === pab.dirName || aName === cab.dirName)
      throw "Error - cannot rename a directory to the PAB or CAB's name";
    if (this.getName() === pab.dirName || this.getName() === cab.dirName)
      throw "Error - cannot rename the PAB or CAB";
    // in TB 3, it is as simple as changing a property of the directory
    if (gContactSync.AbManager.mVersion === 3)
      this.mDirectory.dirName = aName;
    // in TB 2 a few extra steps are necessary...
    else {
      /* NOTE: this code is originally from
      * mailnews/addrbook/resources/content/addressbook.js:
      * http://mxr.mozilla.org/mozilla1.8/source/mailnews/addrbook/resources/content/addressbook.js#353
      */
      var addressbook = Components.classes["@mozilla.org/addressbook;1"]
                                  .createInstance(Components.interfaces.nsIAddressBook);
      // the rdf service
      var RDF = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                          .getService(Components.interfaces.nsIRDFService);
      // get the datasource for the addressdirectory
      var datasource = RDF.GetDataSource("rdf:addressdirectory");

      // moz-abdirectory:// is the RDF root to get all types of addressbooks.
      var parent = RDF.GetResource("moz-abdirectory://")
                      .QueryInterface(Components.interfaces.nsIAbDirectory);
      // Copy existing dir type category id and mod time so they won't get reset.
      var properties = this.mDirectory.directoryProperties;
      properties.description = aName;
      // Now do the modification.
      addressbook.modifyAddressBook(datasource, parent, this.mDirectory, properties);
    }
  },
  /**
   * Returns the directory type of this address book.
   * See mailnews/addrbook/src/nsDirPrefs.h
   * @returns {integer} The directory type of this address book.
   *                    2 means a normal Mork AB
   *                    -1 means the dir type could not be found.
   */
  getDirType: function AddressBook_getDirType() {
    if ("dirType" in this.mDirectory) {
      return this.mDirectory.dirType;
    }
    else if ("directoryProperties" in this.mDirectory) {
      return this.mDirectory.directoryProperties.dirType;
    }
    LOGGER.LOG_WARNING("Unable to find a dirType for the AB '" +
                       this.getName() + "'");
    return -1;
  },
  /**
   * Creates a new mailing list in this directory and returns a MailList object
   * representing the new list.
   * @returns {MailList} A new MailList object.
   */
  newListObj: function AddressBook_newListObj(aList, aParentDirectory, aNew) {
    return new gContactSync.MailList(aList, aParentDirectory, aNew);
  },
  /**
   * Permanently deletes this address book without a confirmation dialog.
   * This will not allow deleting the PAB or CAB and will show a popup
   * if there is an attempt to delete one of those ABs.
   * @returns {boolean} True if the AB was deleted.
   */
  deleteAB: function AddressBook_delete() {
    return gContactSync.AbManager.deleteAB(this.mURI);
  }
};
