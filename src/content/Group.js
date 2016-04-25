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
 * A class for storing and editing the XML feed for a Group in Google Contacts.
 * @param aXml {XML Element} The XML representation of the group.
 *                           If not supplied then a new group is created.
 * @param aTitle {string}    The title for the group, if new.
 * @class
 * @constructor
 */
gContactSync.Group = function gCS_Group(aXml, aTitle) {
  if (!aXml) {
    if (!aTitle) {
      throw "Error - No title or XML passed to the Group constructor";
    }
    var atom     = gContactSync.gdata.namespaces.ATOM,
        gd       = gContactSync.gdata.namespaces.GD,
        gcontact = gContactSync.gdata.namespaces.GCONTACT,
        xml      = document.createElementNS(atom.url, atom.prefix + "entry"),
        category = document.createElementNS(atom.url, atom.prefix + "category"),
        title   = document.createElementNS(atom.url, atom.prefix + "title"),
        text    = document.createTextNode(aTitle);
    category.setAttribute("scheme", gd.url + "/#kind");
    category.setAttribute("term", gcontact.url + "/#group");
    xml.appendChild(category);
    title.appendChild(text);
    xml.appendChild(title);
    this.xml    = xml;
    this.mTitle = aTitle;
  }
  else {
    this.xml    = aXml;
    this.mTitle = this.getTitle();
  }
};

