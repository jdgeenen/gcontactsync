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

/** Import Services.jsm. */
var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

/** The major version of gContactSync (ie 0 in 0.2.18) */
gContactSync.versionMajor   = "3";
/** The minor version of gContactSync (ie 3 in 0.3.0b1) */
gContactSync.versionMinor   = "2";
/** The release for the current version of gContactSync (ie 1 in 0.3.1a7) */
gContactSync.versionRelease = "0";
/** The suffix for the current version of gContactSync (ie a7 for Alpha 7) */
gContactSync.versionSuffix  = "";
/** The attribute where the dummy e-mail address is stored */
gContactSync.dummyEmailName = "PrimaryEmail";

/**
 * Returns a string of the current version for logging.  This can print either
 * the current version (aGetLast == false) or the previous version
 * (aGetLast == true).
 * The format is: <major>.<minor>.<release><suffix>
 * Don't use this to compare versions.
 *
 * @param aGetLast {boolean} Set this to true if you want to get the version
 *                           string for the last version of gContactSync.
 * @returns {string} A string of the current or previous version of
 *                   gContactSync in the following form:
 *                   <major>.<minor>.<release><suffix>
 */
gContactSync.getVersionString = function gCS_getVersionString(aGetLast) {
  var major, minor, release, suffix;
  if (aGetLast) {
    var prefs = gContactSync.Preferences;
    major   = prefs.mSyncPrefs.lastVersionMajor.value;
    minor   = prefs.mSyncPrefs.lastVersionMinor.value;
    release = prefs.mSyncPrefs.lastVersionRelease.value;
    suffix  = prefs.mSyncPrefs.lastVersionSuffix.value;
  }
  else {
    major   = gContactSync.versionMajor;
    minor   = gContactSync.versionMinor;
    release = gContactSync.versionRelease;
    suffix  = gContactSync.versionSuffix;
  }
  return major +
         "." + minor +
         "." + release +
         suffix;
}

/**
 * Creates a DOMSerializer to serialize the given XML then create a more
 * human-friendly string representation of that XML.
 * 
 * Also see serializeFromText.
 *
 * @param aXML {XML} The XML to serialize into a human-friendly string.
 * @returns {string} A formatted string of the given XML.
 */
gContactSync.serialize = function gCS_serialize(aXML) {
  if (!aXML)
    return "";
  try {
    return new XMLSerializer().serializeToString(aXML);
  }
  catch (e) {
    gContactSync.LOGGER.LOG_WARNING("Error while serializing the following XML: " +
                                        aXML, e);
  }
  return "";
};

/**
 * A less expensive (but still costly) function that serializes a string of XML
 * adding newlines between adjacent tags (...><...).
 * If the verboseLog preference is set as false then this function does nothing.
 *
 * @param aString {string} The XML string to serialize.
 * @param aForce {boolean} Set to true to force a serialization regardless of
 *                         verboseLog.
 * @returns {string} The serialized text if verboseLog is true; else the original
 *                  text.
 */
gContactSync.serializeFromText = function gCS_serializeFromText(aString, aForce) {
  // if verbose logging is disabled, don't replace >< with >\n< because it only
  // wastes time
  if (aForce || gContactSync.Preferences.mSyncPrefs.verboseLog.value) {
    var arr = aString.split("><");
    aString = arr.join(">\n<");
  }
  return aString;
};

/**
 * Creates a 'dummy' e-mail for the given contact if possible.
 * The dummy e-mail contains 'nobody' (localized) and '@nowhere.invalid' (not
 * localized) as well as a string of numbers.  The numbers are the ID from
 * Google, if any, or a random sequence.  The numbers are fairly unique because
 * mailing lists require contacts with distinct e-mail addresses otherwise they
 * fail silently.
 *
 * The purpose of the dummy e-mail addresses is to prevent mailing list bugs
 * relating to contacts without e-mail addresses.
 *
 * This function checks the 'dummyEmail' pref and if that pref is set as true
 * then this function will not set the e-mail unless the ignorePref parameter is
 * supplied and evaluates to true.
 *
 * @param aContact A contact from Thunderbird.  It can be one of the following:
 *                 TBContact, GContact, or an nsIAbCard (Thunderbird 2 or 3)
 * @param ignorePref {boolean} Set this as true to ignore the preference
 *                             disabling dummy e-mail addresses.  Use this in
 *                             situations where not adding an address would
 *                             definitely cause problems.
 * @returns {string} A dummy e-mail address.
 */
