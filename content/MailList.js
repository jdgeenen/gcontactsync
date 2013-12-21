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
 * Portions created by the Initial Developer are Copyright (C) 2008-2009, 2011
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
 * MailList is an abstraction of a mailing list that facilitates getting the
 * cards contained within the actual list as well as accessing and modifying the
 * list and its properties.
 *
 * @param aList {Components.interfaces.nsIAbDirectory}      The actual nsIAbDirectory
 *                                       representation of a mailing list.
 * @param aParentDirectory {AddressBook} The parent directory (as an
 *                                       AddressBook object) containing this
 *                                       mailing list.
 * @param aNew             {boolean}     Set as true for new mailing lists where
 *                                       no attempt should be made to fetch the
 *                                       contacts contained in the list.
 * @constructor
 * @class
 */
com.gContactSync.MailList = function gCS_MailList(aList, aParentDirectory, aNew) {
  if (!aParentDirectory ||
    !(aParentDirectory instanceof com.gContactSync.AddressBook ||
        aParentDirectory instanceof com.gContactSync.GAddressBook))
    throw "Error - invalid address book supplied to the MailList Constructor";
  this.mParent = aParentDirectory;
  this.mParent.checkList(aList, "MailList constructor");
  this.mList   = aList;
  this.mList.QueryInterface(Components.interfaces.nsIAbMDBDirectory);
  this.mNew    = aNew;
  this.mIgnoreIfBroken = false;
  if (!aNew)
    this.getAllContacts();
};

