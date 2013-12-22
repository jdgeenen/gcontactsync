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

window.addEventListener("load",
  /** Initializes the ContactConverter class when the window has finished loading */
  function gCS_ContactConverterLoadListener(e) {
    com.gContactSync.ContactConverter.init();
  },
false);


/**
 * Converts contacts between Thunderbird's format (a 'card') and the Atom/XML
 * representation of a contact.  Must be initialized before the first use by
 * calling the init() function.
 * @class
 */
com.gContactSync.ContactConverter = {
  /** The GD Namespace */
  GD:            {},
  /** The ATOM/XML Namespace */
  ATOM:          {},
  /** The current TBContact being converted into a GContact */
  mCurrentCard:  {},
  /** An array of ContactConverter objects */
  mConverterArr: [],
  /**
   * Extra attributes added by this extension.  Doesn't include GoogleID or any
   * of the URLs.  Should be obtained w/ ContactConverter.getExtraSyncAttributes
   */
  mAddedAttributes: [
    "HomeFaxNumber", "OtherNumber", "ThirdEmail", "FourthEmail",
    "PrimaryEmailType", "SecondEmailType", "ThirdEmailType", "FourthEmailType",
    "HomePhoneType", "WorkPhoneType", "FaxNumberType", "CellularNumberType",
    "PagerNumberType", "HomeFaxNumberType", "OtherNumberType", "Relation0",
    "Relation0Type", "Relation1", "Relation1Type", "Relation2",
    "Relation2Type", "Relation3", "Relation3Type", "CompanySymbol",
    "JobDescription", "WebPage1Type", "WebPage2Type"
  ],
  /** Stores whether this object has been initialized yet */
  mInitialized: false,
  /**
   * Initializes this object by populating the array of ConverterElement
   * objects and the two namespaces most commonly used by this object.
   */
  init: function ContactConverter_init() {
    this.GD = com.gContactSync.gdata.namespaces.GD;
    this.ATOM = com.gContactSync.gdata.namespaces.ATOM;
    var phoneTypes = com.gContactSync.Preferences.mSyncPrefs.phoneTypes.value;
    // ConverterElement(aElement, aTbName, aIndex, aType)
    // This array stores info on what tags in Google's feed sync with which
    // properties in Thunderbird.  gdata.contacts has info on these tags
    this.mConverterArr = [
      // Various components of a name
      new com.gContactSync.ConverterElement("fullName",       "DisplayName",    0),
      new com.gContactSync.ConverterElement("givenName",      "FirstName",      0),
      new com.gContactSync.ConverterElement("familyName",     "LastName",       0),
      new com.gContactSync.ConverterElement("additionalName", "AdditionalName", 0),
      new com.gContactSync.ConverterElement("namePrefix",     "namePrefix",     0),
      new com.gContactSync.ConverterElement("nameSuffix",     "nameSuffix",     0),
      new com.gContactSync.ConverterElement("nickname",       "NickName",       0),
      // general
      new com.gContactSync.ConverterElement("notes",          "Notes",          0),
      new com.gContactSync.ConverterElement("id",             "GoogleID",       0),
      // e-mail addresses
      new com.gContactSync.ConverterElement("email", "PrimaryEmail", 0, "other"),
      new com.gContactSync.ConverterElement("email", "SecondEmail",  1, "other"),
      new com.gContactSync.ConverterElement("email", "ThirdEmail",   2, "other"),
      new com.gContactSync.ConverterElement("email", "FourthEmail",  3, "other"),
      // IM screennames
      new com.gContactSync.ConverterElement("im", "_AimScreenName",   0, "AIM"),
      new com.gContactSync.ConverterElement("im", "_GoogleTalk",      0, "GOOGLE_TALK"),
      new com.gContactSync.ConverterElement("im", "_ICQ",             0, "ICQ"),
      new com.gContactSync.ConverterElement("im", "_Yahoo",           0, "YAHOO"),
      new com.gContactSync.ConverterElement("im", "_MSN",             0, "MSN"),
      new com.gContactSync.ConverterElement("im", "_JabberId",        0, "JABBER"),
      new com.gContactSync.ConverterElement("im", "_Skype",           0, "SKYPE"),
      new com.gContactSync.ConverterElement("im", "_QQ",              0, "QQ"),
      // the phone numbers
      new com.gContactSync.ConverterElement("phoneNumber", "WorkPhone",      0, "work"),
      new com.gContactSync.ConverterElement("phoneNumber", "HomePhone",      (phoneTypes ? 1 : 0), "home"),
      new com.gContactSync.ConverterElement("phoneNumber", "FaxNumber",      (phoneTypes ? 2 : 0), "work_fax"),
      new com.gContactSync.ConverterElement("phoneNumber", "CellularNumber", (phoneTypes ? 3 : 0), "mobile"),
      new com.gContactSync.ConverterElement("phoneNumber", "PagerNumber",    (phoneTypes ? 4 : 0), "pager"),
      new com.gContactSync.ConverterElement("phoneNumber", "HomeFaxNumber",  (phoneTypes ? 5 : 0), "home_fax"),
      new com.gContactSync.ConverterElement("phoneNumber", "OtherNumber",    (phoneTypes ? 6 : 0), "other"),
      // company info
      new com.gContactSync.ConverterElement("orgTitle",          "JobTitle",       0),
      new com.gContactSync.ConverterElement("orgName",           "Company",        0),
      new com.gContactSync.ConverterElement("orgDepartment",     "Department",     0),
      new com.gContactSync.ConverterElement("orgJobDescription", "JobDescription", 0),
      new com.gContactSync.ConverterElement("orgSymbol",         "CompanySymbol",  0),
      // the URLs from Google - Photo, Self, and Edit
      new com.gContactSync.ConverterElement("PhotoURL", "PhotoURL", 0),
      new com.gContactSync.ConverterElement("SelfURL",  "SelfURL",  0),
      new com.gContactSync.ConverterElement("EditURL",  "EditURL",  0),
      // Relation fields
      new com.gContactSync.ConverterElement("relation", "Relation0", 0, ""),
      new com.gContactSync.ConverterElement("relation", "Relation1", 1, ""),
      new com.gContactSync.ConverterElement("relation", "Relation2", 2, ""),
      new com.gContactSync.ConverterElement("relation", "Relation3", 3, ""),
      // Websites
      new com.gContactSync.ConverterElement("website",   "WebPage2", 0, "home"),
      new com.gContactSync.ConverterElement("website",   "WebPage1", 1, "work"),
    ];

    // Only synchronize (if possible) postal addresses if the preference was
    // changed to true
    if (com.gContactSync.Preferences.mSyncPrefs.syncAddresses.value) {
      // Home address
      this.mConverterArr.push(new com.gContactSync.ConverterElement("street",   "HomeAddress", 0, "home"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("city",     "HomeCity",    0, "home"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("region",   "HomeState",   0, "home"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("postcode", "HomeZipCode", 0, "home"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("country",  "HomeCountry", 0, "home"));
      // Work address
      this.mConverterArr.push(new com.gContactSync.ConverterElement("street",   "WorkAddress", 0, "work"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("city",     "WorkCity",    0, "work"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("region",   "WorkState",   0, "work"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("postcode", "WorkZipCode", 0, "work"));
      this.mConverterArr.push(new com.gContactSync.ConverterElement("country",  "WorkCountry", 0, "work"));
    }
    this.mInitialized = true;
  },
  /**
   * Returns an array of all of the extra attributes synced by this extension.
   * @param aIncludeURLs {boolean} Should be true if the URL-related attributes
   *                               should be returned.
   */
  getExtraSyncAttributes: function ContactConverter_getExtraSyncAttributes(aIncludeURLs) {
    if (!this.mInitialized)
      this.init();
    var arr = this.mAddedAttributes.slice();
    if (aIncludeURLs)
      arr = arr.concat("PhotoURL", "SelfURL", "EditURL", "GoogleID");
    return arr;
  },
  /**
   * Updates or creates a GContact object's Atom/XML representation using its 
   * complementary Address Book card.
   * @param aTBContact    {TBContact} The address book card used to update the Atom
   *                             feed.  Must be in an address book.
   * @param aGContact {GContact} Optional. The GContact object with the Atom/XML
   *                            representation of the contact, if it exists.  If
   *                            not supplied, a contact and feed will be created.
   * @returns {GContact} A GContact object with the Atom feed for the contact.
   */
  cardToAtomXML: function ContactConverter_cardToAtomXML(aTBContact, aGContact) {
    var isNew = !aGContact,
        ab    = aTBContact.mAddressBook,
        arr   = this.mConverterArr,
        i     = 0,
        obj,
        value,
        type;
    if (!aGContact)
      aGContact = new com.gContactSync.GContact();
    if (!this.mInitialized)
      this.init();
    if (!(aTBContact instanceof com.gContactSync.TBContact)) {
      throw "Invalid TBContact sent to ContactConverter.cardToAtomXML from " +
            this.caller;
    }
    if (!(ab instanceof com.gContactSync.AddressBook)) {
      throw "Invalid TBContact (no mAddressBook) sent to " +
            "ContactConverter.cardToAtomXML from " + this.caller;
    }
    this.mCurrentCard = aTBContact;
    // set the regular properties from the array mConverterArr
    for (i = 0, length = arr.length; i < length; i++) {
      // skip the URLs
      if (arr[i].tbName.indexOf("URL") !== -1 || arr[i].tbName === "GoogleID")
        continue;
      obj = arr[i];
      com.gContactSync.LOGGER.VERBOSE_LOG(" * " + obj.tbName);
      value = this.checkValue(aTBContact.getValue(obj.tbName));
      // for the type, get the type from the card, or use its default
      type = aTBContact.getValue(obj.tbName + "Type");
      if (!type || type === "")
        type = obj.type;
      // see the dummy e-mail note below
      if (obj.tbName === com.gContactSync.dummyEmailName &&
          com.gContactSync.isDummyEmail(value)) {
        value = null;
        type  = null;
      }
      com.gContactSync.LOGGER.VERBOSE_LOG("   - " + value + " type: " + type);
      aGContact.setValue(obj.elementName, obj.index, type, value);
    }
    // Birthday can be either YYYY-M-D or --M-D for no year.
    // TB can have all three, just a day/month, or just a year through the UI
    var birthDay    = parseInt(aTBContact.getValue("BirthDay"), 10),
        birthMonth  = (isNaN(birthDay) || (birthDay > 31)) ?
                      null : aTBContact.getValue("BirthMonth"),
        birthdayVal = null;
    // if the contact has a birth month (and birth day) add it to the contact
    // from Google
    if (birthMonth && !isNaN(parseInt(birthMonth, 10)) && (birthMonth <= 12)) {
      var birthYear = parseInt(aTBContact.getValue("BirthYear"), 10);
      // if the birth year is NaN or 0, use '-'
      if (!birthYear) {
        birthYear = "-";
      }
      // otherwise pad it to 4 characters
      else {
        birthYear = String(birthYear);
        while (birthYear.length < 4) {
          birthYear = "0" + birthYear;
        }
      }
      // Pad the birth month to 2 characters
      birthMonth = String(birthMonth);
      while (birthMonth.length < 2) {
        birthMonth = "0" + birthMonth;
      }
      // Pad the birth day to 2 characters
      birthDay = String(birthDay);
      while (birthDay.length < 2) {
        birthDay = "0" + birthDay;
      }
      // form the birthday string: year-month-day
      birthdayVal = birthYear + "-" + birthMonth + "-" + birthDay;
    }
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Birthday: " + birthdayVal);
    aGContact.setValue("birthday", 0, null, birthdayVal);

    // set the extended properties
    aGContact.removeExtendedProperties();
    arr = com.gContactSync.Preferences.mExtendedProperties;
    var props = {};
    for (i = 0, length = arr.length; i < length; i++) {
      // add this extended property if it isn't a duplicate or blank
      if (arr[i] && !props[arr[i]]) {
        props[arr[i]] = true;
        value = this.checkValue(aTBContact.getValue(arr[i]));
        aGContact.setExtendedProperty(arr[i], value);
      }
      else {
        com.gContactSync.LOGGER.LOG_WARNING("Found a duplicate extended property: " +
                                            arr[i]);
      }
    }
    // If the myContacts pref is set and this contact is new then add the
    // myContactsName group
    if (ab.mPrefs.myContacts === "true") {
      if (isNew && com.gContactSync.Sync.mContactsUrl) {
        aGContact.setGroups([com.gContactSync.Sync.mContactsUrl]);
      }
    // If syncing all groups then find all the lists this contact is in and set
    // those as the contact's groups
    } else if (ab.mPrefs.syncGroups == "true") {
      // set the groups
      var groups = [],
          list;
      com.gContactSync.LOGGER.VERBOSE_LOG(" * Determining the groups this contact belongs to");
      for (i in com.gContactSync.Sync.mLists) {
        list = com.gContactSync.Sync.mLists[i];
        if (list instanceof com.gContactSync.GMailList) {
          if (list.hasContact(aTBContact)) {
            com.gContactSync.LOGGER.VERBOSE_LOG("   - " + list.getName());
            groups.push(i);
          }
        } else {
          com.gContactSync.LOGGER.LOG_WARNING("   - Found an invalid list: " + i);
        }
      }
      aGContact.setGroups(groups);
    }
    // Upload the photo
    if (com.gContactSync.Preferences.mSyncPrefs.sendPhotos.value) {
      // Get the profile directory
      var file = Components.classes["@mozilla.org/file/directory_service;1"]
                           .getService(Components.interfaces.nsIProperties)
                           .get("ProfD", Components.interfaces.nsIFile);
      // Get (or make) the Photos directory
      file.append("Photos");
      if (!file.exists())
        file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, parseInt("0755", 8));
      file.append(aTBContact.getValue("PhotoName"));
      if (file.exists() && file.isFile()) {
        aGContact.setPhoto(Components.classes["@mozilla.org/network/io-service;1"]
                                     .getService(Components.interfaces.nsIIOService)
                                     .newFileURI(file));
      } else {
        aGContact.setPhoto("");
      }
    }
    
    // Add the phonetic first and last names
    if (com.gContactSync.Preferences.mSyncPrefs.syncPhoneticNames.value) {
      aGContact.setAttribute("givenName",
                             com.gContactSync.gdata.namespaces.GD.url,
                             0,
                             "yomi",
                             aTBContact.getValue("PhoneticFirstName"));
      aGContact.setAttribute("familyName",
                             com.gContactSync.gdata.namespaces.GD.url,
                             0,
                             "yomi",
                             aTBContact.getValue("PhoneticLastName"));
    }
    
    return aGContact;
  },
  /**
   * Converts an GContact's Atom/XML representation of a contact to
   * Thunderbird's address book card format.
   * @param aGContact {GContact} A GContact object with the contact to convert.
   * @param aTBContact {TBContact}   An existing card that can be QI'd to
   *                            Components.interfaces.nsIAbMDBCard if this is
   *                            before 413260 landed.
   * @returns {TBContact} The updated TBContact.
   */
  makeCard: function ContactConverter_makeCard(aGContact, aTBContact) {
    if (!aGContact)
      throw "Invalid aGContact parameter supplied to the 'makeCard' method" +
            com.gContactSync.StringBundle.getStr("pleaseReport");
    if (!this.mInitialized)
      this.init();
    if (!(aTBContact instanceof com.gContactSync.TBContact)) {
      throw "Invalid TBContact sent to ContactConverter.makeCard from " +
            this.caller;
    }
    var ab = aTBContact.mAddressBook;
    if (!(ab instanceof com.gContactSync.AddressBook)) {
      throw "Invalid TBContact (no mAddressBook) sent to " +
            "ContactConverter.cardToAtomXML from " + this.caller;
    }
    var arr = this.mConverterArr,
        blankProp = new com.gContactSync.Property("", "");
    // get the regular properties from the array mConverterArr
    for (var i = 0, length = arr.length; i < length; i++) {
      var obj = arr[i],
          property = aGContact.getValue(obj.elementName, obj.index, obj.type);
      property = property || blankProp;
      com.gContactSync.LOGGER.VERBOSE_LOG(obj.tbName + ": '" + property.value +
                                          "', type: '" + property.type + "'");
      // Thunderbird has problems with contacts who do not have an e-mail addr
      // and are in Mailing Lists.  To avoid problems, use a dummy e-mail addr
      // that is hidden from the user
      if (obj.tbName === com.gContactSync.dummyEmailName && !property.value) {
        property.value = com.gContactSync.makeDummyEmail(aGContact);
        property.type  = "home";
      }
      aTBContact.setValue(obj.tbName, property.value);
      // set the type, if it is an attribute with a type
      if (property.type)
        aTBContact.setValue(obj.tbName + "Type", property.type);
    }
    // get the extended properties
    arr = com.gContactSync.Preferences.mExtendedProperties;
    for (i = 0, length = arr.length; i < length; i++) {
      var value = aGContact.getExtendedProperty(arr[i]);
      value = value ? value.value : null;
      aTBContact.setValue(arr[i], value);
    }
    
    // Get the birthday info
    var bday = aGContact.getValue("birthday", 0, com.gContactSync.gdata.contacts.types.UNTYPED),
        year  = null,
        month = null,
        day   = null;
    // If it has a birthday...
    if (bday && bday.value) {
      com.gContactSync.LOGGER.VERBOSE_LOG(" * Found a birthday value of " + bday.value);
      // If it consists of all three date elements: YYYY-M-D
      if (bday.value.indexOf("--") === -1) {
        arr = bday.value.split("-");
        year  = arr[0];
        month = arr[1];
        day   = arr[2];
      }
      // Else it is just a month and day: --M-D
      else {
        arr   = bday.value.replace("--", "").split("-");
        month = arr[0];
        day   = arr[1];
      }
      com.gContactSync.LOGGER.VERBOSE_LOG("  - Year:  " +  year);
      com.gContactSync.LOGGER.VERBOSE_LOG("  - Month: " +  month);
      com.gContactSync.LOGGER.VERBOSE_LOG("  - Day:   " +  day);
    }
    aTBContact.setValue("BirthYear",  year);
    aTBContact.setValue("BirthMonth", month);
    aTBContact.setValue("BirthDay",   day);

    if (com.gContactSync.Preferences.mSyncPrefs.getPhotos.value) {
      var info = aGContact.getPhotoInfo();
      // If the contact has a photo then save it to a local file and update
      // the related attributes
      // Thunderbird requires two copies of each photo.  A permanent copy must
      // be kept outside of the Photos directory.  Each time a contact is edited
      // Thunderbird will re-copy the original photo to the Photos directory and
      // delete the old copy.
      if (info && info.etag &&
          (file = aGContact.writePhoto(com.gContactSync.Sync.mCurrentAuthToken))) {
        com.gContactSync.LOGGER.VERBOSE_LOG("Wrote photo...name: " + file.leafName);
        com.gContactSync.copyPhotoToPhotosDir(file);
        aTBContact.setValue("PhotoName", file.leafName);
        aTBContact.setValue("PhotoType", "file");
        aTBContact.setValue("PhotoURI",
                            Components.classes["@mozilla.org/network/io-service;1"]
                                      .getService(Components.interfaces.nsIIOService)
                                      .newFileURI(file)
                                      .spec);
        aTBContact.setValue("PhotoEtag", info.etag);
      }
      // If the contact doesn't have a photo then clear the related attributes
      else {
        aTBContact.setValue("PhotoName", "");
        aTBContact.setValue("PhotoType", "");
        aTBContact.setValue("PhotoURI",  "");
        aTBContact.setValue("PhotoEtag", "");
      }
    }
    
    // Add the phonetic first and last names
    if (com.gContactSync.Preferences.mSyncPrefs.syncPhoneticNames.value) {
      aTBContact.setValue("PhoneticFirstName",
                          aGContact.getAttribute("givenName",
                          com.gContactSync.gdata.namespaces.GD.url,
                          0,
                          "yomi"));
      aTBContact.setValue("PhoneticLastName",
                          aGContact.getAttribute("familyName",
                          com.gContactSync.gdata.namespaces.GD.url,
                          0,
                          "yomi"));
    }

    aTBContact.update();
    if (ab.mPrefs.syncGroups == "true" && ab.mPrefs.myContacts != "true") {
      // get the groups after updating the card
      var groups = aGContact.getValue("groupMembershipInfo"),
          lists  = com.gContactSync.Sync.mLists,
          list,
          group;
      for (var i in lists) {
        group = groups[i];
        list  = lists[i];
        // delete the card from the list, if necessary
        if (list.hasContact(aTBContact)) {
          if (!group) {
            list.deleteContacts([aTBContact]);
          }
          aTBContact.update();
        }
        // add the card to the list, if necessary
        else if (group) {
          list.addContact(aTBContact);
        }
      }
    }
  },
  /**
   * Check if the given string is null, of length 0, or consists only of spaces
   * and return null if any of the listed conditions is true.
   * This function was added to fix Bug 20389: Values with only spaces should be
   * treated as empty
   * @param aValue {string} The string to check.
   * @returns null   - The string is null, of length 0, or consists only of
                      spaces
   *         aValue - The string has at least one character that is not a space
   */
  checkValue: function ContactConverter_checkValue(aValue) {
    if (!aValue || !aValue.length) return null;
    for (var i = 0; i < aValue.length; i++)
      if (aValue[i] != " ") return aValue;
    return null;
  }
};