gContactSync.makeDummyEmail = function gCS_makeDummyEmail(aContact, ignorePref) {
  if (!aContact) throw "Invalid contact sent to makeDummyEmail";
  if (!ignorePref && !gContactSync.Preferences.mSyncPrefs.dummyEmail.value) {
    gContactSync.LOGGER.VERBOSE_LOG(" * Not setting dummy e-mail");
    return "";
  }
  var prefix = gContactSync.StringBundle.getStr("dummy1"),
      suffix = "@nowhere.invalid", // Note - this is hard-coded so locales can
                                   // be switched without gContactSync failing
                                   // to recognize a dummy e-mail address
      id     = null;
  // GContact and TBContact may not be defined
  try {
    if (aContact instanceof gContactSync.GContact)
      id = aContact.getID(true);
    // otherwise it is from Thunderbird, so try to get the Google ID, if any
    else if (aContact instanceof gContactSync.TBContact)
      id = aContact.getID();
    else
      id = gContactSync.GAbManager.getCardValue(aContact, "GoogleID");
  } catch (e) {
    try {
      // try getting the card's value
      if (aContact.getProperty) // post Bug 413260
        id = aContact.getProperty("GoogleID", null);
      else // pre Bug 413260
        id = aContact.getStringAttribute("GoogleID");
    }
    catch (ex) {}
  }
  if (id) {
    // take just the ID and not the whole URL
    return prefix + id.substr(1 + id.lastIndexOf("/")) + suffix;
  }
  // if there is no ID make a random number and remove the "0."
  else {
    return prefix + String(Math.random()).replace("0.", "") + suffix;
  }
};

/**
 * Returns true if the given e-mail address is a fake 'dummy' address.
 *
 * @param aEmail {string} The e-mail address to check.
 * @returns {boolean} true  if aEmail is a dummy e-mail address
 *                  false otherwise
 */
gContactSync.isDummyEmail = function gCS_isDummyEmail(aEmail) {
  return aEmail && aEmail.indexOf &&
         (aEmail.indexOf("@nowhere.invalid") !== -1 ||
          // This is here for when the sv-SE locale had a translated string
          // for the dummy e-mail suffix in 0.3.0 so gContactSync recognizes any
          // dummy e-mail addresses created in that version and locale.
          aEmail.indexOf("@ingenstans.ogiltig") !== -1);
};

/**
 * Selects the menuitem with the given value (value or label attribute) in the
 * given menulist.
 * Optionally creates the menuitem if it cannot be found.
 *
 * @param aMenuList {menulist} The menu list element to search.
 * @param aValue    {string}   The value to find in a menuitem.  This can be
 *                             either the 'value' or 'label' attribute of the
 *                             matched item.  Case insensitive.
 * @param aCreate   {boolean}  Set as true to create and select a new menuitem
 *                             if a match cannot be found.
 */
gContactSync.selectMenuItem = function gCS_selectMenuItem(aMenuList, aValue, aCreate) {
  if (!aMenuList || !aMenuList.menupopup || !aValue)
    throw "Invalid parameter sent to selectMenuItem";

  var arr = aMenuList.menupopup.childNodes,
      i,
      item,
      aValueLC = aValue.toLowerCase();
  for (i = 0; i < arr.length; i++) {
    item = arr[i];
    if (item.getAttribute("value").toLowerCase() === aValueLC ||
        item.getAttribute("label").toLowerCase() === aValueLC) {
      aMenuList.selectedIndex = i;
      return true;
    }
  }
  if (!aCreate)
    return false;
  item = aMenuList.appendItem(aValue, aValue);
  // getIndexOfItem was added in TB/FF 3
  aMenuList.selectedIndex = aMenuList.menupopup.childNodes.length - 1;
  return true;
};

/**
 * Attempts a few basic fixes for 'broken' usernames.
 * In the past, gContactSync didn't check that a username included the domain
 * which would pass authentication and then fail to do anything else.
 * It also didn't make sure there were no spaces in a username which would
 * also pass authentication and break for everything else.
 * See Bug 21567
 *
 * @param aUsername {string} The username to fix.
 *
 * @returns {string} A username with a domain and no spaces.
 */
