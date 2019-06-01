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
 * Portions created by the Initial Developer are Copyright (C) 2008-2014
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

window.addEventListener("load",
  /** Initializes the CardDialogOverlay when the window has finished loading. */
  function gCS_CardDialogOverlayLoadListener() {
    window.removeEventListener("load", gCS_CardDialogOverlayLoadListener, false);
    gContactSync.CardDialogOverlay.init();
  },
false);
/**
 * Attributes added to TB by gContactSync AND present in the card dialog overlay
 */
gContactSync.gAttributes = {
  "ThirdEmail":           {}, 
  "FourthEmail":          {},
  "HomeFaxNumber":        {},
  "OtherNumber":          {},
  "PrimaryEmailType":     {},
  "SecondEmailType":      {},
  "ThirdEmailType":       {},
  "FourthEmailType":      {},
  "WorkPhoneType":        {},
  "HomePhoneType":        {},
  "FaxNumberType":        {},
  "CellularNumberType":   {},
  "PagerNumberType":      {},
  "HomeFaxNumberType":    {},
  "OtherNumberType":      {},
  "WebPage1Type":         {},
  "WebPage2Type":         {}
};
/**
 * Adds a tab to the tab box in the New and Edit Card Dialogs.  Using JavaScript
 * is necessary because the tab box doesn't have an ID.
 * @class
 */
