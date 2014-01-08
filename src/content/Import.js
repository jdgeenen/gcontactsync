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
 * Portions created by the Initial Developer are Copyright (C) 2010
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
 * This class is used to import contacts using OAuth.
 * This requires some interaction with a remote website (pirules.org) for
 * authentication.
 * 
 * pirules.org stores the following information for each source
 *  - oauth_consumer_key
 *  - oauth_consumer_secret
 *  - base API URL
 *  - @me/@self URL
 *  - @me/@all or @me/@friends URL
 * etc.
 * It also reorganizes and signs the parameters.
 * 
 * TODO List:
 *  - Attempt to get more contact info from MySpace
 * 
 * @class
 */
com.gContactSync.Import = {
  /** The 'source' from which contacts are imported (Plaxo, Google, etc.) */
  mSource: "",
  /** This is used internally to track whether an import is in progress */
  mStarted: false,
  /** Stores how many contacts were merged during this import */
  mMergedContacts: 0,
  /** Stores how many contacts were added during this import */
  mNewContacts: 0,
  /** A reference to the window TODO remove */
  mWindow: {},
  /** Map for Plaxo only */
  mMapplaxo: {
    /** The user's ID */
    id:            "PlaxoID",
    /** An array of the user's photos */
    photos:        "PlaxoPhotos"
  },
  /** Map for MySpace only */
  mMapmyspace: {
    /** The user's MySpace ID */
    id:            "MySpaceID",
    /**
     * The 'nickname' (MySpace only).  This is mapped w/ DisplayName because it
     * is basically all that MySpace gives.
     */
    nickname:      "DisplayName",
    /** The user's thumbnail */
    thumbnailUrl:  "MySpaceThumbnail",
    /** The URL to the contact's profile */
    profileUrl:    "WebPage2"
  },
  /** Map for Facebook only
   *  https://developers.facebook.com/docs/reference/api/user/
   * TODO - family (need a separate GET request for each contact)
   */
  mMapfacebook: {
    // TODO birthday
    /** Name is a simple attribute */
    name:          "DisplayName",
    /** ID is also a simple attribute */
    id:            "FacebookID",
    /** A link to the user's Facebook profile */
    link:          "WebPage1",
    /** A link to the user's website */
    website:       "WebPage2",
    /** The user's 'About' text */
    about:         "Notes",
    /** The user's public profile photo */
    //picture:       "FacebookProfilePhoto",
    /** The user's hometown */
    hometown: {
      /** The name of the contact's hometown */
      name: "Hometown"
    },
    /** The contact's current location */
    location: {
      /** The name of the contact's current location */
      name: "Location"
    },
    /** An array of a user's job history */
    work: {
      /** The most recent job */
      0: "",
      /** The second most recent job */
      1: "Second",
      /** The third most recent job */
      2: "Third",
      /** Employer information (name and Facebook ID) */
      employer: {
        /** The name of the company */
        name:      "Company"
      },
      /** Contact's position in the company */
      position: {
        /** The name of the contact's position in the company */
        name:      "JobTitle"
      },
      /** The date when the contact started working for the company */
      start_date:  "WorkStartDate",
      /** The date when the contact stopped working for the company */
      end_date:    "WorkEndDate"
    }
  },
  /** Maps Twitter attributes to TB */
  mMaptwitter: {
    /** The actual name of the user */
    name:              "DisplayName",
    /** The screenname */
    screen_name:       "NickName",
    /** The internal Twitter ID */
    id:                "TwitterID",
    /** The user's profile image */
    profile_image_url: "TwitterImageURL",
    /** The user's homepage */
    expanded_url:      "WebPage2",
    /** The user's description */
    description:       "Notes"
  },
  /** Maps Portable Contacts attributes to TB nsIAbCard attributes */
  mMap: {
    /** name is complex */
    name: {
      /** The given name for a contact */
      givenName:   "FirstName",
      /** The contact's last name */
      familyName:  "LastName",
      /** A contact's formatted name */
      formatted:   "DisplayName",
      /** A contact's display name */
      displayName: "DisplayName"
    },
    /** The gender of the contact */
    gender:        "Gender",
    /** The contact's first (given) name */
    first_name:    "FirstName",
    /** The contact's last (family) name */
    last_name:     "LastName",
    /** A contact's display name */
    displayName:   "DisplayName",
    /** The contact's nickname (alias) */
    nickName:      "NickName",
    /** emails is an array of a contact's e-mail addresses */
    emails: {
      /** The prefix for the first e-mail address */
      0:           "Primary",
      /** The prefix for the second e-mail address */
      1:           "Secondary",
      /** The prefix for the third e-mail address */
      2:           "Third",
      /** The prefix for the fourth e-mail address */
      3:           "Fourth",
      /** The prefix for the fifth e-mail address */
      4:           "Fifth",
      /** The suffix for an e-mail address */
      value:       "Email",
      /** The suffix for an e-mail's type (work, home, etc.) */
      type:        "EmailType"
    },
    /**
     * phoneNumbers is an array of a contact's phone numbers in the form:
     * {"type":"Home","value":"(123) 456-7890"}
     */
    phoneNumbers: {
      0:           "Work",
      1:           "Home",
      2:           "Fax",
      3:           "Cell",
      4:           "Pager",
      value:       "Phone", // note that TB is inconsistent here
                            // {Home|Work}Phone and {Fax|Cellular|Pager}Number
      type:        "PhoneType"
    },
    /**
     * addresses is an array of a contact's postal addresses in the form:
     * {"type":"Home","formatted":"1234 Main St"}
     */
    addresses: {
      0:           "",
      1:           "",
      2:           "",
      type:        "",
      formatted:   "<type>Address"
    },
    /**
     * Links to a user's websites.
     */
    urls: {
      0:           "WebPage1",
      1:           "WebPage2",
      type:        "Type",
      value:       ""
    },
    /** An array of a user's job history */
    organizations: {
      /** The most recent job */
      0:           "",
      /** The second most recent job */
      1:           "Second",
      /** The third most recent job */
      2:           "Third",
      /** The person's job title */
      title:       "JobTitle",
      /** The person's company */
      name:        "Company"
    }
  },
  /** Commands to execute when offline during an HTTP Request */
  mOfflineFunction: function Import_offlineFunc(httpReq) {
    com.gContactSync.alertError(com.gContactSync.StringBundle.getStr('importOffline'));
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('offlineImportStatusText'));
  },
  /**
   * Stores <em>encoded</em> OAuth variables, such as the oauth_token,
   * oauth_token_secret, and oauth_verifier
   */
  mOAuth: {
    /** The OAuth token to use in requests */
    oauth_token:        "",
    /** The OAuth token secret to use in signing request parameters */
    oauth_token_secret: "",
    /** The OAuth verifier for OAuth version 1.0a */
    oauth_verifier:     "",
    /** The access token (OAuth version 2.0) */
    access_token:       "",
    /** The expiration time (OAuth version 2.0) */
    expires:            ""
  },
  /**
   * Step 1: Get an initial, unauthorized oauth_token and oauth_token_secret.
   * This is done mostly on pirules.org which contains the consumer token and
   * secret for various sources and signs the parameters.
   * pirules.org returns the response from the source, usually of the form:
   * oauth_token=1234&oauth_token_secret=5678
   *
   * @param aSource {string} The source from which the contacts are obtained,
   *                         in lowercase, as supported by pirules.org.
   */
  step1: function Import_step1(aSource) {
    var imp      = com.gContactSync.Import,
        callback = aSource == "facebook" ? imp.step2b : imp.step2a;
    if (imp.mStarted) {
      // TODO warn the user and allow him or her to cancel
    }
    
    // Reset mOAuth
    imp.mOAuth.oauth_token        = "";
    imp.mOAuth.oauth_token_secret = "";
    imp.mOAuth.oauth_verifier     = "";
    imp.mOAuth.access_token       = "";
    imp.mOAuth.expires            = "";
    
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('startingImport'));
    imp.mStarted = true;
    imp.mSource  = aSource;
    // get an oauth_token and oauth_token_secret and give pirules.org some
    // strings
    imp.httpReqWrapper("http://www.pirules.org/oauth/index2.php?quiet&silent&step=1&source=" +
                       imp.mSource +
                       "&title=" +
                       encodeURIComponent(com.gContactSync.StringBundle.getStr('importTitle')) +
                       "&instructions_title=" +
                       encodeURIComponent(com.gContactSync.StringBundle.getStr('importInstructionsTitle')) +
                       "&instructions_0=" +
                       encodeURIComponent(com.gContactSync.StringBundle.getStr('importInstructions0')) +
                       "&instructions_1=" +
                       encodeURIComponent(com.gContactSync.StringBundle.getStr('importInstructions1')),
                       callback);
  },
  /**
   * Step 2a: The first of two substeps where the user is prompted for his or
   * her credentials on the third-party website.
   * In this substep, gContactSync gets the login URL from pirules.org with
   * all it's parameters and the oauth_signature.
   * This is done in step 1 for OAuth 2.0 (Facebook only at the moment).
   */
  step2a: function Import_step2a(httpReq) {
    var imp = com.gContactSync.Import,
        response = httpReq.responseText;
    if (!response) {
      com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importFailed'));
      com.gContactSync.LOGGER.LOG_ERROR("***Import failed to get the auth tokens");
      return;
    }
    com.gContactSync.LOGGER.LOG("***IMPORT: Step 1 finished:\nContents:\n" +
                                response);
    // parse and store the parameters from step 1 (oauth_token &
    // oauth_token_secret)
    imp.storeResponse(response.replace("&", "&amp;"));
    imp.httpReqWrapper("http://www.pirules.org/oauth/index2.php?quiet&silent&step=2&source=" +
                       imp.mSource +
                       "&oauth_token=" + imp.mOAuth.oauth_token +
                       "&oauth_token_secret=" + imp.mOAuth.oauth_token_secret,
                       imp.step2b);
  },
  /**
   * Step 2b: The second of two substeps where the user is prompted for his or
   * her credentials on the third-party website.
   * In this substep, gContactSync opens a browser to the login page for the
   * particular source.
   */
  step2b: function Import_step2b(httpReq) {
    var imp = com.gContactSync.Import,
        response = httpReq.responseText;
    if (!response) {
      com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importFailed'));
      com.gContactSync.LOGGER.LOG_ERROR("***Import failed to get the login URL");
      return;
    }
    response = String(response).replace(/\&amp\;/g, "&");
    com.gContactSync.LOGGER.LOG("***IMPORT: Step 2a finished:\nContents:\n" + response);
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importRequestingCredentials'));
    imp.openBrowserWindow(response, imp.logStep2b);
  },
  /**
   * Step 2b: The second of two substeps where the user is prompted for his or
   * her credentials on the third-party website.
   * This just logs that step 2b has finished (the login page was opened)
   */
  logStep2b: function Import_logStep2b() {
    var win = com.gContactSync.Import.mWindow;
    com.gContactSync.LOGGER.LOG("***IMPORT: Step 2b finished: " + win.location +
                                "Please click Finish Import to continue");
  },
  /**
   * Step 3: Gets the new oauth_token then activates the token.
   * This step must be initiated by the user (for now).
   * TODO - find a way to automatically start step3 when possible.
   */
  step3: function Import_step3() {
    var imp = com.gContactSync.Import;
    if (!imp.mStarted) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("importNotStarted"));
      return;
    }
    // Get the new oauth_token from the window.
    imp.mOAuth.oauth_token = encodeURIComponent(imp.mWindow.document.getElementById('response').innerHTML);
    // Get the oauth_verifier, if any
    if (imp.mWindow.document.getElementById("oauth_verifier")) {
      imp.mOAuth.oauth_verifier = encodeURIComponent(imp.mWindow.document.getElementById('oauth_verifier').innerHTML);
    }
    imp.mWindow.close();
    if (!imp.mOAuth.oauth_token) {
      com.gContactSync.alert(com.gContactSync.StringBundle.getStr('importCanceled'),
                             com.gContactSync.StringBundle.getStr('importCanceledTitle'),
                             window);
      imp.mStarted = false;
      return;
    }
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importActivatingToken'));
    // activate the token
    imp.httpReqWrapper("http://www.pirules.org/oauth/index2.php?quiet&silent&step=3&source=" +
                         imp.mSource +
                         "&oauth_token=" + imp.mOAuth.oauth_token +
                         "&oauth_token_secret=" + imp.mOAuth.oauth_token_secret +
                         (imp.mOAuth.oauth_verifier ? "&oauth_verifier=" + imp.mOAuth.oauth_verifier : ""),
                         imp.step4);
  },
  /**
   * Step 4: Use the token to fetch the user's contacts.
   * This sends a request and the token/token secret to pirules.org which
   * signs and sends the request to the source's @me/@friend URL.
   */
  step4: function Import_step4(httpReq) {
    var imp = com.gContactSync.Import,
        response = httpReq.responseText;
    if (!response) {
      com.gContactSync.LOGGER.LOG("***Import failed on step 3");
      return;
    }
    com.gContactSync.LOGGER.LOG("***IMPORT: Step 3 finished:\nContents:\n" + response);
    imp.storeResponse(response.replace("&", "&amp;"));
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importRetrievingContacts'));
    // Use the token to fetch the user's contacts
    // access_token is used instead of the oauth_token in OAuth 2.0
    if (imp.mOAuth.access_token) {
      imp.httpReqWrapper("http://www.pirules.org/oauth/index2.php?quiet&silent&step=4&source=" +
                         imp.mSource +
                         "&access_token=" + imp.mOAuth.access_token,
                         imp.finish);
    }
    else {
      imp.httpReqWrapper("http://www.pirules.org/oauth/index2.php?quiet&silent&step=4&source=" +
                         imp.mSource +
                         "&oauth_token=" + imp.mOAuth.oauth_token +
                         "&oauth_token_secret=" + imp.mOAuth.oauth_token_secret,
                         imp.finish);
    }
  },
  /**
   * Gets the response from step 4 and calls showImportDialog to parse the JSON
   * feed of contacts.
   */
  // Get the contact feed and import it into an AB
  finish: function Import_finish(httpReq) {
    var imp = com.gContactSync.Import,
        response = httpReq.responseText;
    if (!response) {
      com.gContactSync.LOGGER.LOG("***Import failed on step 4");
      return;
    }
    com.gContactSync.LOGGER.LOG("Final response:\n" + response);
    imp.mStarted = false;
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importParsingContacts'));
    // start the import
    imp.showImportDialog(response);
  },
  /**
   * Parses and stores a URL-encoded response in the following format:
   * param1=value1&amp;param2=value2&amp;param3=value3...
   * The parsed parameters and values are stored (still encoded) in
   * com.gContactSync.Import.mOAuth[param] = value;
   *
   * @param aResponse {string} The encoded response to parse.
   */
  storeResponse: function Import_storeResponse(aResponse) {
    var imp    = com.gContactSync.Import,
        params = (aResponse).split("&amp;");
    for (var i = 0; i < params.length; i++) {
      var index = params[i].indexOf("=");
      if (index > 0) {
        var param = params[i].substr(0, index),
            value = params[i].substr(index + 1);
        com.gContactSync.LOGGER.VERBOSE_LOG("***" + param + "=>" + value);
        imp.mOAuth[param] = value;
      }
    }
  },
  /**
   * Opens a window at the given URL and optionally sets an onbeforeunload
   * listener.
   *
   * @param aUrl {string} The URL to open.
   * @param aBeforeUnload {function} The function to run before the window is
   *                                 unloaded.
   */
  openBrowserWindow: function Import_openBrowserWindow(aUrl, aBeforeUnload) {
    var imp = com.gContactSync.Import;
    com.gContactSync.LOGGER.LOG("***IMPORT: opening '" + aUrl + "'");
    // TODO - find a way to show a location bar, allow context menus, etc.
    imp.mWindow = window.open(aUrl,
                              "gContactSyncImport" + aUrl,
                              "chrome=yes,location=yes,resizable=yes,height=500,width=500,modal=no");
    if (aBeforeUnload) {
      imp.mWindow.onbeforeunload = aBeforeUnload;
    }
  },
  /**
   * Shows a simple import dialog that lets the user pick an address book and
   * whether to merge contacts.
   * Calls beginImport when the dialog is closed.
   *
   * @param aFeed {string} The JSON feed of contacts to parse.
   */
  showImportDialog: function Import_showImportDialog(aFeed) {
    var dialog = window.open("chrome://gcontactsync/content/ImportDialog.xul",
                            "gcsImportWindow",
                            "chrome,resizable=yes,scrollbars=no,status=no");
    // when the setup window loads, set its onunload property to begin a sync
    dialog.onload = function onloadListener() {
      var menu = dialog.document.getElementById("ABList");
      // Get all Personal/Mork DB Address Books (type == 2,
      // see mailnews/addrbook/src/nsDirPrefs.h)
      var abs = com.gContactSync.GAbManager.getAllAddressBooks(2, true);
      for (i in abs) {
        if (abs[i] instanceof com.gContactSync.GAddressBook) {
          menu.appendItem(abs[i].getName(), i);
        }
      }
      menu.selectedIndex = 0;
      dialog.onunload = function onunloadListener() {
        if (menu.selectedIndex == -1) {
          com.gContactSync.LOGGER.LOG("***Import Canceled***");
          com.gContactSync.alert(com.gContactSync.StringBundle.getStr("importCanceled"),
                                 com.gContactSync.StringBundle.getStr("importCanceledTitle"),
                                 window);
        } else {
          // New ABs can be added from the dialog, so refresh the list
          var abs = com.gContactSync.GAbManager.getAllAddressBooks(2, true);
          var checkbox = dialog.document.getElementById("MergeCheckbox");
          com.gContactSync.Import.beginImport(aFeed, abs[menu.value], checkbox.checked);
        }
      };
    };
  },
  /**
   * Begins the actual import given a JSON feed of contacts.
   * It promps the user for a name for the destination AB (can be new or old).
   *
   * @param aFeed  {string}       The JSON feed of contacts to parse.
   * @param aAB    {GAddressBook} The address book to import to.
   * @param aMerge {bool}         Set to true to merge contacts during the import.
   */
  beginImport: function Import_beginImport(aFeed, aAB, aMerge) {
    if (!aFeed) {
      return;
    }
    this.mNewContacts = this.mMergedContacts = 0;
    try {
      com.gContactSync.LOGGER.VERBOSE_LOG(aFeed);
      var obj = aFeed;
      // decode the JSON and get the array of cards
      try {
        obj = JSON.parse(aFeed);
      }
      catch (e) {
        com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("importFailedMsg"));
        com.gContactSync.LOGGER.LOG_ERROR("Import failed: ", aFeed);
        com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importFailed'));
        return;
      }
      var arr = obj.entry || obj.data || obj.users || obj,
          abContacts = {};
      if (aMerge) {
        let abContactsArray = aAB.getAllContacts();
        for (var i = 0, length = abContactsArray.length; i < length; i++) {
          let contact = abContactsArray[i];
          let displayName  = contact.getValue("DisplayName");
          let primaryEmail = contact.getValue("PrimaryEmail");
          if (displayName)  abContacts[displayName.toLowerCase()]  = contact;
          if (primaryEmail) abContacts[primaryEmail.toLowerCase()] = primaryEmail;
        }
      }

      for (var i in arr) {
        var contact = arr[i],
            id = contact.id || contact.guid;
        if (id || contact.name || contact.displayName) {
          var newCard = aMerge ? this.searchForContact(contact, aAB, abContacts) : aAB.newContact(),
              attr    = "",
              srcId   = this.mSource + "_" + id;
          if (!aMerge) ++com.gContactSync.Import.mNewContacts;
          // Download FB photos
          if (this.mSource === "facebook" && id) {
            var file = com.gContactSync.writePhoto("https://graph.facebook.com/" + id + "/picture?type=large",
                                                   srcId + "_" + (new Date()).getTime());
            if (file) {
              // Thunderbird requires two copies of each photo.  A permanent copy must
              // be kept outside of the Photos directory.  Each time a contact is edited
              // Thunderbird will re-copy the original photo to the Photos directory and
              // delete the old copy.
              com.gContactSync.LOGGER.VERBOSE_LOG("Wrote photo...name: " + file.leafName);
              com.gContactSync.copyPhotoToPhotosDir(file);
              newCard.setValue("PhotoName", file.leafName);
              newCard.setValue("PhotoType", "file");
              newCard.setValue("PhotoURI",
                               Components.classes["@mozilla.org/network/io-service;1"]
                                         .getService(Components.interfaces.nsIIOService)
                                         .newFileURI(file)
                                         .spec);
            }
          }
          // Iterate through each attribute in the JSON contact
          for (var j in contact) {
            // If there is a map for just this source, check it for the
            // attribute first, otherwise just use the default map.
            if (this["mMap" + this.mSource])
              attr = this["mMap" + this.mSource][j] || this.mMap[j];
            else
              attr = this.mMap[j];

            if (attr) {
              // Download a photo of the user, if available.
              if (j === "picture" || j === "thumbnailUrl" || j === "photos" ||
                  j === "profile_image_url") {
                var file = com.gContactSync.writePhoto((j === "photos" ? contact[j][0].value : contact[j]),
                                                       srcId + "_" + (new Date()).getTime(),
                                                       0);
                if (file) {
                  // Thunderbird requires two copies of each photo.  A permanent copy must
                  // be kept outside of the Photos directory.  Each time a contact is edited
                  // Thunderbird will re-copy the original photo to the Photos directory and
                  // delete the old copy.
                  com.gContactSync.LOGGER.VERBOSE_LOG("Wrote photo...name: " + file.leafName);
                  com.gContactSync.copyPhotoToPhotosDir(file);
                  newCard.setValue("PhotoName", file.leafName);
                  newCard.setValue("PhotoType", "file");
                  newCard.setValue("PhotoURI",
                                   Components.classes["@mozilla.org/network/io-service;1"]
                                             .getService(Components.interfaces.nsIIOService)
                                             .newFileURI(file)
                                             .spec);
                }
              }
              // when contact[j] is an Array things are a bit more
              // complicated
              else if (contact[j] instanceof Array) {
                // emails: [
                //   {email: somebody@somwhere, type: work},
                //   {email: somebody2@somwhere, type: work}
                // ]
                // contact[j]    = emails[]
                // contact[j][k] = emails[k]
                for (var k = 0; k < contact[j].length; k++) {
                  // quit if k is too large/shouldn't be stored
                  if (!(k in attr)) {
                    break;
                  }
                  // contact[j][k][l] = sombody@somewhere
                  for (var l in contact[j][k]) {
                    if (l in attr) {
                      var type = contact[j][k].type;
                      // not all arrays can be mapped to TB fields by index
                      // TODO - support using original phone # fields
                      // this would require NOT storing the type...
                      var tbAttribute = String(attr[k] + attr[l]).replace("<type>", type);
                      // Workaround for inconsistent phone number attributes in TB
                      if (attr === "phoneNumbers" && (type === "Cellular" || type === "Pager" || type === "Fax")) {
                        tbAttribute = tbAttribute.replace("Phone", "Number");
                      }
                      // mMap[j][[k] is the prefix (Primary, Second, etc.)
                      // mMap[j][l] is the suffix (Email)
                      com.gContactSync.LOGGER.VERBOSE_LOG(" - (Array): " + tbAttribute + "=" + contact[j][k][l]);
                      newCard.setValue(tbAttribute, this.decode(contact[j][k][l]));
                    }
                  }
                  
                }
              }
              else if (j === "photos") {
                // TODO download the photo...
                // possibly implementation-specific
              }
              // if it is just a normal property (has a length property =>
              // string) check the map
              else if (attr.length) {
                com.gContactSync.LOGGER.VERBOSE_LOG(" - (String): " + attr + "=" + contact[j])
                newCard.setValue(attr, this.decode(contact[j]));
              }
              // else it is an object with subproperties
              else {
                for (var k in contact[j]) {
                  if (k in attr) {
                    com.gContactSync.LOGGER.VERBOSE_LOG(" - (Object): " + attr[k] + "/" + j + "=" + contact[j][k]);
                    newCard.setValue(attr[k], this.decode(contact[j][k]));
                  }
                }
              }
            }
          }
          newCard.update();
        }
      }
    }
    catch (e) {
      com.gContactSync.alertError(e);
      return;
    }
    // refresh the AB results pane
    try {
      if (SetAbView !== undefined) {
        SetAbView(GetSelectedDirectory(), false);
      }
      
      // select the first card, if any
      if (gAbView && gAbView.getCardFromRow(0))
        SelectFirstCard();
    }
    catch (e) {}
    com.gContactSync.LOGGER.LOG("***Imported Complete, Added: " +
                                this.mNewContacts + ", Merged: " +
                                this.mMergedContacts + "***");
    com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importFinished'));
    com.gContactSync.alert(com.gContactSync.StringBundle.getStr("importComplete") + "\n" +
                           com.gContactSync.StringBundle.getStr("importCompleteAdded")  + " " + this.mNewContacts    + "\n" +
                           com.gContactSync.StringBundle.getStr("importCompleteMerged") + " " + this.mMergedContacts + "\n",
                           com.gContactSync.StringBundle.getStr("importCompleteTitle"),
                           window);
  },
  /**
   * Decodes text returned in a JSON feed.
   * @param aString {string} The text to decode.
   * @returns {string} The decoded text.
   */
  decode: function Import_decode(aString) {
    return aString ?
            decodeURIComponent(aString).replace(/&lt;/g,   "<")
                                       .replace(/&gt;/g,   ">")
                                       .replace(/&amp;/g,  "&")
                                       .replace(/&quot;/g, '"') :
            "";
  },
  /**
   * A wrapper for HttpRequest for use when importing contacts.
   * @param aURL {string} The URL to send the GET request to.
   * @param aCallback {function} The callback function if the request succeeds.
   */
  httpReqWrapper: function Import_httpReqWrapper(aURL, aCallback) {
    var httpReq   = new com.gContactSync.HttpRequest();
    httpReq.mUrl  = aURL;
    httpReq.mType = "GET";
    httpReq.mOnSuccess = aCallback;
    httpReq.mOnOffline = this.mOfflineFunction;
    httpReq.mOnError = function import_onError(httpReq) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("importFailedMsg"));
      com.gContactSync.LOGGER.LOG_ERROR("Import failed: ", httpReq.responseText);
      com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importFailed'));
    }
    httpReq.send();
  },
  /**
   * Attempts to import from the Mozilla Labs Contacts add-on.
   * https://wiki.mozilla.org/Labs/Contacts/ContentAPI
   */
  mozillaLabsContactsImporter: function Import_mozLabsImporter() {
    if (com.gContactSync.Import.mStarted) {
      // TODO warn the user and allow him or her to cancel
    }
    
    com.gContactSync.Import.mSource = "mozLabsContacts";
    try {
    
      // Import the Mozilla Labs Contacts module that loads the contacts DB
      Components.utils.import("resource://people/modules/people.js");

      var json = JSON.stringify({data: People.find({})});
      var toEncode = {data: []};
      var people = [];
      
      // decode the JSON and get the array of cards
      try {
        people = JSON.parse(json);
      }
      catch (e) {
        com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("importFailedMsg"));
        com.gContactSync.LOGGER.LOG_ERROR("Import failed: ", aFeed);
        com.gContactSync.Overlay.setStatusBarText(com.gContactSync.StringBundle.getStr('importFailed'));
        return;
      }
      
      // Iterate through each person add add them to the JSON
      // This loop essentially just converts the people into a portable contacts
      // format for beginImport()
      for (var i in people.data) {
        var person = people.data[i].obj;
        if (person && person.documents) {
          var personInfo = {};
          
          // People can have the same info in multiple documents, this just
          // iterates through each document and copies the details over.
          for (var j in person.documents) {
            for (var k in person.documents[j]) {
              for (var l in person.documents[j][k])
              personInfo[l] = person.documents[j][k][l];
              com.gContactSync.LOGGER.VERBOSE_LOG(j + "." + k + "." + l + " - " + person.documents[j][k][l])
            }
          }
          toEncode.data.push(personInfo);
        }
      }
      com.gContactSync.Import.showImportDialog(JSON.stringify(toEncode));
    } catch (e) {
      com.gContactSync.alertError(com.gContactSync.StringBundle.getStr("mozLabsContactsImportFailed"));
      com.gContactSync.LOGGER.LOG_ERROR("Mozilla Labs Contacts Import Failed", e);
    }
  },
  searchForContact: function Import_searchForContact(aData, aAB, aABContacts) {
    var contact = null;
    var displayName = aData.displayName || aData.name;
    if (displayName && (displayName instanceof Array)) { // name may be complex
      displayName = displayName.displayName || displayName.formatted;
    }
    if (!displayName)
      displayName = aData.nickname;
    var primaryEmail = aData.email;
    if (primaryEmail && (primaryEmail instanceof Array)) primaryEmail = primaryEmail[0];
    if (displayName) contact = aABContacts[displayName.toLowerCase()];
    if (!contact && primaryEmail) contact = aABContacts[primaryEmail.toLowerCase()];
    com.gContactSync.LOGGER.VERBOSE_LOG(" * Display Name: " + displayName + ", Email: " + primaryEmail + " - AB Contact: " + (contact ? contact.getName() : "No match found"));
    if (contact) ++com.gContactSync.Import.mMergedContacts;
    else         ++com.gContactSync.Import.mNewContacts;
    return contact || aAB.newContact(); 
  }
};