gContactSync.Group.prototype = {
  /**
   * Sets the title of this Group.
   * @param aTitle The new title for this Group.
   */
  setTitle: function Group_setTitle(aTitle) {
    if (!aTitle) {
      throw "Error - invalid title passed to Group.setTitle";
    }

    var atom  = gContactSync.gdata.namespaces.ATOM,
        title = this.xml.getElementsByTagNameNS(atom.url, "title")[0],
        text;
    if (title && title.value && title.value.indexOf("System Group") !== -1) {
      return; // cannot rename system groups
    }
    this.mTitle = aTitle;
    if (title) {
      if (title.childNodes[0]) {
        title.childNodes[0].nodeValue = aTitle;
      }
      else {
        text = document.createTextNode(aTitle);
        title.appendChild(text);
      }
    }
    else {
      title    = document.createElementNS(atom.url, atom.prefix + "title");
      text = document.createTextNode(aTitle);
      title.appendChild(text);
      this.xml.appendChild(title);
    }
  },
  /**
   * Returns the title of this Group.  If this is a system group, which is NOT
   * translated through the API, then this method will return a localized name
   * for this group.
   * @returns {string} The title of this Group.
   */
  getTitle: function Group_getTitle() {
    if (this.mTitle) {
      return this.mTitle;
    }
    // System Groups aren't localized through the API, so this will find the
    // system group's ID (Contact, Coworker, Family, or Friend) and return the
    // localized version of that group
    if (this.isSystemGroup()) {
      var elem = this.xml.getElementsByTagNameNS(gContactSync.gdata.namespaces.GCONTACT.url,
                                                 "systemGroup")[0],
          id   = elem ? elem.getAttribute("id") : null;
      if (id) {
        this.mTitle = gContactSync.StringBundle.getStr(id);
        if (this.mTitle) {
          return this.mTitle;
        }
      }
    }
    var atom  = gContactSync.gdata.namespaces.ATOM,
        title = this.xml.getElementsByTagNameNS(atom.url, "title")[0];
    if (title && title.childNodes[0]) {
      this.mTitle = title.childNodes[0].nodeValue ?
                    title.childNodes[0].nodeValue.replace("System Group: ", "") : null;
      return this.mTitle;
    }
    return null;
  },
  /**
   * Returns the URL used to edit this Group.
   * @returns {string} the URL used to edit this Group.
   */
  getEditURL: function Group_getEditURL() {
    var atom   = gContactSync.gdata.namespaces.ATOM;
    var arr    = this.xml.getElementsByTagNameNS(atom.url, "link"),
        i      = 0,
        length = arr.length;
    for (; i < length; i++) {
      if (arr[i].getAttribute("rel") === gContactSync.gdata.contacts.links.EditURL) {
        return arr[i].getAttribute("href");
      }
    }
    return null;
  },
  /**
   * Retrieves and returns the ID of this Group.
   * @returns {string} The ID of this Group.
   */
  getID: function Group_getID() {
    var atom = gContactSync.gdata.namespaces.ATOM,
        id   = this.xml.getElementsByTagNameNS(atom.url, "id")[0];
    if (id && id.childNodes[0]) {
      return gContactSync.fixURL(id.childNodes[0].nodeValue);
    }
    return null;
  },
  /**
   * Removes all of the extended properties from this Group.
   */
  removeExtendedProperties: function Group_removeExtendedProperties() {
    var arr = this.xml.getElementsByTagNameNS(gContactSync.gdata.namespaces.GD.url, "extendedProperty"),
        i   = arr.length - 1;
    for (; i > -1 ; i--) {
      this.xml.removeChild(arr[i]);
    }
  },
  /**
   * Returns the extended property of this group's XML whose value for the
   * name attribute matches aName, if any.
   * @param aName {string} The value of the name attribute to find.
   * @returns {string} The value of an extended property whose name is the value of aName.
   */
  getExtendedProperty: function Group_getExtendedProperty(aName) {
    var arr    = this.xml.getElementsByTagNameNS(gContactSync.gdata.namespaces.GD.url, "extendedProperty"),
        i      = 0,
        length = arr.length;
    for (; i < length; i++) {
      if (arr[i].getAttribute("name") === aName) {
        return arr[i].getAttribute("value");
      }
    }
    return null;
  },
  /**
   * Gets the last modified date from the group's XML feed in milliseconds since
   * 1970
   * @returns {int} The last modified date of the group in milliseconds since
   *               1970.
   */
  getLastModifiedDate: function Group_getLastModifiedDate() {
    try {
      var sModified = this.xml.getElementsByTagName('updated')[0].childNodes[0].nodeValue,
         year      = sModified.substring(0, 4),
         month     = sModified.substring(5, 7),
         day       = sModified.substring(8, 10),
         hrs       = sModified.substring(11, 13),
         mins      = sModified.substring(14, 16),
         sec       = sModified.substring(17, 19),
         ms        = sModified.substring(20, 23);
      return parseInt(Date.UTC(year, parseInt(month, 10) - 1, day, hrs, mins, sec, ms), 10);
    }
    catch (e) {
      gContactSync.LOGGER.LOG_WARNING("Unable to get last modified date from a group:\n" + e);
    }
    return 0;
  },
  /**
   * Sets an extended property with the given name and value if there are less
   * than 10 existing.  Logs a warning if there are already 10 or more and does
   * not add the property.
   * @param aName  {string} The name of the property.
   * @param aValue {string} The value of the property.
   */
  setExtendedProperty: function Group_setExtendedProperty(aName, aValue) {
    if (this.xml.getElementsByTagNameNS(gContactSync.gdata.namespaces.GD.url,
        "extendedProperty").length >= 10) {
      gContactSync.LOGGER.LOG_WARNING("Attempt to add too many properties aborted");
      return;
    }
    if (aValue && aValue !== "") {
      var property = document.createElementNS(gContactSync.gdata.namespaces.GD.url,
                                              "extendedProperty");
      property.setAttribute("name", aName);
      property.setAttribute("value", aValue);
      this.xml.appendChild(property);
    }
  },
  /**
   * Returns true if this group is one of Google's system groups.
   * These currently are:
   *  - My Contacts
   *  - Coworkers
   *  - Family
   *  - Friends
   * @returns {boolean} True if this group is a system group.
   */
  isSystemGroup: function Group_isSystemGroup() {
    var nodes = this.xml.getElementsByTagNameNS(gContactSync.gdata.namespaces.GCONTACT.url,
                                                "systemGroup");
    return nodes && nodes.length > 0;
  },
  /**
   * Returns the ID of the gContact:systemGroup tag, if any.
   * @returns {string} The ID of the system group, if any.
   */
  getSystemId: function Group_getSystemId() {
    var nodes = this.xml.getElementsByTagNameNS(gContactSync.gdata.namespaces.GCONTACT.url,
                                                "systemGroup");
    if (!nodes || !nodes.length || !nodes[0]) return null;
    return nodes[0].getAttribute("id");
  }  
};
