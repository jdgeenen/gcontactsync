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
 * GMailList is an abstraction of a mailing list that facilitates getting the
 * cards contained within the actual list as well as accessing and modifying the
 * list and its properties.
 *
 * @param aList {Ci.nsIAbDirectory}       The actual nsIAbDirectory
 *                                        representation of a mailing list.
 * @param aParentDirectory {GAddressBook} The parent directory (as an
 *                                        AddressBook object) containing this
 *                                        mailing list.
 * @param aNew             {boolean}      Set as true for new mailing lists where
 *                                        no attempt should be made to fetch the
 *                                        contacts contained in the list.
 * @extends gContactSync.MailList
 * @constructor
 * @class
 */
gContactSync.GMailList = function gCS_GMailList(aList, aParentDirectory, aNew) {
  // Make a new MailList object and copy everything over
  var list = new gContactSync.MailList(aList, aParentDirectory, aNew),
      i;
  for (i in list) {
    if (!this[i]) {
      this[i] = list[i];
    }
  }
  this.mListObj = list;
};

gContactSync.GMailList.prototype = {
  /**
   * Gets and returns the ID of the group in Google with which this Mail List
   * is synchronized, if any.  If not found, returns "no id found" with a space
   * and the current time in microseconds since the epoch.
   * @returns The ID of the group with which this directory is synchronized.
   */
  getGroupID: function GMailList_getGroupID() {
    // first see if the nickname is the group id
    var id = this.getNickName();
    if (id.indexOf("www.google.com/m8/feeds/groups") === -1) {
      id = this.getDescription(); // if it isn't, get the description
    }
    // finally, set it as "no id found" with the current time
    if (id.indexOf("www.google.com/m8/feeds/groups") === -1) {
      id = "no id found " + (new Date()).getTime();
    }
    return gContactSync.fixURL(id);
  },
  /**
   * Sets the ID of the group in Google with which this Mail List is
   * synchronized.
   * @returns The ID of the group with which this directory is synchronized.
   */
  setGroupID: function GMailList_setGroupID(aGroupID) {
    this.setNickName(aGroupID);
  }
};
