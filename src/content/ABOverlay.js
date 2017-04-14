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
 * Portions created by the Initial Developer are Copyright (C) 2008-2017
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
  /** Initializes the ABOverlay class when the window has finished loading */
  function gCS_abOverlayLoadListener() {
    window.removeEventListener("load", gCS_abOverlayLoadListener, false);
    gContactSync.ABOverlay.initialize();
  },
false);

/**
 * The Address Book window overlay overrides certain functions to add
 * gContactSync fields to the address book.
 * @class
 */
gContactSync.ABOverlay = {
  /**
   * The number of times this overlay has attempted to load while waiting
   * for its dependencies to load.
   */
  mLoadNumber: 0,
  /**
   * Called when the overlay is loaded and overrides some methods to add
   * gContactSync fields.
   */
  initialize: function ABOverlay_initialize() {

    // if it isn't finished loading yet wait another 200 ms and try again
    if (!("GAbManager" in gContactSync)) {
      // if it has tried to load more than 50 times something is wrong, so quit
      if (gContactSync.ABOverlay.mLoadNumber < 50) {
        setTimeout(gContactSync.ABOverlay.initialize, 200);
      } else {
        throw "Error - gContactSync.GAbManager not defined.\nAbManager: " +
            gContactSync.AbManager + "\nGAbManager: " + gContactSync.GAbManager;
      }
      gContactSync.ABOverlay.mLoadNumber++;
      return;
    }
    // determine if this is before or after Bug 413260 landed
    var card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                         .createInstance(Components.interfaces.nsIAbCard);
    gContactSync.ABOverlay.mBug413260 = card.getProperty ? true : false;

    gContactSync.originalOnLoadCardView = OnLoadCardView;
    OnLoadCardView = gContactSync.ABOverlay.myOnLoadCardView;
    // add the extra attributes as tree columns to show and
    gContactSync.ABOverlay.addTreeCols(); // sort by in the results pane if this is after 413260 
    // override the onDrop method of abDirTreeObserver
    // so when a card is copied the extra attributes are copied with it
    if (gContactSync.Preferences.mSyncPrefs.overrideCopy.value) {
      abDirTreeObserver.origOnDrop = abDirTreeObserver.onDrop;
      abDirTreeObserver.onDrop = gContactSync.myOnDrop;
    }
    // override the display card view pane
    gContactSync.originalDisplayCardViewPane = DisplayCardViewPane;
    DisplayCardViewPane = gContactSync.ABOverlay.myDisplayCardViewPane;
    // Add a reset menuitem to the directory tree context menu
    if (gContactSync.Preferences.mSyncPrefs.addReset.value) {
      gContactSync.ABOverlay.addResetContext();
    }
    // override the ab results tree function
    //gContactSync.originalSetAbView = SetAbView;
    //SetAbView = gContactSync.SetAbView;
    // Fix the style for description elements accidentally set in the
    // Duplicate Contacts Manager extension
    // https://www.mozdev.org/bugs/show_bug.cgi?id=21883
    if (gContactSync.Preferences.mSyncPrefs.fixDupContactManagerCSS.value)
      gContactSync.ABOverlay.fixDescriptionStyle();
    // load the card view (required by seamonkey)
    if (document.getElementById("ab-menubar"))
      gContactSync.ABOverlay.myOnLoadCardView();
  },
  /**
   * Adds treecol elements to the address book results tree that shows cards in
   * the currently selected directory.  These treecols allow the user to show
   * and sort by extra attributes that are added by this extension.  This will
   * only work after Bug 413260 landed, so in Thunderbird 3.0b1pre and after.
   */
  addTreeCols: function ABOverlay_addTreeCols() {
    // get the treecols XUL element
    var treeCols = document.getElementById("abResultsTreeCols");
    if (!treeCols || !treeCols.appendChild)
      return;
    // if Bug 413260 isn't applied in this version of TB, or if the pref was
    // changed to false, then stop here
    if (!gContactSync.ABOverlay.mBug413260 || !gContactSync.Preferences.mSyncPrefs.newColLabels.value)
      return;
    // get the added attributes
    var ids = gContactSync.ContactConverter.getExtraSyncAttributes(false),
        id, splitter, treeCol;
    // iterate through every added attribute and add a treecol for it unless
    // it is a postal address
    for (i = 0, length = ids.length; i < length; i++) {
      id = ids[i];
      if (id.indexOf("Type") !== -1)
        continue; // skip addresses and Types
      // make and add the splitter first
      splitter = document.createElement("splitter");
      splitter.setAttribute("class", "tree-splitter");
      treeCols.appendChild(splitter);
      // make the new treecol
      treeCol = document.createElement("treecol");
      // then set it up with the ID and other attributes
      treeCol.setAttribute("id",      id);
      treeCol.setAttribute("class",   "sortDirectionIndicator");
      treeCol.setAttribute("hidden",  "true");
      treeCol.setAttribute("persist", "hidden ordinal width sortDirection");
      treeCol.setAttribute("flex",    "1");
      treeCol.setAttribute("label",   gContactSync.StringBundle.getStr(id));
      // append it to the treecols element
      treeCols.appendChild(treeCol);
    }
    
    // Fix/rename phone number columns if the phoneColLabels is on AND phone
    // number types have been added.
    if (gContactSync.Preferences.mSyncPrefs.phoneColLabels.value &&
        gContactSync.Preferences.mSyncPrefs.phoneTypes.value) {
      // fix/rename the existing phone numbers
      var arr = ["WorkPhone", "HomePhone", "FaxNumber", "CellularNumber",
                 "PagerNumber", "HomeFaxNumber", "OtherNumber"];
      // the strings from the string bundle
      var arr2 = ["firstNumber", "secondNumber", "thirdNumber", "fourthNumber",
                  "fifthNumber", "sixthNumber", "seventhNumber"];
      var elem;
      for (var i = 0; i < arr.length; i++) {
        elem = document.getElementById(arr[i]);
        if (!elem) {
          continue;
        }
        // remove it
        treeCols.removeChild(elem);
        elem.setAttribute("label", gContactSync.StringBundle.getStr(arr2[i]));
        // and then add it to the end of the treecols element
        treeCols.appendChild(elem);
      }
    }
  },
  /**
   * Modifies the SetAbView function.  Unused
   */
  // NOTE - this function can break search and more if not overridden properly
  mySetAbView: function ABOverlay_mySetAbView(aURI, aSearchView, aSortCol, aSortDir) {
    // call the original
    gContactSync.originalSetAbView.apply(this, arguments);
    // TODO fix this
    /*
    var children =  gAbResultsTree.getElementsByAttribute("ondraggesture", "nsDragAndDrop.startDrag(event, abResultsPaneObserver);");
    var treeChildren = children[0];
    var str = "";
    for (var i = 0; i < children[0].children.length; i++) {
      str += children[0].children[i] + "\n";
    }
    gContactSync.alert(str + "\n" + children[0].children);
    */
    /*for (var i in gAbResultsTree.children[0])
      str += i + "\n";
    str += "1:\n";
    for (var i in gAbResultsTree.children[1])
      str += i + "\n";
    gContactSync.alert(str);*/
    // now find and hide any dummy e-mail addresses
  },
  /**
   * Updates the Card View pane boxes and headers for whether or not they should
   * be visible based on additional attributes added by gContactSync.
   * Links the third and fourth e-mail address as well as the "other" address.
   * Should be set to override the DisplayCardViewPane function in
   * abCardViewOverlay.js.  Requires that the original function should be set as
   * the gContactSync.originalDisplayCardViewPane variable.
   * @param aCard {nsIAbCard} The card being viewed.
   */
  myDisplayCardViewPane: function ABOverlay_myDisplayCardViewPane(aCard) {
    // call the original first
    gContactSync.originalDisplayCardViewPane.apply(this, arguments);
    if (aCard.isMailList) {
      // collapse all the attributes added
      gContactSync.ABOverlay.hideNodes(gContactSync.ContactConverter.getExtraSyncAttributes(false));
      try {
        // then collapse the e-mail boxes
        cvData.cvThirdEmailBox.collapsed = true;
        cvData.cvFourthEmailBox.collapsed = true;
      } catch(e) {}
      return; // and quit, nothing was added for mail lists
    }
    try {
      var contact;
      
      // If able to get the selected directory then show the lists this contact
      // is in
      if (GetSelectedDirectory === undefined || !cvData.cvLists) {
        contact = new gContactSync.TBContact(aCard, null);
      } else if (GetSelectedDirectory()) {
        
        var ab = (gContactSync.GAbManager.getAllAddressBooks(2))[GetSelectedDirectory()];
        
        if (!ab) {
          // It is a mailing list, truncate everything from the last "/" to
          // get the AB's URI.
          ab = (gContactSync.GAbManager.getAllAddressBooks(2))
                  [GetSelectedDirectory().substring(0,GetSelectedDirectory().lastIndexOf("/"))];
        }
        
        if (!ab) {
          cvData.cvLists.parentNode.collapsed = true;
          contact = new gContactSync.TBContact(aCard, null);
        } else {
          cvData.cvLists.parentNode.collapsed = false;
          contact = new gContactSync.TBContact(aCard, ab);
          
          // Get all lists in this AB, but do NOT get it's contacts yet
          var lists = ab.getAllLists(true);
          var listsWithContact = [];
          
          // Iterate through each list in this AB
          // If the list is "broken" (enumeration through it's contacts fails)
          // then just ignore the error and move on.
          for (var i in lists) {
            lists[i].setIgnoreIfBroken(true);
            lists[i].getAllContacts();
            if (lists[i].hasContact(contact)) {
              listsWithContact.push(lists[i].getName());
            }
            lists[i].setIgnoreIfBroken(false);
          }
          
          cvData.cvLists.data = listsWithContact.join(" | ");
        }
      }
      gContactSync.ABOverlay.showNodes(gContactSync.ContactConverter.getExtraSyncAttributes(false));
      var primaryEmail = gContactSync.GAbManager.getCardValue(aCard,
                                                 gContactSync.dummyEmailName);
      // if the primary e-mail address is the dummy address, hide it
      if (gContactSync.isDummyEmail(primaryEmail)) {
        // TODO recalculate if the contact info box must be collapsed too
        switch (gContactSync.dummyEmailName) {
          case "PrimaryEmail" :
            cvData.cvEmail1Box.collapsed = true;
            break;
          case "SecondEmail" :
            cvData.cvEmail2Box.collapsed = true;
            break;
          default:
            gContactSync.alertError("Error - invalid dummy email name");
        }
      }
      cvData.cvThirdEmailBox.collapsed = false;
      cvData.cvFourthEmailBox.collapsed = false;
      // Contact section (ThirdEmail, FourthEmail)
      var visible     = !cvData.cvbContact.getAttribute("collapsed");
      // don't show the Third and Fourth e-mail addresses in Postbox
      if (!contact.mPostbox) {
        var thirdEmail  = contact.getValue("ThirdEmail");
        var fourthEmail = contact.getValue("FourthEmail");
        visible = HandleLink(cvData.cvThirdEmail, gContactSync.StringBundle.getStr("ThirdEmail"),
                             thirdEmail, cvData.cvThirdEmailBox, "mailto:" +
                             thirdEmail) || visible;
        // Workaround for a bug where the collapsed attributes set here don't
        // seem to get applied
        document.getElementById(cvData.cvThirdEmailBox.id).collapsed = cvData.cvThirdEmailBox.collapsed;
        visible = HandleLink(cvData.cvFourthEmail, gContactSync.StringBundle.getStr("FourthEmail"),
                             fourthEmail, cvData.cvFourthEmailBox, "mailto:" +
                             fourthEmail) || visible;
      }

      cvSetVisible(cvData.cvhContact, visible);
      cvSetVisible(cvData.cvbContact, visible);
 
      // Other section (relations)
      var visible = !cvData.cvhOther.getAttribute("collapsed");
      var relationsArray = [];
      for (var j = 0; j < gContactSync.Preferences.mSyncPrefs.numRelations.value; ++j) {
        relationsArray.push("Relation" + j);
      }
      // Relation fields
      visible = gContactSync.ABOverlay.getVisible(aCard, relationsArray, visible, true);

      // Anniversary
      var day   = gContactSync.GAbManager.getCardValue(aCard, "AnniversaryDay");
      var month = gContactSync.GAbManager.getCardValue(aCard, "AnniversaryMonth");
      var year  = gContactSync.GAbManager.getCardValue(aCard, "AnniversaryYear");
      var dateStr = null;
      if (day > 0 && day < 32 && month > 0 && month < 13) {
        var date = new Date(year, month - 1, day);
        // if the year exists, just use Date.toLocaleString
        if (year) {
          date.setFullYear(year);
          dateStr = date.toLocaleDateString();
        } else {
          var formatStr = "%d-%B";
          try {formatStr = gAddressBookBundle.getString("dateFormatMonthDay");} catch (e) {}
          // if the year doesn't exist, display Month DD (ex. January 01)
          dateStr = date.toLocaleFormat(formatStr);
        }
      } else if (year) {
        dateStr = year;
      }
      visible = cvSetNodeWithLabel(cvData.cvAnniversary,
                                   gContactSync.StringBundle.getStr("anniversary"),
                                   dateStr) || visible;
      cvSetVisible(cvData.cvhOther, visible);
      cvSetVisible(cvData.cvbOther, visible);
      // Phone section (add OtherNumber and HomeFaxNumber)
      // first, add the existing nodes to cvData under a name that actually
      // matches the attribute
      cvData.cvWorkPhone = cvData.cvPhWork;
      cvData.cvHomePhone = cvData.cvPhHome;
      cvData.cvFaxNumber = cvData.cvPhFax;
      cvData.cvCellularNumber = cvData.cvPhCellular;
      cvData.cvPagerNumber = cvData.cvPhPager;
      // then set the value and labels for the new and old phone nodes
      var visible = !cvData.cvhPhone.getAttribute("collapsed");
      visible = gContactSync.ABOverlay.getVisible(aCard, ["WorkPhone", "HomePhone", "FaxNumber",
                                           "CellularNumber", "PagerNumber",
                                           "OtherNumber", "HomeFaxNumber"],
                                   visible, true);
      cvSetVisible(cvData.cvhPhone, visible);
      cvSetVisible(cvData.cvbPhone, visible);

      // Add types to webpages
      var webpageValues = ["WebPage1", "WebPage2"];
      for (var i = 0; i < webpageValues.length; ++i) {
        var value = contact.getValue(webpageValues[i]);
        var type  = contact.getValue(webpageValues[i] + "Type");
        var visible = value && type;
        var elem = cvData["cv" + webpageValues[i] + "Type"];
        cvSetVisible(cvData["cv" + webpageValues[i] + "Type"], visible);
        elem.value = gContactSync.StringBundle.getStr(type);
      }
    } catch(e) { 
        gContactSync.alertError("Error while modifying view pane: " + e);
        gContactSync.LOGGER.LOG_WARNING("Error while modifying the view pane.", e);
    }
  },
  /**
   * Hides all of the nodes based on the array.  The node must be a propery of
   * cvData with the same name as the element in aArray prefixed with a 'cv'.
   * For example, to hide cvData.cvHomeAddress the element would be
   * 'HomeAddress'.
   * @param {array} aArray An array of names as described above.
   */
  hideNodes: function ABOverlay_hideNodes(aArray) {
    for (var i = 0, length = aArray.length; i < length; i++) {
      if (aArray[i].indexOf("Type") != -1)
        continue;
      try {
        cvSetVisible(cvData["cv" + aArray[i]], false);
      }
      catch (e) {
        gContactSync.LOGGER.LOG_WARNING("Error while hiding node '" + aArray[i] + "'", e);
      }
    }
  },
  /**
   * Shows all of the nodes based on the array.  The node must be a propery of
   * cvData with the same name as the element in aArray prefixed with a 'cv'.
   * For example, to show cvData.cvHomeAddress the element would be
   * 'HomeAddress'.
   * @param aArray {array} An array of names as described above.
   */
  showNodes: function ABOverlay_showNodes(aArray) {
    for (var i = 0, length = aArray.length; i < length; i++) {
      if (aArray[i].indexOf("Type") != -1)
        continue;
      try {
        cvSetVisible(cvData["cv" + aArray[i]], true);
      }
      catch (e) {
        gContactSync.LOGGER.LOG_WARNING("Error while showing node '" + aArray[i] + "'", e);
      }
    }
  },
  /**
   * A helper method for myDisplayCardViewPane that iterates through an array of
   * attributes and returns true if at least one of them is present in the given
   * card.
   * @param aCard         {nsIAbCard} The card whose attributes are checked.
   * @param aArray        {array}     The array of attributes to check for in
   *                                  the card.
   * @param aVisible      {boolean}   Optional. True if the element was
   *                                  previously visible.
   * @param aUseTypeLabel {boolean}   Optional.  True if the labels should be
   *                                  the type of the attribute instead of the
   *                                  attribute's name.
   * @returns {boolean} True if at least one attribute in aArray is present in aCard.
   */
  getVisible: function ABOverlay_getVisible(aCard, aArray, aVisible, aUseTypeLabel) {
    var visible = aVisible;
    // return true if the card has the current attribute
    for (var i = 0; i < aArray.length; i++) {
      var attr = aArray[i];
      var value = gContactSync.GAbManager.getCardValue(aCard, attr);
      // get the name of the string to find in the bundle
      var label = aUseTypeLabel ? gContactSync.GAbManager.getCardValue(aCard, attr + "Type")
                                : attr;
      // get the actual string
      // if the label is null (ie aUseTypeLabel was true, but there wasn't a type)
      // then use the attribute's string as a default value
      var str = label && label != "" ? gContactSync.StringBundle.getStr(label)
                                     : gContactSync.StringBundle.getStr(attr);
      visible = cvSetNodeWithLabel(cvData["cv" + attr], str, value) || visible;
    }
    return visible;
  },
  /**
   * Sets up a few nodes and labels in addition to what the OnLoadCardView
   * function does in abCardViewOverlay.js.  Should be run when the Overlay is
   * loaded.
   */
  myOnLoadCardView: function ABOverlay_myOnLoadCardView() {
    if (!gContactSync.originalOnLoadCardView)
      return;
    gContactSync.originalOnLoadCardView.apply(this, arguments);

    // add the <description> elements
    var vbox = document.getElementById("cvbContact");
    // setup the third and fourth e-mail addresses
    var xhtml = "http://www.w3.org/1999/xhtml";
    cvData.cvThirdEmailBox = gContactSync.ABOverlay.makeDescElement("ThirdEmailBox",
                                                                        "CardViewLink");
    cvData.cvThirdEmail = document.createElementNS(xhtml, "html:a");
    cvData.cvThirdEmail.setAttribute("id", "ThirdEmail");
    cvData.cvThirdEmailBox.appendChild(cvData.cvThirdEmail);
    cvData.cvFourthEmailBox = gContactSync.ABOverlay.makeDescElement("FourthEmailBox",
                                                                         "CardViewLink");
    cvData.cvFourthEmail = document.createElementNS(xhtml, "html:a");
    cvData.cvFourthEmail.setAttribute("id", "FourthEmail");
    cvData.cvFourthEmailBox.appendChild(cvData.cvFourthEmail);
    vbox.insertBefore(cvData.cvFourthEmailBox, document.getElementById("cvScreennameBox"));
    vbox.insertBefore(cvData.cvThirdEmailBox, cvData.cvFourthEmailBox);

    // Home section
    cvData.cvbHome.removeChild(cvData.cvHomeWebPageBox);
    cvData.cvHomeWebPageHBox = document.createElement("hbox");
    cvData.cvWebPage2Type = document.createElement("description");
    cvData.cvWebPage2Type.setAttribute("id", "WebPage2Type");
    cvData.cvHomeWebPageHBox.appendChild(cvData.cvHomeWebPageBox);
    cvData.cvHomeWebPageHBox.appendChild(cvData.cvWebPage2Type);
    cvData.cvbHome.appendChild(cvData.cvHomeWebPageHBox);

    // Work section
    cvData.cvJobDescription = gContactSync.ABOverlay.makeDescElement("JobDescription", "CardViewText");
    cvData.cvCompanySymbol  = gContactSync.ABOverlay.makeDescElement("CompanySymbol",  "CardViewText");
    vbox = document.getElementById("cvbWork");
    // Add the job description after the job title
    vbox.insertBefore(cvData.cvJobDescription, cvData.cvJobTitle.nextSibling);
    // Add the company symbol after the company name
    vbox.insertBefore(cvData.cvCompanySymbol, cvData.cvCompany.nextSibling);

    cvData.cvbWork.removeChild(cvData.cvWorkWebPageBox);
    cvData.cvWorkWebPageHBox = document.createElement("hbox");
    cvData.cvWebPage1Type = document.createElement("description");
    cvData.cvWebPage1Type.setAttribute("id", "WebPage1Type");
    cvData.cvWorkWebPageHBox.appendChild(cvData.cvWorkWebPageBox);
    cvData.cvWorkWebPageHBox.appendChild(cvData.cvWebPage1Type);
    cvData.cvbWork.appendChild(cvData.cvWorkWebPageHBox);

    // Other section    
    vbox = document.getElementById("cvbOther");
    var otherHbox = document.createElement("hbox");
    var otherVbox = document.createElement("vbox");
    otherVbox.setAttribute("flex", "1");
    // Relation fields)
    for (var i = 0; i < gContactSync.Preferences.mSyncPrefs.numRelations.value; ++i) {
      cvData["cvRelation" + i] = gContactSync.ABOverlay.makeDescElement("Relation" + i, "CardViewText");
      otherVbox.appendChild(cvData["cvRelation" + i]);
    }
    vbox.appendChild(otherVbox);

    // Anniversary
    cvData.cvAnniversary = gContactSync.ABOverlay.makeDescElement("Anniversary", "CardViewText");
    vbox.insertBefore(cvData.cvAnniversary, document.getElementById("cvBirthday").nextSibling);

    // Other Number and HomeFaxNumber
    cvData.cvOtherNumber = gContactSync.ABOverlay.makeDescElement("OtherNumber", "CardViewText");
    cvData.cvHomeFaxNumber = gContactSync.ABOverlay.makeDescElement("HomeFaxNumber", "CardViewText");
    vbox = document.getElementById("cvbPhone");
    vbox.appendChild(cvData.cvHomeFaxNumber);
    vbox.appendChild(cvData.cvOtherNumber);
    
    // Add a description where the mailing lists the selected contact is in
    // will appear, if possible
    if (GetSelectedDirectory !== undefined) {
      var desc = document.createElement("description");
      cvData.cvLists = document.createTextNode("1");
      desc.style.paddingTop = "6px";
      desc.appendChild(cvData.cvLists);
      vbox = document.getElementById("CardViewInnerBox");
      vbox.insertBefore(desc, document.getElementById("CardTitle").nextSibling);
    } else {
      cvData.cvLists = null;
    }
  },
  /**
   * Makes and returns a <description> element of the given class and with an ID
   * of aName with a prefix of "cv"
   * @param aName  {string} The ID of the element that will be prefixed with a
   *                        "cv"
   * @param aClass {string} The class of the element.
   * @returns {XML} A new <description> element.
   */
  makeDescElement: function ABOverlay_makeDescElement(aName, aClass) {
    var elem = document.createElement("description");
    elem.setAttribute("class", aClass);
    elem.setAttribute("id", "cv" + aName);
    return elem;
  },
  /**
   * Adds a 'Reset' menuitem to the Address Book contaxt menu for the list on
   * the left side of the Address Book window.
   */
  addResetContext: function ABOverlay_addResetContext() {
    var replaceFrom = document.createElement("menuitem"),
        replaceTo   = document.createElement("menuitem"),
        syncNow     = document.createElement("menuitem"),
        separator   = document.createElement("menuseparator");

    replaceFrom.id  = "dirTreeContext-replaceFrom";
    replaceTo.id    = "dirTreeContext-replaceTo";
    syncNow.id      = "dirTreeContext-syncNow";
    replaceFrom.setAttribute("label",       gContactSync.StringBundle.getStr("reset"));
    replaceFrom.setAttribute("accesskey",   gContactSync.StringBundle.getStr("resetKey"));
    replaceFrom.addEventListener("command", gContactSync.ABOverlay.resetSelectedAB, false);
    replaceTo.setAttribute("label",         gContactSync.StringBundle.getStr("replaceTo"));
    replaceTo.setAttribute("accesskey",     gContactSync.StringBundle.getStr("replaceToKey"));
    replaceTo.addEventListener("command",   gContactSync.ABOverlay.replaceToSelectedAB, false);
    syncNow.setAttribute("label",           gContactSync.StringBundle.getStr("syncNow"));
    syncNow.setAttribute("accesskey",       gContactSync.StringBundle.getStr("syncNowKey"));
    syncNow.addEventListener("command",     gContactSync.ABOverlay.syncSelectedAB, false);
    document.getElementById("dirTreeContext").appendChild(separator);
    document.getElementById("dirTreeContext").appendChild(replaceFrom);
    document.getElementById("dirTreeContext").appendChild(replaceTo);
    document.getElementById("dirTreeContext").appendChild(syncNow);
  },
  /**
   * Returns a GAddressBook object for the currently selected address book.
   * @returns {GAddressBook} The currently selected address book.
   */
  getSelectedAB: function ABOverlay_getSelectedAB() {
    var dirTree   = document.getElementById("dirTree");
    var targetURI = 0;
    try {
      // Pre Bug 422845
      targetURI = dirTree.builderView.getResourceAtIndex(dirTree.currentIndex).Value;
    } catch (e) {
      // Post Bug 422845
      targetURI = gDirectoryTreeView.getDirectoryAtIndex(gDirTree.currentIndex).URI;
    }
    return targetURI;
  },
  /**
   * Resets the currently selected address book after showing a confirmation
   * dialog.
   */
  resetSelectedAB: function ABOverlay_resetSelectedAB() {
    var ab = new gContactSync.GAbManager.getGAbByURI(gContactSync.ABOverlay.getSelectedAB());
    // make sure the AB was not already reset
    if (ab.mPrefs.reset === "true") {
      gContactSync.alert(gContactSync.StringBundle.getStr("alreadyReset"));
      return;
    }
    // show a confirm dialog to make sure the user knows what's about to happen
    if (gContactSync.confirm(gContactSync.StringBundle.getStr("resetConfirm2"))) {
      if (ab.reset()) {
        var restartStr = gContactSync.StringBundle.getStr("pleaseRestart");
        gContactSync.Preferences.setSyncPref("needRestart", true);
        gContactSync.ABOverlay.setStatusBarText(restartStr);
        gContactSync.alertError(restartStr);
      }
    }
  },
  /**
   * Updates the LastModifiedDate of all contacts in the selected AB.
   */
  replaceToSelectedAB: function ABOverlay_replaceToSelectedAB() {
    var ab = new gContactSync.GAbManager.getGAbByURI(gContactSync.ABOverlay.getSelectedAB());
    ab.replaceToServer();
    gContactSync.alert(gContactSync.StringBundle.getStr("replaceToComplete"));
  },

  /**
   * Syncs only the selected address book.
   */
  syncSelectedAB: function ABOverlay_syncSelectedAB() {
    var ab = new gContactSync.GAbManager.getGAbByURI(gContactSync.ABOverlay.getSelectedAB());
    var username = ab.mPrefs.Username;
    if (username && username.toLowerCase() !== "none") {
      gContactSync.LOGGER.VERBOSE_LOG("\n***Synchronizing selected AB: " + ab.getName() + "***\n");
      gContactSync.Sync.begin(true, [{username: username, ab: ab}]);
    } else {
      var invalidABErrorStr = gContactSync.StringBundle.getStr("syncNowError");
      gContactSync.alertWarning(invalidABErrorStr);
    }
  },
  /**
   * Fixes the description style as set (accidentally?) by the
   * Duplicate Contacts Manager extension in duplicateContactsManager.css
   * It appears that the new description style was applied to addressbook.xul
   * on accident when it was meant only for duplicateEntriesWindow.xul
   *
   * @returns {boolean} true if the description style was removed.
   */
  fixDescriptionStyle: function ABOverlay_fixDescriptionStyle() {
    // Make sure this is addressbook.xul only
    if (document.location && document.location.href.indexOf("/addressbook.xul") != -1) {
      var ss = document.styleSheets;
      var s;
      // Iterate through each stylesheet and look for one from
      // Duplicate Contacts Manager
      for (var i = 0; i < ss.length; i++) {
        // If this is duplicateContactsManager.css then remove the
        // description style
        if (ss[i] && ss[i].href == "chrome://duplicatecontactsmanager/skin/duplicateContactsManager.css") {
          var rules = ss[i].cssRules;
          for (var j = 0; j < rules.length; j++) {
            if (rules[j].selectorText == "description") {
              ss[i].deleteRule(j);
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}
