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
 * Portions created by the Initial Developer are Copyright (C) 2008-2010
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
 * address books, and edit cards.
 * @class
 */
com.gContactSync.AbManager = {
  /** The version of Thunderbird */
  mVersion:   Components.classes["@mozilla.org/abmanager;1"] ? 3 : 2,
  /** True if the changes started in Bug 413260 have been applied */
  mBug413260: Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                        .createInstance(Components.interfaces.nsIAbCard)
                        .getProperty !== undefined,
  /** attributes that can be set by getCardValue and setCardValue */
  mBasicAttributes: [
    "DisplayName", "Notes", "CellularNumber", "HomePhone", "WorkPhone",
    "PagerNumber", "FaxNumber", "_AimScreenName", "PrimaryEmail", "SecondEmail",
    "Company", "JobTitle", "HomeAddress", "WorkAddress", "NickName", "LastName",
    "FirstName", "HomeAddress2", "HomeCity", "HomeState", "HomeZipCode",
    "HomeCountry", "WorkAddress2", "WorkCity", "WorkState", "WorkZipCode",
    "WorkCountry", "WebPage1", "WebPage2", "Department", "Custom1", "Custom2",
    "Custom3", "Custom4", "WorkPhoneType", "HomePhoneType", "CellularNumberType",
    "FaxNumberType", "PagerNumberType"
  ],
  /**
   * Returns true if the given attribute is able to be set/obtained through the
   * setCardValue and getCardValue functions of nsIAbCard.
   * @param aAttribute The attribute to check.
   * @returns True if aAttribute is usable with set/getCardValue.
   */
  isRegularAttribute: function AbManager_isRegularAttribute(aAttribute) {
    return this.mBasicAttributes.indexOf(aAttribute) !== -1;
  },
  /**
   * Checks the validity of a directory and returns false if it is invalid.
   * @param aDirectory {nsIAbDirectory} The directory to check.
   */
  isDirectoryValid: function AbManager_isDirectoryValid(aDirectory) {
    return aDirectory &&
           aDirectory instanceof Components.interfaces.nsIAbDirectory &&
           aDirectory.dirName !== "";
  },
  /**
   * Checks the validity of a card and throws an error if the card is invalid.
   * @param aCard        {nsIAbCard} An object that should be an instance of nsIAbCard
   * @param aMethodName  {string} The name of the method calling checkCard (used
   *                              when throwing the error)
   */
  checkCard: function AbManager_checkCard(aCard, aMethodName) {
    var card = aCard && aCard.mCard ? aCard.mCard : aCard;
    if (!card || (!(card instanceof Components.interfaces.nsIAbCard) &&
                  !(Components.interfaces.nsIAbMDBCard && card instanceof Components.interfaces.nsIAbMDBCard))) {
      throw "Invalid card: " + aCard + "passed to the '" + aMethodName +
            "' method." + com.gContactSync.StringBundle.getStr("pleaseReport");
    }
  },
  /**
   * Returns the value of the specifiec property in the given card, or throws an
   * error if it is not present or blank.
   * @param aCard     {nsIAbCard} The card to get the value from.
   * @param aAttrName {string}    The name of the attribute to get.
   */
  getCardValue: function AbManager_getCardValue(aCard, aAttrName) {
    this.checkCard(aCard, "getCardValue");
    if (this.mBug413260) // if the patch for Bug 413260 is applied
      return aCard.getProperty(aAttrName, null);
    else {
      if (aAttrName === "LastModifiedDate")
        return aCard.lastModifiedDate; // workaround for lastModifiedDate bug
      var value;
      if (this.isRegularAttribute(aAttrName))
        try { return aCard.getCardValue(aAttrName); }
        catch (e) { com.gContactSync.LOGGER.LOG_WARNING("Error in getCardValue: " + e); }
      else if (Components.interfaces.nsIAbMDBCard && aCard instanceof Components.interfaces.nsIAbMDBCard)
        return this.getMDBCardValue(aCard, aAttrName);
      else
        com.gContactSync.LOGGER.LOG_WARNING("Couldn't get the value " + aAttrName + " of the card "
                           + aCard);
    }
    return null;
  },
  /**
   * Returns an object with a property for each of the e-mail addresses of this
   * card as recognized by gContactSync (PrimaryEmail, SecondEmail, ThirdEmail,
   * and FourthEmail)
   * @param aCard {nsIAbCard} The card from which the e-mail addresses are
   *                          obtained.
   * @returns An object with the card's e-mail addresses.
   */
  getCardEmailAddresses: function AbManager_getCardEmailAddresses(aCard) {
    this.checkCard(aCard, "getCardEmailAddresses");
    var primaryEmail = this.getCardValue(aCard, "PrimaryEmail");
    var addresses = [];
    if (primaryEmail)
      addresses[primaryEmail] = true;
    var secondEmail = this.getCardValue(aCard, "SecondEmail");
    if (secondEmail)
      addresses[secondEmail] = true;
    var thirdEmail = this.getCardValue(aCard, "ThirdEmail");
    if (thirdEmail)
      addresses[thirdEmail] = true;
    var fourthEmail = this.getCardValue(aCard, "FourthEmail");
    if (fourthEmail)
      addresses[fourthEmail] = true;
    return addresses;
  },
  /**
   * Returns true if the card has at least one e-mail address identical to one
   * in aAddresses.
   * @param aCard      {nsIAbCard} The card from which the e-mail addresses are
   *                               obtained.
   * @param aAddresses An object with the card's e-mail addresses as returned by
   *                   AbManager.getCardEmailAddresses.
   * @returns {boolean} True if the card has at least one e-mail address in
   *                   common with aAddresses.
   */
  cardHasEmailAddress: function AbManager_cardHasEmailAddress(aCard, aAddresses) {
    this.checkCard(aCard, "getCardEmailAddresses");
    if (!aAddresses)
      return false;
    var cardAddresses = this.getCardEmailAddresses(aCard);
    for (var i in cardAddresses) {
      if (aAddresses[i])
        return true;
    }
    return false;
  },
  /**
   * Sets the value of the specifiec property in the given card but does not
   * update the card in the database.
   * @param aCard     {nsIAbCard} The card to get the value from.
   * @param aAttrName {string}    The name of the attribute to set.
   * @param aValue    {string}    The value to set for the attribute.
   */
  setCardValue: function AbManager_setCardValue(aCard, aAttrName, aValue) {
    this.checkCard(aCard, "setCardValue");
    if (!aValue)
      aValue = "";
    // make sure the last modified date is in milliseconds since 1/1/1970 UTC
    // and not in microseconds
    if (aAttrName == "LastModifiedDate" && parseInt(aValue, 10) > 2147483647) {
      com.gContactSync.LOGGER.LOG_WARNING("Had to adjust last modified date from " + aValue);
      aValue = aValue/1000;
    }
    if (this.mBug413260) { // if the patch for Bug 413260 is applied
      if (aAttrName == "PreferMailFormat") {
        switch (aValue) {
          case "plaintext":
          case "text":
          case "1":
            aValue = 1;
            break;
          case "html":
          case "2":
            aValue = 2;
            break;
          default: // if it is anything else set as unknown
            aValue = 0;
        }
      }
      aCard.setProperty(aAttrName, aValue);
    }
    else {
      // workaround a last modified date bug
      if (aAttrName == "LastModifiedDate")
        try {
          if (aValue == "")
            aValue = 0;
          aCard.lastModifiedDate = aValue;
        } catch (e) { com.gContactSync.LOGGER.LOG_WARNING("Invalid lastModifiedDate"); }
      else if (aAttrName == "AllowRemoteContent") {
        // AllowRemoteContent may be 1/0 if the patch or true/false otherwise
        var value = aValue == "1" || (aValue != "0" && aValue);
        aCard.allowRemoteContent = value;
      }
      else if (aAttrName == "PreferMailFormat") {
        // can be a 0/1/2 or unknown/plaintext/html
        var value;
        switch (aValue) {
          case "plaintext":
          case "text":
          case "1":
            value = 1;
            break;
          case "html":
          case "2":
            value = 2;
            break;
          default: // if it is anything else set as unknown
            value = 0;
        }
        aCard.preferMailFormat = value;
      }
      else if (this.isRegularAttribute(aAttrName))
        try { aCard.setCardValue(aAttrName, aValue); }
        catch (e) { com.gContactSync.LOGGER.LOG_WARNING("Error in setCardValue: " + e); }
     else if (Components.interfaces.nsIAbMDBCard && aCard instanceof Components.interfaces.nsIAbMDBCard)
        this.setMDBCardValue(aCard, aAttrName, aValue);
     else
       com.gContactSync.LOGGER.LOG_WARNING("Couldn't set the value " + aAttrName + " of the card "
                          + aCard);
    }
  },
  /**
    * Sets the requested value of an MDB card's attribute.  Performs a
    * QueryInterface if necessary.
    * @param aCard     {nsIAbCard} The MDB card to set the value for.
    * @param aAttrName {string}    The name of the attribute whose value is set.
    * @param aValue    {string}    The value to set for aAttrName.
    *
    * @returns {boolean} True if the attribute was set to the given value.
    */
  setMDBCardValue: function AbManager_setMDBCardValue(aCard, aAttrName, aValue) {
    try {
      aCard.setStringAttribute(aAttrName, aValue);
      return true;
    }
    catch (e) {
      com.gContactSync.LOGGER.LOG_WARNING("Error in setMDBCardValue: " + e + "\n" + aAttrName +
                         "\n" + aValue);
    }
    return false;
  },
  /**
   * Returns the requested value of an MDB card's attribute.  Performs a
   * QueryInterface if necessary.
   * @param aCard     {nsIAbCard} The MDB card to get the value from.
   * @param aAttrName {string}    The name of the attribute whose value is returned.
   * @returns {string} The value of aCard's attribute aAttrName.
   */
  getMDBCardValue: function AbManager_getMDBCardValue(aCard, aAttrName) {
    try {
      return aCard.getStringAttribute(aAttrName);
    }
    catch (e) {
      com.gContactSync.LOGGER.LOG_WARNING("Error in getMDBCardValue: " + e + "\n" + aAttrName);
    }
    return null;
  },
  /**
   * Returns the address book with the given URI, if found.  Does not attempt
   * to make a new address book if not found and returns null.
   * @returns  {nsIAbDirectory} The Address Book with the given URI
   */
  getAbByURI: function AbManager_getAbByURI(aURI) {
    if (!aURI) {
      com.gContactSync.LOGGER.LOG_WARNING("Invalid aURI supplied to the 'getAbByURI' method" +
                         com.gContactSync.StringBundle.getStr("pleaseReport"));
      return null;
    }
    try {
      var dir;
      if (Components.classes["@mozilla.org/abmanager;1"])
        dir = Components.classes["@mozilla.org/abmanager;1"]
                        .getService(Components.interfaces.nsIAbManager)
                        .getDirectory(aURI)
                        .QueryInterface(Components.interfaces.nsIAbDirectory);
      else
       dir = Components.classes["@mozilla.org/rdf/rdf-service;1"]
              .getService(Components.interfaces.nsIRDFService)
              .GetResource(aURI)
              .QueryInterface(Components.interfaces.nsIAbDirectory);
      // checks that the directory exists and is valid.  returns null if not.
      if (!this.isDirectoryValid(dir))
        return null;
      return dir;
    }
    catch (e) { com.gContactSync.LOGGER.LOG_ERROR("Error in getAbByURI", e); }
    return null;
  },
  /**
   * Returns the Address Book if it can be found.  If it cannot be found
   * it tries once to make it and return the newly made address book.
   * @param aDirName    {string} The name of the address book
   * @param aDontMakeAb {boolean} True if the address book shouldn't be created
   *                              if not found. 
   * @returns {nsIAbDirectory} The Address Book with the name given
   */
  getAbByName: function AbManager_getAbByName(aDirName, aDontMakeAb) {
    if (!aDirName || aDirName.length == 0)
      throw "Invalid aDirName passed to the 'getAbByName' method." +
            com.gContactSync.StringBundle.getStr("pleaseReport");
    var iter, data;
    if (Components.classes["@mozilla.org/abmanager;1"]) { // TB 3
      var abManager = Components.classes["@mozilla.org/abmanager;1"]
                                .getService(Components.interfaces.nsIAbManager);
      iter = abManager.directories;
    }
    else { // TB 2
      // obtain the main directory through the RDF service
      var dir = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                          .getService(Components.interfaces.nsIRDFService)
                          .GetResource("moz-abdirectory://")
                          .QueryInterface(Components.interfaces.nsIAbDirectory);
      iter = dir.childNodes;
    }
    while (iter.hasMoreElements()) {
      data = iter.getNext();
      if (data instanceof Components.interfaces.nsIAbDirectory)
        if (data.dirName == aDirName)
          return data;
    }
    iter = null;
    if (aDontMakeAb)
      return null;
    // the AB doesn't exist, so make one:
    // TODO - this should be in its own method
    if (Components.classes["@mozilla.org/addressbook/properties;1"]) { // TB 2
      // setup the "properties" of the new address book
      var properties = Components.classes["@mozilla.org/addressbook/properties;1"]
	                             .createInstance(Components.interfaces.nsIAbDirectoryProperties);
	    properties.description = aDirName;
	    properties.dirType = 2; // address book
      dir.createNewDirectory(properties);
      iter = dir.childNodes;
    }
    else if (abManager) { // TB 3
      abManager.newAddressBook(aDirName, "moz-abmdbdirectory://", 2);
      iter = abManager.directories;
    }
    else if (Components.classes["@mozilla.org/addressbook;1"]) { // Postbox
      var addressbook = Components.classes["@mozilla.org/addressbook;1"]
                                   .createInstance(Components.interfaces.nsIAddressBook);
      addressbook.newAddressBook(aDirName, "", 2);
      iter = dir.childNodes;
    }
    else {
      com.gContactSync.LOGGER.LOG_WARNING("Unable to determine how to create a directory");
      alert("error");
      return null;
    }
    if (!iter) {
      com.gContactSync.LOGGER.LOG_WARNING("iter is invalid in getAbByName");
      return null;
    }
    while (iter.hasMoreElements()) {
      data = iter.getNext();
      if ((data instanceof Components.interfaces.nsIAbDirectory) && data.dirName == aDirName)
        return data;
    }// end of while loop
    return null;
  },
  /**
   * Deletes the Address Book with the given URI.
   * This does NOT provide any confirmation dialog.
   * Note: This will not work in Thunderbird 2 with mailing lists.
   * This will not allow deleting the PAB or CAB and will show a popup
   * if there is an attempt to delete one of those ABs.
   * @param aURI {string} The URI of the address book to delete.
   */
  deleteAB: function AbManager_deleteAB(aURI) {
    if (!aURI) {
      com.gContactSync.LOGGER.LOG_ERROR("Invalid URI passed to AbManager.deleteAB");
      return false;
    }
    if (aURI.indexOf("abook.mab") != -1 || aURI.indexOf("history.mab") != -1) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("deletePAB"));
      com.gContactSync.LOGGER.LOG_WARNING("Attempt made to delete the PAB or CAB.  URI: " + aURI);
      return false;
    }
    com.gContactSync.LOGGER.VERBOSE_LOG("Deleting address book with the URI " + aURI);
    // In TB 3 just use the AbManager to delete the AB
    if (Components.classes["@mozilla.org/abmanager;1"]) {
      var abManager = Components.classes["@mozilla.org/abmanager;1"]
                                .getService(Components.interfaces.nsIAbManager);
      if (!abManager) {
        com.gContactSync.LOGGER.LOG_ERROR("Unable to get the AB Manager service");
        return false;
      }
      abManager.deleteAddressBook(aURI);
    }
    // TB 2 requires a bit more work
    else {
      // First create an array of parent resources
      var parentArray = Components.classes["@mozilla.org/supports-array;1"]
                                  .createInstance(Components.interfaces.nsISupportsArray);
      if (!parentArray) {
        com.gContactSync.LOGGER.LOG_ERROR("Unable to get an nsISupportsArray");
        return false;
      }
      var parentId  = "moz-abdirectory://";
      var parentDir = GetDirectoryFromURI(parentId);
      parentArray.AppendElement(parentDir);

      // Next create an array of the resources to delete
      var resourceArray = Components.classes["@mozilla.org/supports-array;1"]
                                    .createInstance(Components.interfaces.nsISupportsArray);
      if (!resourceArray) {
        com.gContactSync.LOGGER.LOG_ERROR("Unable to get an nsISupportsArray");
        return false;
      }
      var selectedABResource = GetDirectoryFromURI(aURI)
                                    .QueryInterface(Components.interfaces.nsIRDFResource);
      if (!selectedABResource) {
        com.gContactSync.LOGGER.LOG_ERROR("Unable to get an nsISupportsArray");
        return false;
      }
      resourceArray.AppendElement(selectedABResource);

      // Get the directory tree
      var dirTree = GetDirTree();
      if (!dirTree) {
        com.gContactSync.LOGGER.LOG_ERROR("Unable to get the directory tree");
        return false;
      }

      // Finally delete the address book
      top.addressbook.deleteAddressBooks(dirTree.database, parentArray, resourceArray);
    }
    return true;
  }
};