com.gContactSync.MailList.prototype = {
  /** The contacts in this mailing list (cached) */
  mContacts:       [],
  /** This is true whenever the contacts have to be fetched again */
  mContactsUpdate: false,
  /**
   * Sets the name of this list. The update method must be called in order for
   * the change to become permanent.
   * @param aName {string} The new name for the list.
   */
  setName: function MailList_setName(aName) {
    this.mList.dirName = aName;
  },
  /**
   * Returns the name of this list.
   * @returns {string} The name of this list.
   */
  getName: function MailList_getName() {
    return this.mList.dirName;
  },
  /**
   * Returns the card in this mail list, if any, with the same (not-null)
   * value for the GoogleID attribute, or, if the GoogleID is null, if the
   *         display name, primary, and second emails are the same.
   * @param aContact {TBContact} The contact being searched for.
   * @param aAttrs   {Array} The attributes whose values must be identical in
   *                         order for the contact to match.  The defaults are
   *                         DisplayName, PrimaryEmail, and SecondEmail.
   *                         This is only used if the contact doesn't have a
   *                         GoogleID
   * @returns {boolean} Whether the given contact is in this list.
   */
  hasContact: function MailList_hasContact(aContact, aAttrs) {
    if (!(aContact instanceof com.gContactSync.TBContact)) {
      throw "Invalid aContact sent to MailList.hasContact";
    }
    // get all of the cards in this list again, if necessary
    if (this.mContactsUpdate || this.mContacts.length === 0) {
      this.getAllContacts();
    }
    // the attributes to check
    var aContactID = aContact.getID(),
        attrs      = aAttrs ? aAttrs : ["DisplayName", "PrimaryEmail", "SecondEmail"];
    for (var i = 0, length = this.mContacts.length; i < length; i++) {
      var contact = this.mContacts[i];
      // if it is an old card (has id) compare IDs
      if (aContactID) {
        if (aContactID === contact.getID()) return true;
      }
      // else check that display name, primary and second email are equal
      else {
        var match = true;
        for (var j = 0; j < attrs.length; j++) {
          var aContactVal = aContact.getValue(attrs[j]),
              contactVal  = contact.getValue(attrs[j]);
          // if a value is non-empty and the two are not equal then return false
          if ((aContactVal || contactVal) && aContactVal !== contactVal) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
    }
    return false;
  },
  /**
   * Sets the nick name for this mailing list.  The update method must be
   * called in order for the change to become permanent.
   * @param aNickName {string} The new nick name for this mailing list.
   */
  setNickName: function MailList_setNickName(aNickName) {
    this.mList.listNickName = aNickName;
  },
  /**
   * Returns the nick name of this mailing list.
   * @returns {string} The nick name of this mailing list.
   */
  getNickName: function MailList_getNickName() {
    return this.mList.listNickName;
  },
  /**
   * Sets the description for this mailing list.  The update method must be
   * called in order for the change to become permanent.
   * @param aDescription {string} The new description for this mailing list.
   */
  setDescription: function MailList_setDescription(aDescription) {
    this.mList.description = aDescription;
  },
  /**
   * Returns the description of this mailing list.
   * @returns {string} The description of this mailing list.
   */
  getDescription: function MailList_getDescription() {
    return this.mList.description;
  },
  /**
   * Adds a contact to this mailing list without checking if it already exists.
   * NOTE: If the contact does not have a primary e-mail address then this
   * method will add a fake one.
   * @param aContact {TBContact} The contact to add to this mailing list.
   * @returns {TBContact}  The contact.
   */
  addContact: function MailList_addContact(aContact) {
    if (!(aContact instanceof com.gContactSync.TBContact)) {
      throw "Invalid aContact sent to AddressBook.addContact";
    }
    // Add a dummy e-mail address if necessary and ignore the preference
    // If this was not done then the mailing list would break.
    if (!(aContact.getValue("PrimaryEmail"))) {
      aContact.setValue("PrimaryEmail", com.gContactSync.makeDummyEmail(aContact, true));
      aContact.update(); // TODO is this necessary
    }
    try {
      var realContact = new com.gContactSync.TBContact(this.mList.addCard(aContact.mContact),
                                                       this);
      this.mContacts.push(realContact);
      return realContact;
    }
    catch (e) {
      com.gContactSync.LOGGER.LOG_ERROR("Unable to add card to the mail list with URI: " +
                       this.getURI(), e);
    }
    return null;
  },
  /**
   * Returns the uniform resource identifier (URI) for this mailing list.
   * @returns {string} The URI of this list.
   */
  getURI: function MailList_getURI() {
    if (this.mList.URI)
      return this.mList.URI;
    return this.mList.getDirUri();
  },
  /**
   * Returns an array of all of the cards in this mailing list.
   * @returns {array} An array containing all of the cards in this mailing list.
   */
  getAllContacts: function MailList_getAllContacts() {
    // NOTE: Sometimes hasMoreElements fails if mail lists aren't working
    this.mContacts = [];
    var iter = this.mList.childCards,
        data;
    if (iter instanceof Components.interfaces.nsISimpleEnumerator) { // Thunderbird 3
      try {
        while (iter.hasMoreElements()) {
          data = iter.getNext();
          if (data instanceof Components.interfaces.nsIAbCard)
            this.mContacts.push(new com.gContactSync.TBContact(data, this));
        }
      }
      catch (e) {
      
        // If enumeration fails and the error shouldn't be ignored then offer
        // to reset this AB for the user.
        if (!this.mIgnoreIfBroken) {
          com.gContactSync.LOGGER.LOG_ERROR("A mailing list is not working:", e);
          if (com.gContactSync.confirm(com.gContactSync.StringBundle.getStr("resetConfirm"))) {
            if (this.mParent.reset()) {
              com.gContactSync.alert(com.gContactSync.StringBundle.getStr("pleaseRestart"));
            }
          }
          // Throw an error to stop the sync
          throw com.gContactSync.StringBundle.getStr("mailListBroken");
          
        // If ignoring this broken mailing list (such as when enumerating
        // through a list immediately after adding a contact to it) then quit.
        // This is a VERBOSE_LOG instead of LOG_WARNING or ERROR to avoid
        // unnecessary e-mail/forum posts.
        } else {
          com.gContactSync.LOGGER.VERBOSE_LOG("A mailing list is not working:", e);
          return this.mContacts;
        }
      }
    }
    else if (iter instanceof Components.interfaces.nsIEnumerator) { // TB 2
      // use nsIEnumerator...
      try {
        iter.first();
        do {
          data = iter.currentItem();
          if (data instanceof Components.interfaces.nsIAbCard)
            this.mContacts.push(new com.gContactSync.TBContact(data, this));
          iter.next();
        } while (Components.lastResult === 0);
      }
      catch (ex) {
        // TODO find a way to distinguish between the usual errors and the
        // broken list errors
        // error is expected when finished
        com.gContactSync.LOGGER.VERBOSE_LOG("This error is (sometimes) expected:\n" + ex);
      }
    }
    else {
      com.gContactSync.LOGGER.LOG_ERROR("Could not iterate through an address book's contacts");
      throw com.gContactSync.StringBundle.getStr("mailListBroken");
    }
    return this.mContacts;
  },
  /**
   * Deletes all of the cards in the array of cards from this list.
   * @param aContacts {array} The array of TBContacts to delete from this mailing list.
   */
  deleteContacts: function MailList_deleteContacts(aContacts) {
    if (!(aContacts && aContacts.length > 0))
      return;
    var arr,
        i = 0;
    if (com.gContactSync.AbManager.mVersion === 3) { // TB 3
      arr = Components.classes["@mozilla.org/array;1"]
                      .createInstance(Components.interfaces.nsIMutableArray);
      for (; i < aContacts.length; i++) {
        if (aContacts[i] instanceof com.gContactSync.TBContact) {
          arr.appendElement(aContacts[i].mContact, false);
        }
        else {
          com.gContactSync.LOGGER.LOG_WARNING("Found an invalid contact sent " +
                                              "MailList.deleteContacts");
        }
      }
    }
    else { // TB 2
      arr =  Components.classes["@mozilla.org/supports-array;1"]
                       .createInstance(Components.interfaces.nsISupportsArray);
      for (; i < aContacts.length; i++) {
        if (aContacts[i] instanceof com.gContactSync.TBContact) {
          arr.AppendElement(aContacts[i].mContact, false);
        }
        else {
          com.gContactSync.LOGGER.LOG_WARNING("Found an invalid contact sent " +
                                              "MailList.deleteContacts");
        }
      }
    }
    try {
      if (arr) { // make sure arr isn't null (mailnews bug 448165)
        this.mContactsUpdate = true; // update mContacts when used
        this.mList.deleteCards(arr);
      }
    }
    catch (e) {
      com.gContactSync.LOGGER.LOG_WARNING("Error while deleting cards from a mailing list", e);
    }
    this.mContacts = this.getAllContacts();
  },
  /**
   * Deletes this mailing list from its parent address book.
   */
  remove: function MailList_delete() {
    this.mParent.mDirectory.deleteDirectory(this.mList);
    this.mContacts = [];
    // make sure the functions don't do anything
    for (var i in this) {
      if (i instanceof Function)
        i = function () {};
    }
  },
  /**
   * Updates this mail list (commits changes like renaming or changing the
   * nickname)
   */
  update: function MailList_update() {
    try {
      if (com.gContactSync.AbManager.mVersion === 3)
        this.mList.editMailListToDatabase(null);
      else
        this.mList.editMailListToDatabase(this.getURI(), null);
    }
    catch (e) {
      com.gContactSync.LOGGER.LOG_WARNING("Unable to update mail list", e);
    }
  },
  /**
   * Tells this mailing list whether it should avoid asking the user to confirm
   * a reset if broken.
   * @param aIgnore {boolean} Set this to true to avoid notifying the user of
   *                          a problem if this list is broken.
   */
  setIgnoreIfBroken: function MailList_setIgnoreIfBroken(aIgnore) {
    this.mIgnoreIfBroken = aIgnore;
  }
};