gContactSync.fixUsername = function gCS_fixUsername(aUsername) {
  if (!aUsername)
    return null;
  // Add @gmail.com if necessary
  if (aUsername.indexOf("@") === -1)
    aUsername += "@gmail.com";
  // replace any spaces or tabs
  aUsername = aUsername.replace(/[ \t\n\r]/g, "");
  return aUsername;
};

/**
 * Displays an alert dialog with the given text and an optional title.
 *
 * @param aText {string} The message to display.
 * @param aTitle {string} The title for the message (optional - default is
 *                        "gContactSync Notification").
 * @param aParent {nsIDOMWindow} The parent window (also optional).
 */
gContactSync.alert = function gCS_alert(aText, aTitle, aParent) {
  if (!aTitle) {
    aTitle = gContactSync.StringBundle.getStr("alertTitle");
  }
  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
  promptService.alert(aParent, aTitle, aText);
};

/**
 * Displays an alert dialog titled "gContactSync Error" (in English).
 *
 * @param aText {string} The message to display.
 */
gContactSync.alertError = function gCS_alertError(aText) {
  var title = gContactSync.StringBundle.getStr("alertError");
  gContactSync.alert(aText, title, window);
};

/**
 * Displays an alert dialog titled "gContactSync Warning" (in English).
 *
 * @param aText {string} The message to display.
 */
gContactSync.alertWarning = function gCS_alertWarning(aText) {
  var title = gContactSync.StringBundle.getStr("alertWarning");
  gContactSync.alert(aText, title, window);
};

/**
 * Displays a confirmation dialog with the given text and an optional title.
 *
 * @param aText {string} The message to display.
 * @param aTitle {string} The title for the message (optional - default is
 *                        "gContactSync Confirmation").
 * @param aParent {nsIDOMWindow} The parent window (also optional).
 */
gContactSync.confirm = function gCS_confirm(aText, aTitle, aParent) {
  if (!aTitle) {
    aTitle = gContactSync.StringBundle.getStr("confirmTitle");
  }
  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
  return promptService.confirm(aParent, aTitle, aText);
};

/**
 * Displays a prompt with the given text and an optional title.
 *
 * @param aText {string} The message to display.
 * @param aTitle {string} The title for the message (optional - default is
 *                        "gContactSync Prompt").
 * @param aParent {nsIDOMWindow} The parent window (also optional).
 * @param aDefault {string} The default value for the textbox.
 */
gContactSync.prompt = function gCS_prompt(aText, aTitle, aParent, aDefault) {
  if (!aTitle) {
    aTitle = gContactSync.StringBundle.getStr("promptTitle");
  }
  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService),
      input         = { value: aDefault },
      response      = promptService.prompt(aParent, aTitle, aText, input, null, {});
  return response ? input.value : false; 
};

/**
 * Opens the Accounts dialog for gContactSync
 */
gContactSync.openAccounts = function gCS_openAccounts() {
    window.open("chrome://gcontactsync/content/Accounts.xul",
                "gContactSync_Accts",
                "chrome=yes,resizable=yes,toolbar=yes,centerscreen=yes");
};

/**
 * Opens the Preferences dialog for gContactSync
 */
gContactSync.openPreferences = function gCS_openPreferences() {
  window.open("chrome://gcontactsync/content/options.xul",
              "gContactSync_Prefs",
              "chrome=yes,resizable=yes,toolbar=yes,centerscreen=yes");
};

/**
 * Opens the given URL using the openFormattedURL and
 * openFormattedRegionURL functions.
 *
 * @param aURL {string} THe URL to open.
 */