gContactSync.CardDialogOverlay = {
  /** The XUL namespace */
  mNamespace:  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
  /** The number of times an attempt was made to initialize the dialog */
  mLoadNumber: 0,
  /** This stores whether the contact is read-only (ie from LDAP or the Mac AB) */
  mDisabled:   false,
  /** Whether the application is Postbox */
  mIsPostbox:  false,

  /**
   * Checks whether gContactSync field should be injected or not.
   */
  init: function CardDialogOverlay_init() {
    //check string property of directory, if init() of gContactSync should be skipped
    let arg = window.arguments[0];
    let abURI = "";
    let gContactSyncSkipped = "";
    //newCardDialog and editCardDialog use different names for the ab argument
    if (arg.hasOwnProperty("abURI")) {
        abURI = arg.abURI;
    } else if (arg.hasOwnProperty("selectedAB")) {
        abURI = arg.selectedAB;
    }

    if (abURI) {
        try {
            let abManager = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager);
            let ab = abManager.getDirectory(abURI);
            if (ab.isMailList) {
                let parentURI = abURI.split("/");
                parentURI.pop();
                ab = abManager.getDirectory(parentURI.join("/"));
            }
            gContactSyncSkipped = ab.getStringValue("gContactSyncSkipped", "");
        } catch (e) {} 
    }
    
    if (gContactSyncSkipped) {
      return;
    }
    gContactSync.CardDialogOverlay.inject();
  },
  
  /**
   * Adds a tab to the tab box, if possible.  Waits until the abCardOverlay is
   * loaded.
   */
  inject: function CardDialogOverlay_inject() {
    // if it isn't finished loading yet wait another 200 ms and try again
    if (!document.getElementById("abTabs")) {
      // if it has tried to load more than 50 times something is wrong, so quit
      if (gContactSync.CardDialogOverlay.mLoadNumber < 50)
        setTimeout(gContactSync.CardDialogOverlay.inject, 200);
      gContactSync.CardDialogOverlay.mLoadNumber++;
      return;
    }

    //the XUL injected all extra elements as hidden, unhide them
    document.getElementById("gContactSyncTab").hidden = false;
    
    for (var i = 0; i < gContactSync.Preferences.mSyncPrefs.numRelations.value; ++i) {
      gContactSync.gAttributes["Relation" + i] = "";
      gContactSync.gAttributes["Relation" + i + "Type"] = "";
    }

    // some contacts are read-only so extra attributes should be disabled for
    // those cards (see Mozdev Bug 20169)
    try {
      gContactSync.CardDialogOverlay.mDisabled = document.getElementById("PreferMailFormatPopup").disabled;
    }
    catch (ex) {
      gContactSync.alertError("Error while determining if contact is read-only: " + ex);
      gContactSync.CardDialogOverlay.mDisabled = true;
    }
    // add the email type drop down menus
    try {
      this.mIsPostbox = this.addPostboxEmailType(document.getElementById("PrimaryEmail"));
      // add the type for Postbox (this does nothing for TB or Seamonkey)
      if (!this.mIsPostbox) {
        var emailTypes       = gContactSync.gdata.contacts.EMAIL_TYPES,
            primaryEmailBox  = this.getBox("PrimaryEmail"),
            secondEmailBox   = this.getBox("SecondEmail"),
            thirdEmailBox    = this.getBox("ThirdEmail"),
            fourthEmailBox   = this.getBox("FourthEmail");
        // add the type menulist to e-mail elements if this isn't Postbox
        this.addMenuItems(primaryEmailBox, emailTypes, "PrimaryEmailType", "other");
        this.addMenuItems(secondEmailBox,  emailTypes, "SecondEmailType",  "other");
        this.addMenuItems(thirdEmailBox,   emailTypes, "ThirdEmailType",   "other");
        this.addMenuItems(fourthEmailBox,  emailTypes, "FourthEmailType",  "other");
      }
      else {
        document.getElementById("additionalEmailBox").collapsed = true;
      }
    }
    catch (ex0) {
      gContactSync.alertError("Unable to setup email types: " + ex0);
    }
    // Hide the gContactSync tab for Postbox
    // TODO - implement full support for Postbox instead.
    if (this.mIsPostbox) {
      document.getElementById("gContactSyncTab").collapsed = true;
    }
    var newDialog      = false, // post-Mailnews Core Bug 63941 - TODO - can this be removed (Postbox?)
        showPhoneTypes = gContactSync.Preferences.mSyncPrefs.phoneTypes.value,
        swap           = gContactSync.Preferences.mSyncPrefs.swapMobilePager.value,
        work           = document.getElementById("WorkPhone"),
        home           = document.getElementById("HomePhone"),
        fax            = document.getElementById("FaxNumber"),
        pager          = document.getElementById("PagerNumber"),
        mobile         = document.getElementById("CellularNumber"),
        workLabel      = work.parentNode.previousSibling;
    // then replace all phone labels and remove the access keys
    if (!workLabel) {
      newDialog = true;
      workLabel = work.previousSibling;
    }
    if (showPhoneTypes) {
      if (swap) {
        try {
          // swap pager and mobile phone textboxes and values
          pager = document.getElementById("PagerNumber");
          pager.setAttribute("id", "tmp");
          var pagerValue = pager.value,
              mobile     = document.getElementById("CellularNumber");
          mobile.setAttribute("id", "PagerNumber");
          pager.setAttribute("id", "CellularNumber");
          pager.value = mobile.value;
          mobile.value = pagerValue;
        }
        catch (e1) {
          gContactSync.alertError("Unable to swap pager and mobile number values\n" + e1);
        }
      }

      try {
        workLabel.value = gContactSync.StringBundle.getStr("first");
        workLabel.setAttribute("accesskey", "");
        var homeLabel = newDialog ? home.previousSibling
                                  : home.parentNode.previousSibling;
        homeLabel.value = gContactSync.StringBundle.getStr("second");
        homeLabel.setAttribute("accesskey", "");
        var faxLabel = newDialog ? fax.previousSibling
                                 : fax.parentNode.previousSibling;
        faxLabel.value = gContactSync.StringBundle.getStr("third");
        faxLabel.setAttribute("accesskey", "");
        pager = document.getElementById("PagerNumber");
        var pagerLabel = newDialog ? pager.previousSibling
                                   : pager.parentNode.previousSibling;
        pagerLabel.value = gContactSync.StringBundle.getStr(swap ? "fifth" : "fourth");
        pagerLabel.setAttribute("accesskey", "");
        mobile = document.getElementById("CellularNumber");
        var mobileLabel = newDialog ? mobile.previousSibling
                                    : mobile.parentNode.previousSibling;
        mobileLabel.value = gContactSync.StringBundle.getStr(swap ? "fourth" : "fifth");
        mobileLabel.setAttribute("accesskey", "");
      }
      catch (ex2) {
        gContactSync.alertError("Unable to replace phone labels and remove access keys\n" + ex2);
      }
    }
    else {
      // TODO - replace the Sixth and Seventh labels
    }
    var phoneTypes = gContactSync.gdata.contacts.PHONE_TYPES;
    try {
      // Add a Google Voice menuitem
      phoneTypes.push("grandcentral");
      
      // setup the types for the phone numbers
      var workBox = work.parentNode;
      this.addMenuItems(workBox, phoneTypes, "WorkPhoneType", "work")
          .collapsed = !showPhoneTypes;
      var homeBox = home.parentNode;
      this.addMenuItems(homeBox, phoneTypes, "HomePhoneType", "home")
          .collapsed = !showPhoneTypes;
      var faxBox = fax.parentNode;
      this.addMenuItems(faxBox, phoneTypes, "FaxNumberType", "work_fax")
          .collapsed = !showPhoneTypes;
      var mobileBox = mobile.parentNode;
      this.addMenuItems(mobileBox, phoneTypes, "CellularNumberType", "mobile")
          .collapsed = !showPhoneTypes;
      var pagerBox = pager.parentNode;
      this.addMenuItems(pagerBox, phoneTypes, "PagerNumberType", "pager")
          .collapsed = !showPhoneTypes;
      var homeFaxBox = document.getElementById("HomeFaxNumber").parentNode;
      this.addMenuItems(homeFaxBox, phoneTypes, "HomeFaxNumberType", "home_fax")
          .collapsed = !showPhoneTypes;
      var otherNumberBox = document.getElementById("OtherNumber").parentNode;
      this.addMenuItems(otherNumberBox, phoneTypes, "OtherNumberType", "other")
          .collapsed = !showPhoneTypes;
    }
    catch (ex3) {
      gContactSync.alertError("Unable to setup phone number types\n" + ex3);
    }
    
    // Add the website types
    var websiteTypes = gContactSync.gdata.contacts.WEBSITE_TYPES;
    var site1Box = document.getElementById("WebPage1").parentNode;
    this.addMenuItems(site1Box, websiteTypes, "WebPage1Type", "work");
    var site2Box = document.getElementById("WebPage2").parentNode;
    this.addMenuItems(site2Box, websiteTypes, "WebPage2Type", "home");
    if (newDialog) {
      // rename the hidden phone number field IDs
      try {
        document.getElementById("HomeFaxNumber").id     = "OldHomeFaxNumber";
        document.getElementById("HomeFaxNumberType").id = "OldHomeFaxNumberType";
        document.getElementById("OtherNumber").id       = "OldOtherNumber";
        document.getElementById("OtherNumberType").id   = "OldOtherNumberType";
      }
      catch (e) {}
      try {
        // change the width of the phone numbers
        var phoneIDs = ["HomePhone", "WorkPhone", "CellularNumber", "FaxNumber",
                        "PagerNumber"];
        for (var i = 0; i < phoneIDs.length; i++) {
          var elem = document.getElementById(phoneIDs[i]);
          if (!elem) continue;
          elem.setAttribute("width", "150px");
        }
        // add the sixth and seventh numbers below 1 - 5
        var sixthNum   = this.setupNumBox("HomeFaxNumber",
                                          gContactSync.StringBundle.getStr("sixth")),
            seventhNum = this.setupNumBox("OtherNumber",
                                     gContactSync.StringBundle.getStr("seventh"));
        pager.parentNode.parentNode.appendChild(sixthNum);
        this.addMenuItems(sixthNum, phoneTypes, "HomeFaxNumberType", "home_fax")
          .collapsed = !showPhoneTypes;
        pager.parentNode.parentNode.appendChild(seventhNum);
        this.addMenuItems(seventhNum, phoneTypes, "OtherNumberType", "other")
          .collapsed = !showPhoneTypes;
        
        // Add the relation fields
        try {
          document.getElementById("relationFields").removeAttribute("hidden");
          var relationTypes = [""];
          // copy the relation types over
          for (i in gContactSync.gdata.contacts.RELATION_TYPES) {
            relationTypes.push(i);
          }
          var groupbox = document.getElementById("relationsGroupBox");
          for (var i = 0; i < gContactSync.Preferences.mSyncPrefs.numRelations.value; i++) {
            var relationBox = document.createElement("hbox");
            var spacer = document.createElement("spacer");
            spacer.setAttribute("flex", 1);
            relationBox.appendChild(spacer);
            var relationText = document.createElement("textbox");
            relationText.id = "Relation" + i;
            relationText.setAttribute("class", "uri-element");
            relationText.setAttribute("width", "180px");
            relationBox.appendChild(relationText);
            groupbox.appendChild(relationBox);
            this.addMenuItems(relationBox, relationTypes, "Relation" + i + "Type", "", gContactSync.StringBundle.getStr("relationWidth"));
          }
        }
        catch (ex5) {
          gContactSync.LOGGER.LOG_WARNING("Could not add the relation fields.", ex5);
        }
      }
      catch (ex6) {
        gContactSync.alertError("Unable to setup the extra tabs\n" + ex6);
      }
    }
    // if this is the old dialog, show the extra phone numbers
    else {
      try {
        // move the address descriptions below the addresses (rather than beside)
        var gbox = document.getElementById("addressDescGroupBox");
        if (gbox) {
          var parent = gbox.parentNode;
          parent.removeChild(gbox);
          parent.parentNode.firstChild.appendChild(gbox);
        }
        document.getElementById("numbersGroupBox").removeAttribute("hidden");
      }
      catch (e) {
        gContactSync.LOGGER.LOG_WARNING("Unable to move addressDescGroupBox" +
                                            " or remove hidden from numbersGB", e);
      }
    }
    
    // if this is a read-only card, make added elements disabled
    // the menulists are already taken care of
    // TODO update CardDialogOverlay...
    if (gContactSync.CardDialogOverlay.mDisabled) {
      document.getElementById("ThirdEmail").readOnly       = true;
      document.getElementById("FourthEmail").readOnly      = true;
      document.getElementById("HomeFaxNumber").readOnly    = true;
      document.getElementById("OtherNumber").readOnly      = true;
      document.getElementById("Relation").readOnly         = true;
      document.getElementById("Anniversary").readOnly      = true;
    }

    // Set the height of the Notes field
    var notesElem = document.getElementById("Notes");
    if (notesElem && gContactSync.Preferences.mSyncPrefs.notesHeight.value) {
      notesElem.style.height = gContactSync.Preferences.mSyncPrefs.notesHeight.value;
    }

    // Update the size of the dialog
    window.sizeToContent();

    RegisterSaveListener(gContactSync.CardDialogOverlay.checkAndSetCardValues);
    // get the extra card values
    this.GetCardValues(gEditCard.card, document);
  },
  /**
   * Gets the parent node of an element with the given ID.
   * If there is no element with the given ID then this function will return
   * null.
   * @param aID The ID of the element whose parent node is returned.
   * @returns {XULElement} The parentNode of the element with the given ID.
   */
  getBox: function CardDialogOverlay_getBox(aID) {
    var elem = document.getElementById(aID);
    if (elem && elem.tagName === "emailaddress-input") { // Postbox
      return elem;
    }
    return elem ? elem.parentNode : null;
  },
  /**
   * Adds the e-mail type menulist to Postbox's emailaddress-input element.
   * This also overrides the addRow method to add the type menulist to
   * future emailaddress-input elements (and calls the original addRow)
   * @param aElem The emailaddress-input element.
   * @returns {boolean} True if the application is Postbox and the menulist was
   *                    added.
   */
  addPostboxEmailType: function CardDialogOverlay_addPBEmailType(aElem) {
    if (!aElem || aElem.tagName !== "emailaddress-input") {
      return false;
    }
    return true;
  },
  /**
   * Sets the attributes added by this extension as the value in the textbox or
   * drop down menu in aDoc whose ID is identical to the attribute's name.
   * @param aCard  {nsIAbCard} The card to set the values for.
   * @param aDoc   {Document Object} The document.
   */
  checkAndSetCardValues: function CardDialogOverlay_checkAndSetCardValues(aCard, aDoc) {
    var contact = new gContactSync.TBContact(aCard);
    var existingTypes = {
      "WorkPhoneType":      {},
      "HomePhoneType":      {},
      "FaxNumberType":      {},
      "CellularNumberType": {},
      "PagerNumberType":    {}
    };
    // iterate through all the added attributes and types and set the card's value
    // for each one of them
    for (var attr in gContactSync.gAttributes) {
      try {
        // if the element exists, set the card's value as its value
        var elem = aDoc.getElementById(attr);
        if (elem) {
          // I do not know why this is necessary, but it seems to be the only
          // way to get the value correct in TB 2...
          if (attr === "HomeFaxNumberType" || attr === "OtherNumberType") {
            elem.value = elem.getAttribute("value");
          }
          gContactSync.LOGGER.VERBOSE_LOG("Attribute: '" + attr + "' - Value: '" + elem.value + "'");
          contact.setValue(attr, elem.value);
        }
      }
      catch (e) {
        gContactSync.alertError("Error in gContactSync.checkAndSetCardValues: " + attr + "\n" + e);
      }
    }

    // ensure that every contact edited through this dialog has at least a dummy
    // e-mail address if necessary
    var primEmailElem = aDoc.getElementById("PrimaryEmail");
    if (!primEmailElem.value && gEditCard.abURI) {
      // if it is a new contact it isn't already in any lists
      // Check if it is in any mailing lists.  If so, force a dummy address
      // When fetching lists, do not get the contacts (if it is found there is
      // no need to get the contacts in every list)
      try {
        var tbAB = gContactSync.GAbManager.getAbByURI(gEditCard.abURI);
        var dummyEmailNeeded = tbAB.isMailList;
        if (!dummyEmailNeeded) {
          var lists = tbAB ? new gContactSync.GAddressBook(tbAB).getAllLists(true) : [];
          for (var i in lists) {
            // if the list does have the contact then make sure it gets a dummy
            // e-mail address regardless of the preference
            // do not check the PrimaryEmail address in hasContact since it is now
            // empty
            if (lists[i].hasContact(contact)) {
              dummyEmailNeeded = true;
              break;
            }
          }
        }
        if (dummyEmailNeeded) {
          primEmailElem.value = gContactSync.makeDummyEmail(contact.mContact, true);
          gContactSync.alert(gContactSync.StringBundle.getStr("dummyEmailAdded") + "\n" + primEmailElem.value);
        }
      } catch (e) {alert("Error checking if the contact needs a dummy e-mail address\n" + e);}
    }
  },
  /**
   * A method that gets all of the attributes added by this extension and sets
   * the value of the textbox or drop down menu in aDoc whose ID is identical to
   * the attribute's name.
   * @param aCard {nsIAbCard} The card to get the values from.
   * @param aDoc  {Document Object} The document.
   */
  GetCardValues: function CardDialogOverlay_GetCardValues(aCard, aDoc) {
    // iterate through all the added type elements and get the card's value for
    // each one of them to set as the value for the element
    for (var attr in gContactSync.gAttributes) {
      try {
        var elem = aDoc.getElementById(attr);
        // if the element exists, set its value as the card's value
        if (elem) {
          var value = aCard.getProperty(attr, null);
          // set the element's value if attr isn't a type OR it is a type and
          // the card's value for the attribute isn't null or blank
          if (attr.indexOf("Type") == -1 || (value && value != "")) {
            elem.value = value;
            // If it is a menulist and the label is still blank (ie custom label)
            // then add it as a new menuitem
            if (elem.tagName === "menulist" && !elem.label) {
              var item = document.createElement("menuitem");
              item.setAttribute("value", value);
              item.setAttribute("label", value);
              elem.menupopup.appendChild(item);
              elem.value = value;
            }
          }
        }
      } catch (e) { gContactSync.alertError("Error in gContactSync.GetCardValues: " + attr + "\n" + e); }
    }

    // In TB 10 the way photos are saved changed and now requires two copies of
    // each photo.  One persistent copy is required as TB will copy it to the
    // Photos directory and delete the previous copy when the contact is edited.
    // gContactSync only saves one copy so TB deletes the original on the first
    // edit of the contact then TB fails to copy from the original in future
    // edits of the contact.
    // As a workaround check if the photo at PhotoURI still exists.
    // If it doesn't exist then update it to point to the photo at PhotoName.
    var photoURI = aCard.getProperty("PhotoURI", "");
    var photoType = aCard.getProperty("PhotoType", "");
    if (photoURI && photoType === "file") {
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
      var uriFile = ios.newURI(photoURI, null, null)
                       .QueryInterface(Components.interfaces.nsIFileURL)
                       .file;
      if (!uriFile.exists()) {
        var photoName = aCard.getProperty("PhotoName", "");
        gContactSync.LOGGER.VERBOSE_LOG("Photo workaround for URI: " +
                                            photoURI + "...Name: " + photoName);
        var photoNameFile = Components.classes["@mozilla.org/file/directory_service;1"]
                                      .getService(Components.interfaces.nsIProperties)
                                      .get("ProfD", Components.interfaces.nsIFile);
        photoNameFile.append("Photos");
        photoNameFile.append(photoName);
        if (photoNameFile.exists()) {
          var newPhotoURI = ios.newFileURI(photoNameFile).spec;
          gContactSync.LOGGER.VERBOSE_LOG("New URI: " + newPhotoURI);
          aCard.setProperty("PhotoURI", newPhotoURI);
          loadPhoto(aCard);
          setCardEditorPhoto(photoType, aCard);
        }
      }
    }
  
    if (gContactSync.isDummyEmail(aDoc.getElementById("PrimaryEmail").value))
      aDoc.getElementById("PrimaryEmail").value = null;
  },
  /**
   * Sets up a type menu list element with a menuitem for each string in the
   * array.
   * @param aBox   {XUL Box} The box element to which this menu list is added.
   * @param aArray {array}  The array of values to set for the menuitems.  There
   *                        must be a string in the string bundle with the same
   *                        name as the value.
   * @param aID    {string} The ID for this menu list, which should be the name
   *                        of the attribute with Type added to the end, such as
   *                        WorkNumberType
   * @param aValue {string} The default value to set for this list.
   * @param aWidth {int}    The maximum width, if any.
   *
   * @returns {XULElement}  The menulist element.
   */
  addMenuItems: function CardDialogOverlay_addMenuItems(aBox, aArray, aID, aValue, aWidth) {
    if (!aBox) {
      return false;
    }
    var menuList = document.createElement("menulist");
    menuList.setAttribute("id", aID);
    var menuPopup = document.createElement("menupopup");
    // put the default value first in the menupopup, if possible
    var index = aArray.indexOf(aValue);
    var elem;
    // Make sure the default value is in aArray
    if (index == -1) {
      aArray.push(aValue);
      index = aArray.length - 1;
    }
    if (index > -1 && index < aArray.length) {
      elem = document.createElement("menuitem");
      elem.setAttribute("value", aValue);
      elem.setAttribute("label", gContactSync.StringBundle.getStr(aValue ? aValue : "blank"));
      aArray[index] = null;
      menuPopup.appendChild(elem);
    }
    // then add the other values
    for (var i = 0; i < aArray.length; i++) {
      if (!aArray[i]) { // if this element is null it was the default value
        aArray[i] = aValue; // so restore its value and skip adding it again
        continue;
      }
      elem = document.createElement("menuitem");
      elem.setAttribute("value", aArray[i]);
      elem.setAttribute("label", gContactSync.StringBundle.getStr(aArray[i]));
      menuPopup.appendChild(elem);
    }
    menuList.setAttribute("sizetopopup", "always");
    if (aWidth) {
      menuList.setAttribute("width", aWidth);
      menuList.style.width = aWidth;
      menuList.style.maxWidth = aWidth;
    }
    // add the popup to the menu list
    menuList.appendChild(menuPopup);
    // disable the menu list if this card is read-only
    menuList.setAttribute("disabled", gContactSync.CardDialogOverlay.mDisabled);
    // add the menu list to the box
    aBox.appendChild(menuList);
    return menuList;
  },
  /**
   * Adds an hbox containing a label and textbox for a phone number.
   * @param aID    {string} The ID for the textbox.
   * @param aLabel {string} The text for the textbox's label.
   */
  setupNumBox: function CardDialogOverlay_setupNumBox(aID, aLabel) {
    var box = document.createElement("hbox");
    box.setAttribute("align", "center");
    var spacer = document.createElement("spacer");
    spacer.setAttribute("flex", 1);
    box.appendChild(spacer);
    var label = document.createElement("label");
    label.setAttribute("control", aID);
    label.setAttribute("value", aLabel);
    box.appendChild(label);
    var textbox = document.createElement("textbox");
    textbox.setAttribute("id", aID);
    textbox.setAttribute("class", "PhoneEditWidth");
    if (gContactSync.CardDialogOverlay.mDisabled)
      textbox.setAttribute("readonly", true);
    else if (textbox.hasAttribute("readonly"))
      textbox.removeAttribute("readonly");
    textbox.setAttribute("width", "150px");
    box.appendChild(textbox);
    return box;
  }
};
