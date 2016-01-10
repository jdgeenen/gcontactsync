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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
 *   Josh Geenen <gcontactsync@pirules.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
 * Meant to override the code in the onDrop method of abDirTreeObserver (an
 * instance of nsIXULTreeBuilderObserver), which is called when the user drops
 * one or more cards.  The code is a modified version of onDrop found in
 * mailnews/addrbook/resources/abDragDrop.js
 * It's purpose is to copy over extra attributes that this extension adds to
 * address book cards and to work around bugs.
 *
 * @param row          The row
 * @param orientation  {int} An integer specifying on/after/before the given row
 */
com.gContactSync.myOnDrop = function gCS_myOnDrop(row, orientation) {
  var dragSession = dragService.getCurrentSession();
  if (!dragSession)
    return;
  // get the attributes added by this extension
  var attributes    = com.gContactSync.ContactConverter.getExtraSyncAttributes(false),
      attributesLen = attributes.length,
      trans         = Components.classes["@mozilla.org/widget/transferable;1"]
                                .createInstance(Components.interfaces.nsITransferable);
  trans.addDataFlavor("moz/abcard");

  var targetURI      = 0;
  try {
    // Pre Bug 422845
    targetURI        = dirTree.builderView.getResourceAtIndex(row).Value;
  } catch (e) {
    // Post Bug 422845
    targetURI        = gDirectoryTreeView.getDirectoryAtIndex(row).URI;
  }
  var srcURI         = GetSelectedDirectory(),
      toDirectory    = GetDirectoryFromURI(targetURI),
      srcDirectory   = GetDirectoryFromURI(srcURI);
  // iterate through each dropped item from the session
  for (var i = 0, dropItems = dragSession.numDropItems; i < dropItems; i++) {
    dragSession.getData(trans, i);
    var dataObj       = {},
        flavor        = {},
        len           = {},
        needToRefresh = false;
    try {
      trans.getAnyTransferData(flavor, dataObj, len);
      dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
    }
    catch (ex) { continue; }
    var transData = dataObj.data.split("\n"),
        rows      = transData[0].split(","),
        numrows   = rows.length,
        result,
    // needToCopyCard is used for whether or not we should be creating
    // copies of the cards in a mailing list in a different address book
    // - it's not for if we are moving or not.
        needToCopyCard = true;
    if (srcURI.length > targetURI.length) {
      result = srcURI.split(targetURI);
      if (result[0] !== srcURI) {
        // src directory is a mailing list on target directory, no need to copy card
        needToCopyCard = false;
        // workaround for a mailnews bug, get the childCards enumerator to
        // update the mIsMailingList variable in the directory
        // https://www.mozdev.org/bugs/show_bug.cgi?id=19733
        toDirectory.childCards || toDirectory.childNodes;
      }
    }
    else {
      result = targetURI.split(srcURI);
      if (result[0] !== targetURI) {
        // target directory is a mailing list on src directory, no need to copy card
        needToCopyCard = false;
        // workaround for a mailnews bug, get the childCards enumerator to
        // update the mIsMailingList variable in the directory
        // https://www.mozdev.org/bugs/show_bug.cgi?id=19733
        toDirectory.childCards || toDirectory.childNodes;
        needToRefresh = true;
      }
    }
    // if we still think we have to copy the card,
    // check if srcURI and targetURI are mailing lists on same directory
    // if so, we don't have to copy the card
    if (needToCopyCard) {
      var targetParentURI = GetParentDirectoryFromMailingListURI(targetURI);
      if (targetParentURI && (targetParentURI ===
                              GetParentDirectoryFromMailingListURI(srcURI))) {
        needToCopyCard = false;
      }
    }
    // Only move if we are not transferring to a mail list
    var actionIsMoving = (dragSession.dragAction & dragSession.DRAGDROP_ACTION_MOVE) &&
                         !toDirectory.isMailList;
    // get the cards first
    var cards = [];
    for (var j = 0; j < numrows; j++) {
      cards.push(gAbView.getCardFromRow(rows[j]));
    }
    // iterate through each card and copy/move it
    for (j = 0; j < numrows; j++) {
      var card = cards[j];
      if (!card)
        continue;
      if (card.isMailList) {
        // This check ensures we haven't slipped through by mistake
        if (needToCopyCard && actionIsMoving)
          toDirectory.addMailList(GetDirectoryFromURI(card.mailListURI));
      }
      else {
        var values = [];
        // put in a try/catch block in case the card can't be QI'd to nsIAbMDBCard
        var isMDBCard = false;
        // only copy over the extra attributes if this is before Bug 413260 and
        // if the card is an MDB Card (not an LDAP or different card)
        try {
          if (!card.getProperty) {
            // MDB card was removed in 413260, but after that patch it is no
            // longer necessary to copy the extra attributes manually
            // the card may also be an LDAP card in which case it won't have
            // extra attributes to copy
            card.QueryInterface(Components.interfaces.nsIAbMDBCard);
            isMDBCard = true;
            for (var k = 0; k < attributesLen; k++) {
              values[k] = card.getStringAttribute(attributes[k]);
            }
          }
        }
        catch (e) {
          // ignore the error if the card wasn't an MDB card, otherwise log it
          if (isMDBCard)
            com.gContactSync.LOGGER.LOG_WARNING("Error while getting extra card attributes.", e);
        }
        // delete the card if the user chose to move it (rather than copy it)
        if (actionIsMoving)
          com.gContactSync.deleteCard(srcDirectory, card);
        if (toDirectory.isMailList) {
          needToRefresh = true;
          var contact   = new com.gContactSync.TBContact(card);
          if (!contact.getValue("PrimaryEmail")) {
            com.gContactSync.LOGGER.VERBOSE_LOG("Forcing dummy email");
            // force a dummy e-mail address
            var dummyEmail = com.gContactSync.makeDummyEmail(contact, true);
            contact.setValue("PrimaryEmail", dummyEmail, false);
          }
        }
        var newCard = toDirectory.addCard(card);
        if (isMDBCard) { // copy the attributes if this is an MDB card
          try {
            newCard.QueryInterface(Components.interfaces.nsIAbMDBCard);
            if (isMDBCard) {
              for (var k = 0; k < attributesLen; k++) {
                var value = values[k] ? values[k] : "";
                newCard.setStringAttribute(attributes[k], value);
              }
            }
          } catch (e) { com.gContactSync.LOGGER.LOG_WARNING("Error while copying card", e); }
        }
        try {
          var ab = new com.gContactSync.GAddressBook(toDirectory);
          var now = (new Date()).getTime() / 1000,
              newContact = new com.gContactSync.TBContact(newCard, ab);
          // now set the new card's last modified date, clear the Google ID (if card was copied), and update it
          newContact.setValue("LastModifiedDate", now);
          if (needToCopyCard) { newContact.setValue("GoogleID", null); }
          newContact.update();
        } catch (e) { com.gContactSync.LOGGER.LOG_WARNING('copy card error: ' + e); }
      }
    }
    var cardsTransferredText;

    // set the status bar text
    if (actionIsMoving) {
      try {
        cardsTransferredText = PluralForm.get(numrows,
          gAddressBookBundle.getFormattedString("contactsMoved", [numrows]));
      } catch (e) {
        cardsTransferredText = 
          numrows == 1 ? gAddressBookBundle.getString("cardMoved")
                       : gAddressBookBundle.getFormattedString("cardsMoved",
                                                                [numrows]);
      }
    } else {
      try {
        cardsTransferredText = PluralForm.get(numrows,
          gAddressBookBundle.getFormattedString("contactsCopied", [numrows]));
      } catch (e) {
        alert(e);
        cardsTransferredText =
          numrows == 1 ? gAddressBookBundle.getString("cardCopied")
                       : gAddressBookBundle.getFormattedString("cardsCopied",
                                                                [numrows]);
      }
    }

    if (com.gContactSync.Preferences.mSyncPrefs.selectFirstCardAfterDrop.value) {
      // update the address book view so it doesn't show the card twice
      SetAbView(GetSelectedDirectory(), false);
      // select the first card, if any
      if (gAbView && gAbView.getCardFromRow(0)) {
        SelectFirstCard();
      }
    }

    // set the status text
    document.getElementById("statusText").label = cardsTransferredText;
  }
};

/**
 * Deletes the given card from the given directory.
 * @param aDirectory {nsIAbDirectory} The directory from which the card is
 *                                    deleted.
 * @param aCard      {nsIAbCard}      The card that is deleted from the
 *                                    directory.
 */
com.gContactSync.deleteCard = function gCS_deleteCard(aDirectory, aCard) {
  if (!aCard || !aDirectory)
    return;
  var arr;
  // Thunderbird 2 and 3 differ in the type of array that must be passed to
  // the deleteCards method
  if (aDirectory.modifyCard) { // TB 3
    arr = Components.classes["@mozilla.org/array;1"]
                    .createInstance(Components.interfaces.nsIMutableArray);
    arr.appendElement(aCard, false);
  }
  else { // TB 2
    arr = Components.classes["@mozilla.org/supports-array;1"]
                    .createInstance(Components.interfaces.nsISupportsArray);
    arr.AppendElement(aCard, false);
  }
  aDirectory.deleteCards(arr);
};