gContactSync.openURL = function gCS_openURL(aURL) {
  gContactSync.LOGGER.VERBOSE_LOG("Opening the following URL: " + aURL);
  if (!aURL) {
    gContactSync.LOGGER.LOG_WARNING("Caught an attempt to load a blank URL");
    return;
  }
  try {
    if (openFormattedURL) {
      openFormattedURL(aURL);
      return;
    }
  }
  catch (e) {
    gContactSync.LOGGER.LOG_WARNING(" - Error in openFormattedURL", e);
  }
  try {
    if (openFormattedRegionURL) {
      openFormattedRegionURL(aURL);
      return;
    }
  }
  catch (e) {
    gContactSync.LOGGER.LOG_WARNING(" - Error in openFormattedRegionURL", e);
  }
  try {
    if (openTopWin) {
      var url = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                          .getService(Components.interfaces.nsIURLFormatter)
                          .formatURLPref(aURL);
      openTopWin(url);
      return;
    }
  }
  catch (e) {
    gContactSync.LOGGER.LOG_WARNING(" - Error in openTopWin", e);
  }
  // If all else fails try doing it manually
  try {
    var url = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                        .getService(Components.interfaces.nsIURLFormatter)
                        .formatURLPref(aURL);
    var uri = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService)
                        .newURI(url, null, null);

    Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
              .getService(Components.interfaces.nsIExternalProtocolService)
              .loadURI(uri);
    return;
  }
  catch (e) {
    gContactSync.LOGGER.LOG_WARNING(" - Error opening the URL", e);
  }
  gContactSync.LOGGER.LOG_WARNING("Could not open the URL: " + aURL);
  return;
};

/**
 * Opens the "view source" window with the log file if logging is enabled.
 */
gContactSync.showLog = function gCS_showLog() {
  try {
    if (!gContactSync.Preferences.mSyncPrefs.enableLogging.value)
      gContactSync.alertWarning(gContactSync.StringBundle.getStr("loggingDisabled"));
    else
      window.open("view-source:file://" + gContactSync.FileIO.mLogFile.path,
                  "gContactSyncLog",
                  "chrome=yes,resizable=yes,height=480,width=600");
  }
  catch(e) {
    gContactSync.LOGGER.LOG_WARNING("Unable to open the log", e);
  }
};

/**
 * Replaces https://... with http://... in URLs as a permanent workaround for
 * the issue described here:
 * http://www.google.com/support/forum/p/apps-apis/thread?tid=6fde249ce2ffe7a9&hl=en
 *
 * @param aURL {string} The URL to fix.
 * @return {string} The URL using https instead of http
 */
gContactSync.fixURL = function gCS_fixURL(aURL) {
  if (!aURL) {
    return aURL;
  }
  return aURL.replace(/^https:/i, "http:");
};

/**
 * Fetches and saves a local copy of this contact's photo, if present.
 * NOTE: Portions of this code are from Thunderbird written by me (Josh Geenen)
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=119459
 * @param aURL {string} The URL of the photo to download
 * @param aFilename {string} The name of the file to which the photo will be
 *                           written.  The extenion of the photo will be
 *                           appended to this name, and the photo will be in the
 *                           TB profile folder under the "Photos" directory.
 * @param aRedirect {string} The number of times the request was redirected.
 *                           If > 5 then the download attempt will be aborted.
 */
gContactSync.writePhoto = function gCS_writePhoto(aURL, aFilename, aRedirect) {
  if (!aURL) {
    gContactSync.LOGGER.LOG_WARNING("No aURL passed to writePhoto");
    return null;
  }
  if (aRedirect > 5) {
    gContactSync.LOGGER.LOG_WARNING("Caught > 5 redirection attempts, aborting photo download");
    return null;
  }

  // Get the profile directory
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties)
                       .get("ProfD", Components.interfaces.nsIFile);
  // Get (or make) the Photos directory
  file.append("gcontactsync");
  file.append("photos");
  if (!file.exists() || !file.isDirectory())
    file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, parseInt("0755", 8));
  var ch = gContactSync.createChannel(aURL);
  ch.QueryInterface(Components.interfaces.nsIHttpChannel);
  //ch.setRequestHeader("Authorization", aAuthToken, false);
  var istream = ch.open();
  // Quit if the request failed
  if ((ch instanceof Components.interfaces.nsIHttpChannel) && !ch.requestSucceeded) {
    // At least Facebook returns a 302 with a new Location for the photo.
    if (ch.responseStatus == 302) {
      var newURL = ch.getResponseHeader("Location");
      gContactSync.LOGGER.VERBOSE_LOG("Received a 302, Location: " + newURL);
      return gContactSync.writePhoto(newURL, aFilename, aRedirect + 1);
    }
    gContactSync.LOGGER.LOG_WARNING("The request to retrive the photo returned with a status ",
                                        ch.responseStatus);
    return null;
  }

  // Create a name for the photo with the contact's ID and the photo extension
  try {
    var ext = gContactSync.findPhotoExt(ch);
    aFilename += (ext ? "." + ext : "");
  }
  catch (e) {
    gContactSync.LOGGER.LOG_WARNING("Couldn't find an extension for the photo");
  }
  file.append(aFilename);
  gContactSync.LOGGER.VERBOSE_LOG(" * Writing the photo to " + file.path);

  var output = Components.classes["@mozilla.org/network/file-output-stream;1"]
                         .createInstance(Components.interfaces.nsIFileOutputStream);

  // Now write that input stream to the file
  var fstream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"]
                          .createInstance(Components.interfaces.nsIFileOutputStream);
  var buffer = Components.classes["@mozilla.org/network/buffered-output-stream;1"]
                         .createInstance(Components.interfaces.nsIBufferedOutputStream);
  fstream.init(file, 0x04 | 0x08 | 0x20, parseInt("0644", 8), 0); // write, create, truncate
  buffer.init(fstream, 8192);
  while (istream.available() > 0) {
    buffer.writeFrom(istream, istream.available());
  }

  // Close the output streams
  if (buffer instanceof Components.interfaces.nsISafeOutputStream)
      buffer.finish();
  else
      buffer.close();
  if (fstream instanceof Components.interfaces.nsISafeOutputStream)
      fstream.finish();
  else
      fstream.close();
  // Close the input stream
  istream.close();
  return file;
};

