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
 * Portions created by the Initial Developer are Copyright (C) 2009-2015
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
 * Makes a new TBContact object that has functions to get and set various values
 * for a contact independently of the version of Thunderbird (using com.gContactSync.GAbManager).
 * Optionally takes the parent directory and is able to update the card in that
 * directory.
 * 
 * @param aContact   {nsIAbCard}   A Thunderbird contact.
 * @param aDirectory {AddressBook} The parent directory.  Optional.
 * @class
 * @constructor
 */
com.gContactSync.TBContact = function gCS_TBContact(aCard, aDirectory) {
  if (!(aCard instanceof Components.interfaces.nsIAbCard)) {
    com.gContactSync.LOGGER.LOG_ERROR("Invalid aCard passed to the TBContact constructor: " +
                                      aCard + "\nCalled by: " + this.caller);
    throw "Invalid aCard passed to TBContact";
  }
  //if (!(aDirectory instanceof com.gContactSync.AddressBook)) {
  //  throw "Error - invalid directory sent to the TBContact constructor";
  //}
  this.mAddressBook = aDirectory;
  this.mContact     = aCard;
  this.mPostbox     = this.mContact.setAdditionalEmailAddresses;
  this.mUpdatePhoto = false;
};

com.gContactSync.TBContact.prototype = {
  /**
   * Returns the value of the requested property of this contact.
   *
   * If the readOnly preference is enabled, then this will return 0 for the
   * LastModifiedDate.
   * 
   * @param aAttribute {string} The attribute to get (PrimaryEmail, for example)
   *
   * @returns {string} The value of the attribute, or null if not set.
   */
  getValue: function TBContact_getValue(aAttribute) {
    if (!aAttribute) {
      throw "Error - invalid attribute sent to TBContact.getValue";
    }
    if (aAttribute === "LastModifiedDate") {
      var ret = com.gContactSync.GAbManager.getCardValue(this.mContact, aAttribute);
      if (this.mAddressBook.mPrefs && this.mAddressBook.mPrefs.readOnly === "true") {
        com.gContactSync.LOGGER.VERBOSE_LOG(" * Read only mode, setting LMD to 1");
        ret = 1;
      } else if (isNaN(ret) || !isFinite(ret)) {
        com.gContactSync.LOGGER.LOG_WARNING(" * Couldn't parse date (" + ret + ")");
        ret = 1;
      }
      return ret;
    } else if (aAttribute === "HomeAddressMult" || aAttribute === "WorkAddressMult") {
      var type = aAttribute.substring(0, 4);
      var addr = com.gContactSync.GAbManager.getCardValue(this.mContact, type + "Address");
      var line2 = com.gContactSync.GAbManager.getCardValue(this.mContact, type + "Address2");
      if (line2) { addr += "\n" + line2; }
      return addr;
    // Postbox stores additional e-mail addresses already
    } else if (this.mPostbox && (aAttribute === "ThirdEmail" || aAttribute === "FourthEmail")) {
      var arrLen   = {},
          emailArr = this.mContact.getAdditionalEmailAddresses(arrLen);
      if (aAttribute === "ThirdEmail" && emailArr.length > 0) {
        return emailArr[0];
      } else if (emailArr.length > 1) {
        return emailArr[1];
      }
      return null;
    }
    return com.gContactSync.GAbManager.getCardValue(this.mContact, aAttribute);
  },
  /**
   * Returns the Google ID of this contact, if any, and forces it to be
   * https://... (if present).
   *
   * @returns {string} The GoogleID of this contact using https
   */
  getID: function TBContact_getID() {
    var id = this.getValue("GoogleID") || "";
    return com.gContactSync.fixURL(id.toLowerCase());
  },
  /**
   * Sets the value of the requested attribute of this contact and optionally
   * updates the contact in its parent directory.
   *
   * @param aAttribute {string} The attribute to set (PrimaryEmail, for example)
   * @param aValue     {string} The value for the given attribute.  If null the
   *                   attribute is 'deleted' from the contact.
   * @param aUpdate    {boolean} Set to true to update this card after setting
   *                   the value of the attribute.
   * @returns {boolean} True if the contact was updated.
   */
  setValue: function TBContact_setValue(aAttribute, aValue, aUpdate) {
    if (this.mPostbox && (aAttribute === "ThirdEmail" || aAttribute === "FourthEmail")) {
      // get the existing e-mail addresses
      var arrLen   = {},
          emailArr = this.mContact.getAdditionalEmailAddresses(arrLen);
      if (aAttribute === "ThirdEmail") {
        emailArr[0] = aValue;
      } else if (emailArr.length > 0) {
        // FourthEmail
        emailArr[1] = aValue;
      } else {
        emailArr[0] = aValue;
      }
      this.mContact.setAdditionalEmailAddresses(emailArr.length, emailArr);
    } else if (aAttribute === "HomeAddressMult" || aAttribute === "WorkAddressMult") {
      var type = aAttribute.substring(0, 4);
      var values = aValue ? aValue.split("\n") : [aValue, aValue];
      com.gContactSync.GAbManager.setCardValue(this.mContact, type + "Address", values[0]);
      com.gContactSync.GAbManager.setCardValue(this.mContact, type + "Address2", values[1]);
    } else {
      com.gContactSync.GAbManager.setCardValue(this.mContact, aAttribute, aValue);
    }
    if (aUpdate) { return this.update(); }
    return false;
  },
  /**
   * Updates this card in its parent directory, if possible.
   * @returns {boolean} True if the contact was updated.
   */
  update: function TBContact_update() {
    if (!this.mAddressBook) {
      com.gContactSync.LOGGER.LOG_WARNING("Warning - TBContact.update called w/o a directory");
      return false;
    }
    return this.mAddressBook.updateContact(this);
  },
  /**
   * Removes this card from its parent directory, if possible.
   * @returns {boolean} True if the contact was removed.
   */
  remove: function TBContact_remove() {
    if (!this.mAddressBook) {
      com.gContactSync.LOGGER.LOG_WARNING("Warning - TBContact.remove called w/o a directory");
      return false;
    }
    return this.mAddressBook.deleteContacts([this]);
  },
  /**
   * Returns a 'name' for this contact.  It is the first non-null and not blank
   * value for the following attributes:
   *  - DisplayName
   *  - PrimaryEmail
   *  - GoogleID
   * @returns {string} The name of this contact.
   */
  getName: function TBContact_getName() {
    var displayName  = this.getValue("DisplayName");
    if (displayName)
      return displayName;
    var primaryEmail = this.getValue("PrimaryEmail");
    if (primaryEmail)
      return primaryEmail;
    return this.getID();
  },
  /**
   * Updates the photo for this contact from the given photo info.
   *
   * @param aInfo {Object} Photo information.
   */
  updatePhoto: function TBContact_updatePhoto(aInfo) {

    // If the contact has a photo then save it to a local file and update
    // the related attributes
    // Thunderbird requires two copies of each photo.  A permanent copy must
    // be kept outside of the Photos directory.  Each time a contact is edited
    // Thunderbird will re-copy the original photo to the Photos directory and
    // delete the old copy.

    if (!aInfo || !aInfo.etag) {

      // If the contact doesn't have a photo then clear the related attributes
      this.setValue("PhotoName", "");
      this.setValue("PhotoType", "");
      this.setValue("PhotoURI",  "");
      this.setValue("PhotoEtag", "");

    } else if (aInfo.etag === this.getValue("PhotoEtag")) {

      com.gContactSync.LOGGER.VERBOSE_LOG(" * Photo is already up-to-date");

    } else {

      com.gContactSync.LOGGER.VERBOSE_LOG(" * Photo will be downloaded");
      this.setValue("PhotoEtag", aInfo.etag);
      this.mUpdatePhoto = true;
    }
  }
};