/**
 * Thunderbird requires two copies of each photo.  A permanent copy must be kept
 * outside of the Photos directory.  Each time a contact is edited Thunderbird
 * will re-copy the original photo to the Photos directory and deletes the old
 * copy.
 * This function emulates the original copy done when a photo is first added to
 * a contact.
 * @param aPhotoFile {nsIFile} The photo file to copy.  Should be outside of the
 *                             Photos folder in the profile directory.
 * @returns {nsIFile} The new copy of the photo.
 */
gContactSync.copyPhotoToPhotosDir = function gCS_copyPhotoToPhotosDir(aPhotoFile) {

  // Get the profile directory
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties)
                       .get("ProfD", Components.interfaces.nsIFile);
  // Get (or make) the Photos directory
  file.append("Photos");
  if (!file.exists() || !file.isDirectory())
    file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
  gContactSync.LOGGER.VERBOSE_LOG("Copying photo from '" + aPhotoFile.path +
                                      "' to '" + file.path + "'");
  aPhotoFile.copyToFollowingLinks(file, aPhotoFile.leafName);
  file.append(aPhotoFile.leafName);
  return file;
};

/**
 * NOTE: This function was originally from Thunderbird in abCardOverlay.js
 * Finds the file extension of the photo identified by the URI, if possible.
 * This function can be overridden (with a copy of the original) for URIs that
 * do not identify the extension or when the Content-Type response header is
 * either not set or isn't 'image/png', 'image/jpeg', or 'image/gif'.
 * The original function can be called if the URI does not match.
 *
 * @param aChannel {nsIHttpChannel} The opened channel for the URI.
 *
 * @return The extension of the file, if any, excluding the period.
 */
gContactSync.findPhotoExt = function gCS_findPhotoExt(aChannel) {
  var mimeSvc = Components.classes["@mozilla.org/mime;1"]
                          .getService(Components.interfaces.nsIMIMEService),
      ext = "",
      uri = aChannel.URI;
  if (uri instanceof Components.interfaces.nsIURL)
    ext = uri.fileExtension;
  try {
    return mimeSvc.getPrimaryExtension(aChannel.contentType, ext);
  } catch (e) {}
  return ext === "jpe" ? "jpeg" : ext;
};

gContactSync.version04Upgrade = function gCS_version04Upgrade() {
  gContactSync.Overlay.setStatusBarText(gContactSync.StringBundle.getStr("version04UpgradeStatus"));
  gContactSync.alert(gContactSync.StringBundle.getStr("version04UpgradeMessage"));
  gContactSync.LOGGER.LOG("***Upgrading Contacts***");
  var propertiesToReplace = ["_AimScreenName", "TalkScreenName", "ICQScreenName", "YahooScreenName", "MSNScreenName", "JabberScreenName"];
  // Properties that should not have types, but were given types to contacts without an e-mail address.
  var untypedProperties  = ["_GoogleTalk", "_ICQ", "_Yahoo", "_MSN", "_JabberId", "_Skype", "JobTitle", "Company", "Department",
                            "JobDescription", "CompanySymbol", "HomeAddress", "HomeCity", "HomeState", "HomeZipCode", "HomeCountry",
                            "WorkAddress", "WorkCity", "WorkState", "WorkZipCode", "WorkCountry"];
  var abs = gContactSync.GAbManager.getAllAddressBooks(2, true);
  var updateScreenNames = gContactSync.Preferences.mSyncPrefs.v04UpgradeNeeded.value;
  // For each AB:
  //  Get all contacts
  //   Get all old screennames and move them to the new fields in TB
  //   Remove types for untyped properties
  for (var i in abs) {
    if (abs[i] instanceof gContactSync.GAddressBook) {
      var contacts = abs[i].getAllContacts();
      gContactSync.LOGGER.LOG(abs[i].getName() + ": " + contacts.length);
      for (var j = 0, length = contacts.length; j < length; j++) {
        var contact = contacts[j];
        var needsUpdate = false;
        gContactSync.LOGGER.VERBOSE_LOG("-" + contact.getName());

        if (updateScreenNames) {
          var typeToName = {
            // Google Type  TB Field          TB Val
            "AIM":         ["_AimScreenName", ""],
            "GOOGLE_TALK": ["_GoogleTalk",    ""],
            "YAHOO":       ["_Yahoo",         ""],
            "SKYPE":       ["_Skype",         ""],
            "QQ":          ["_QQ",            ""],
            "MSN":         ["_MSN",           ""],
            "ICQ":         ["_ICQ",           ""],
            "JABBER":      ["_JabberId",      ""]
          };

          // Get all the existing screennames from the old gContactSync fields
          for (var k = 0, propLength = propertiesToReplace.length; k < propLength; ++k) {
            var type = contact.getValue(propertiesToReplace[k] + "Type");
            if (type && typeToName[type] && typeToName[type][1] == "") {
              typeToName[type][1] = contact.getValue(propertiesToReplace[k]);
              gContactSync.LOGGER.VERBOSE_LOG(" * " + type + ": " + typeToName[type][1]);
            }
          }

          // Remove the AIM screenname if present, since it is both an old and new field
          if (contact.getValue("_AimScreenName")) {
            contact.setValue("_AimScreenName", "");
            contact.setValue("_AimScreenNameType", "AIM");  // for backwards compatibility
            needsUpdate = true;
          }
          // Now save any screennames to the new fields in TB
          for (var prop in typeToName) {
            if (typeToName[prop][1]) {
              needsUpdate = true;
              contact.setValue(typeToName[prop][0], typeToName[prop][1]);
              gContactSync.LOGGER.VERBOSE_LOG(" * " + typeToName[prop][0] + ": " + typeToName[prop][1]);
            }
          }
        }
        // Remove types for untyped properties
        for (var l = 0, untypedPropLen = untypedProperties.length; l < untypedPropLen; ++l) {
          if (contact.getValue(untypedProperties[l] + "Type")) {
            needsUpdate = true;
            contact.setValue(untypedProperties[l] + "Type", null);
          }
        }
        if (needsUpdate) {contact.update();}
      }
    }
  }
  gContactSync.Preferences.setSyncPref("v04UpgradeNeeded", false);
  gContactSync.Preferences.setSyncPref("v04RCUpgradeNeeded", false);
};

gContactSync.createChannel = function gCS_createChannel(aURI) {
    if (aURI instanceof Components.interfaces.nsIURI) {
        aURI = aURI.spec;
    }
    let ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
   return ios.newChannel(aURI,
                         null,
                         null,
                         null,
                         Services.scriptSecurityManager.getSystemPrincipal(),
                         null,
                         Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_INHERITS,
                         Ci.nsIContentPolicy.TYPE_OBJECT);
};

/**
 * Parses the parameters in the given URL and returns them in a map.
 *
 * @param aURL {string} The URL to parse.
 */
gContactSync.parseURLParameters = function gCS_parseURLParameters(aURL) {
  var ret = {};
  var params = aURL.split("?")[1].split("&");
  for (var i in params) {
    var param = params[i].split("=");
    ret[param[0]] = param[1];
  }
  return ret;
};
