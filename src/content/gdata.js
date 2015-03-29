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
 * Portions created by the Initial Developer are Copyright (C) 2008-2015
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

window.addEventListener("load",
  /** Initializes the gdata class when the window has finished loading */
  function gCS_gdataLoadListener() {
    window.removeEventListener("load", gCS_gdataLoadListener, false);
    com.gContactSync.gdata.contacts.init();
  },
false);

/**
 * Stores information on using the Google Data Api protocol, specifically the
 * contacts portion of the protocol.
 * http://code.google.com/apis/contacts/
 * @class
 */
com.gContactSync.gdata = {
  CLIENT_ID:                  "874495714229-5m7jmsjebv6nrf61q14siutq43bi1gvt.apps.googleusercontent.com",
  CLIENT_SECRET:              "vayAK3lt9f4tMcMK1HZ4XZqG",
  REDIRECT_URI:               "http://localhost",
  RESPONSE_TYPE:              "code",
  SCOPE:                      "https://www.google.com/m8/feeds",
  OAUTH_URL:                  "https://accounts.google.com/o/oauth2/auth",
  TOKEN_REQUEST_URL:          "https://accounts.google.com/o/oauth2/token",
  TOKEN_REQUEST_TYPE:         "POST",
  TOKEN_REQUEST_GRANT_TYPE:   "authorization_code",
  REFRESH_REQUEST_URL:        "https://accounts.google.com/o/oauth2/token",
  REFRESH_REQUEST_TYPE:       "POST",
  REFRESH_REQUEST_GRANT_TYPE: "refresh_token",
  AUTH_URL:                   "https://www.google.com/accounts/ClientLogin",
  AUTH_REQUEST_TYPE:          "POST",
  AUTH_SUB_SESSION_URL:       "https://www.google.com/accounts/AuthSubSessionToken",
  AUTH_SUB_SESSION_TYPE:      "GET",
  AUTH_SUB_REVOKE_URL:        "https://www.google.com/accounts/AuthSubRevokeToken",
  AUTH_SUB_REVOKE_TYPE:       "GET",
  /**
   * Returns an OAuth URL for the given e-mail addres.
   *
   * @param aEmail {string} The e-mail address.
   * @return {string} The OAuth URL.
   */
  getOAuthURL: function gdata_getOAuthURL(aEmail) {
    return com.gContactSync.gdata.OAUTH_URL +
           "?response_type=" + com.gContactSync.gdata.RESPONSE_TYPE +
           "&client_id=" + com.gContactSync.gdata.CLIENT_ID +
           "&redirect_uri=" + com.gContactSync.gdata.REDIRECT_URI +
           ":" + com.gContactSync.Preferences.mSyncPrefs.authenticationPort.value +
           "&scope=" + com.gContactSync.gdata.SCOPE +
           "&login_hint=" + aEmail;
  },
  /**
   * Returns the email address of the given ID.
   * @returns The e-mail address from an ID.
   */
  getEmailFromId: function gdata_getEmailFromId(aId) {
    if (!aId || !aId.indexOf || aId === "")
      return "";
    // typical ID:
    // http://www.google.com/m8/feeds/contacts/address%40gmail.com/base/...
    var startStr = "/feeds/contacts/",
        start    = aId.indexOf(startStr) + startStr.length,
        endStr   = "/base/",
        end      = aId.indexOf(endStr),
        address;
    if (start >= end)
      return "";
    address = decodeURIComponent(aId.substring(start, end));
    com.gContactSync.LOGGER.VERBOSE_LOG("found address: " + address + " from ID: " + aId);
    return address;
  },
  /** Namespaces used in the API */
  namespaces: {
    /** The APP namespace */
    APP:         new com.gContactSync.Namespace("http://www.w3.org/2007/app",
                                                "app:"),
    /** The ATOM namespace */
    ATOM:        new com.gContactSync.Namespace("http://www.w3.org/2005/Atom",
                                                "atom:"),
    /** The GD namespace */
    GD:          new com.gContactSync.Namespace("http://schemas.google.com/g/2005",
                                                "gd:"),
    /** The GCONTACT namespace */
    GCONTACT:    new com.gContactSync.Namespace("http://schemas.google.com/contact/2008",
                                                "gContact:"),
    /** The OPEN SEARCH namespace */
    OPEN_SEARCH: new com.gContactSync.Namespace("http://a9.com/-/spec/opensearch/1.1/",
                                                "openSearch:"),
    /** The BATCH namespace */
    BATCH:       new com.gContactSync.Namespace("http://schemas.google.com/gdata/batch",
                                                "batch:")
  },
  /** some things related to contacts, such as related URLs and HTTP Request
   * types
   */
  contacts: {
    /** The URL to get all contacts (full) */
    GET_ALL_URL:      "https://www.google.com/m8/feeds/contacts/default/full?" +
                      "max-results=",
    /** The URL to get all contacts (thin) */
    GET_ALL_THIN_URL: "https://www.google.com/m8/feeds/contacts/default/thin?" +
                      "max-results=",
    /** The URL to get all groups (max 1000) */
    GROUPS_URL:       "https://www.google.com/m8/feeds/groups/default/full?" +
                      "max-results=1000",
    /** The URL to add a group */
    ADD_GROUP_URL:    "https://www.google.com/m8/feeds/groups/default/full",
    /** The URL to add a contact */
    ADD_URL:          "https://www.google.com/m8/feeds/contacts/default/full",
    /** Types of relations (people somehow associated with the contact) */
    RELATION_TYPES: {      
      "assistant":        1,
      "brother":          1,
      "child":            1,
      "domestic-partner": 1,
      "father":           1,
      "friend":           1,
      "manager":          1,
      "mother":           1,
      "parent":           1,
      "partner":          1,
      "referred-by":      1,
      "relative":         1,
      "sister":           1,
      "spouse":           1
    },
    /** Types of HTTP requests */
    requestTypes: {
      GET_ALL: "GET",
      GET:     "GET",
      UPDATE:  "PUT", // NOTE: should be set to POST and overridden
      ADD:     "POST",
      DELETE:  "DELETE"  // NOTE: should be set to POST and overridden
    },
    /** Different "types" of contact elements */
    types: {
      /** Has a type (#home, #work, #other, etc.) and the value is stored in a
       * child node */
      TYPED_WITH_CHILD: 0,
      /** has a type and the value is stored in an attribute */
      TYPED_WITH_ATTR: 1,
      UNTYPED: 2,
      /** The type is stored in the element's parent */
      PARENT_TYPED: 3,
      /** gContact:event */
      EVENT: 4
    },
    /** The prefix for rel attributes */
    rel: "http://schemas.google.com/g/2005",
    /**
     * Initializes the values of the tagnames with an GElement object containing
     * information about how an Atom/XML representation of a contact from Google
     * is stored.
     */
    init: function gdata_contacts_init() {
      var GElement             = com.gContactSync.GElement,
          untyped              = this.types.UNTYPED,
          typedWithChild       = this.types.TYPED_WITH_CHILD,
          typedWithAttr        = this.types.TYPED_WITH_ATTR,
          parentTyped          = this.types.PARENT_TYPED,
          eventType            = this.types.EVENT,
          gd                   = com.gContactSync.gdata.namespaces.GD,
          atom                 = com.gContactSync.gdata.namespaces.ATOM,
          gcontact             = com.gContactSync.gdata.namespaces.GCONTACT;
      this.postalAddress       = new GElement(typedWithChild, "postalAddress",
                                             gd, this.POSTAL_ADDRESS_TYPES);
      this.phoneNumber         = new GElement(typedWithChild, "phoneNumber", gd,
                                              this.PHONE_TYPES);
      this.email               = new GElement(typedWithAttr, "email", gd,
                                              this.EMAIL_TYPES, "address");
      this.im                  = new GElement(typedWithAttr, "im", gd,
                                              this.IM_TYPES, "address");
      this.id                  = new GElement(untyped, "id", atom);
      this.updated             = new GElement(untyped, "updated", atom);
      this.title               = new GElement(untyped, "title", atom);
      this.fullName            = new GElement(untyped, "fullName", gd);
      this.givenName           = new GElement(untyped, "givenName", gd);
      this.familyName          = new GElement(untyped, "familyName", gd);
      this.additionalName      = new GElement(untyped, "additionalName", gd);
      this.namePrefix          = new GElement(untyped, "namePrefix", gd);
      this.nameSuffix          = new GElement(untyped, "nameSuffix", gd);
      this.notes               = new GElement(untyped, "content", atom);
      this.orgName             = new GElement(untyped, "orgName", gd);
      this.orgTitle            = new GElement(untyped, "orgTitle", gd);
      this.orgJobDescription   = new GElement(untyped, "orgJobDescription", gd);
      this.orgDepartment       = new GElement(untyped, "orgDepartment", gd);
      this.orgSymbol           = new GElement(untyped, "orgSymbol", gd);
      this.birthday            = new GElement(untyped, "birthday", gcontact);
      this.organization        = new GElement(typedWithAttr, "organization",
                                              gd, ["other"]);
      this.groupMembershipInfo = new GElement(untyped, "groupMembershipInfo",
                                              gcontact);
      this.relation            = new GElement(typedWithChild, "relation",
                                              gcontact,
                                              this.RELATION_TYPES);
      this.nickname            = new GElement(untyped, "nickname",
                                              gcontact);
      this.website             = new GElement(typedWithAttr, "website",
                                              gcontact,
                                              this.WEBSITE_TYPES, "href");
      this.formattedAddress    = new GElement(parentTyped, "formattedAddress", gd);
      this.street              = new GElement(parentTyped, "street",           gd);
      this.city                = new GElement(parentTyped, "city",             gd);
      this.region              = new GElement(parentTyped, "region",           gd);
      this.postcode            = new GElement(parentTyped, "postcode",         gd);
      this.country             = new GElement(parentTyped, "country",          gd);
      this.event               = new GElement(eventType,   "event",            gcontact);
    },
    /**
     * Updates the given element's type by setting the rel or label attribute
     * and removing the other attribute, if present.
     *
     * @param aElement {XMLElement} The XML element to update.
     * @param aType    {string}     The type to set.
     */
    setRelOrLabel: function gdata_setRelOrLabel(aElement, aType) {
      if (!aElement || !aElement.setAttribute) {
        throw "Invalid arguments passed to gdata.contacts.setRelOrLabel";
      }
      
      var arr,
          relAttr = "rel",
          tagName = aElement.tagName.substr(aElement.tagName.lastIndexOf(":") + 1);
      switch (tagName) {
        case "email":
          arr = this.EMAIL_TYPES;
          break;
        case "im":
          arr = this.IM_TYPES;
          relAttr = "protocol";
          break;
        case "phoneNumber":
          arr = this.PHONE_TYPES;
          break;
        case "structuredPostalAddress":
          arr = this.POSTAL_ADDRESS_TYPES;
          break;
        case "relation":
          arr = this.RELATION_TYPES;
          break;
        case "website":
          arr = this.WEBSITE_TYPES;
          break;
        case "event":
          arr = this.EVENT_TYPES;
          break;
        default:
          throw "Unrecognized tagName '" + aElement.tagName + "' in setRelOrLabel";
      }
      
      // If it is NOT a custom type it should show up in arr.
      if (!aType || (arr instanceof Array && arr.indexOf(aType) > -1 || arr[aType])) {
      
        // Set a rel; website and relation elements need the rel to just be the
        // type, everything else has a prefix and im elements need a protocol.
        if (tagName === "website" || tagName === "relation") {
          aElement.setAttribute(relAttr, aType);
        } else if (tagName === "im") {
          aElement.setAttribute("protocol", com.gContactSync.gdata.contacts.rel + "#" + aType);
          aElement.setAttribute("rel",      com.gContactSync.gdata.contacts.rel + "#other");
        } else {
          aElement.setAttribute(relAttr, com.gContactSync.gdata.contacts.rel + "#" + aType);
        }
        // Remove a label, if present
        if (aElement.hasAttribute("label")) {
          aElement.removeAttribute("label");
        }
        
      // Otherwise it IS a custom type so it should be a label
      } else {
        // Set a label
        aElement.setAttribute("label", aType);
        // Remove a rel, if present
        if (aElement.hasAttribute("rel")) {
          aElement.removeAttribute("rel");
        }
      }
    },
    /** Different types for a website */
    WEBSITE_TYPES: [
      "home-page", "blog", "profile", "home", "work", "other", "ftp"
    ],
    /** Different types of phones */
    PHONE_TYPES: [
      "work", "home", "work_fax", "mobile", "pager", "home_fax", "assistant",
      "callback", "car", "company_main", "fax", "isdn", "main", "other_fax",
      "radio", "telex", "tty_tdd", "work_mobile", "work_pager", "other"
    ],
    /** Different types for IM screennames */
    IM_TYPES: [
      "AIM", "GOOGLE_TALK", "ICQ", "YAHOO", "MSN", "JABBER", "SKYPE", "QQ"
    ],
    /** E-mail address categories */
    EMAIL_TYPES: [
      "other", "home", "work"
    ],
    /** Postal address categories */
    POSTAL_ADDRESS_TYPES: [
      "home", "work", "other"
    ],
    EVENT_TYPES: [
      "other", "anniversary"
    ],
    /** Tags that are valid an an organization tag */
    ORG_TAGS: {
      orgDepartment:     "1",
      orgJobDescription: "1",
      orgName:           "1",
      orgSymbol:         "1",
      orgTitle:          "1"
    },
    /**
     * Returns true if the given tag is valid in an organization tag
     * @returns {boolean} True if the given tag is valid in an organization tag.
     */
    isOrgTag: function gdata_contacts_isOrgTag(aTagName) {
      return this.ORG_TAGS[aTagName] ? true : false;
    },
    /** Valid tags in a name tag */
    NAME_TAGS: {
      givenName:         "1",
      additionalName:    "1",
      familyName:        "1",
      namePrefix:        "1",
      nameSuffix:        "1",
      fullName:          "1"
    },
    /**
     * Returns true if the given tag is valid in an name tag
     * @returns {boolean} True if the given tag is valid in a name tag.
     */
    isNameTag: function gdata_contacts_isNameTag(aTagName) {
      return this.NAME_TAGS[aTagName] ? true : false;
    },
    /** Valid tags in a structuredAddress tag */
    ADDRESS_TAGS: {
      housename:        "1",
      street:           "1",
      poBox:            "1",
      neighborhood:     "1",
      city:             "1",
      subregion:        "1",
      region:           "1",
      postcode:         "1",
      country:          "1",
      formattedAddress: "1"
    },
    /**
     * Returns true if the given tag is valid in a structuredAddress tag
     * @returns {boolean} True if the given tag is valid in a structuredAddress
     *                  tag.
     */
    isAddressTag: function gdata_contacts_isAddressTag(aTagName) {
      return this.ADDRESS_TAGS[aTagName] ? true : false;
    },
    // different tagnames in the Atom feed, must be initialized
    postalAddress:       {},
    phoneNumber:         {},
    email:               {},
    im:                  {},
    id:                  {},
    updated:             {},
    title:               {},
    fullName:            {},
    givenName:           {},
    familyName:          {},
    additionalName:      {},
    namePrefix:          {},
    nameSuffix:          {},
    notes:               {},
    orgName:             {},
    orgTitle:            {},
    organization:        {},
    groupMembershipInfo: {},
    relation:            {},
    nickname:            {},
    birthday:            {},
    website:             {},
    /** Links in the contacts feed.  The property name is the type of link
        and the value is the value of the "rel" attribute */
    links: {
      /** The Photo URL */
      PhotoURL: "http://schemas.google.com/contacts/2008/rel#photo",
      /** The contact URL */
      SelfURL:  "self",
      /** The URL to edit the contact */
      EditURL:  "edit"
    },
    /**
     * Returns the total number of contacts in an Atom document.
     * @param aXML {XML Element} The Atom feed from Google.
     */
    getNumberOfContacts: function gdata_contacts_getNumberOfContacts(aAtom) {
      return aAtom.getElementsByTagNameNS("totalResults",
                                          com.gContactSync.gdata.namespaces.OPEN_SEARCH.url);
    }
  },
  /**
   * Returns true if there is at least one auth token.
   * @returns {boolean} True if there is at least one auth token.
   */ 
  isAuthValid: function gdata_isAuthValid() {
    if (com.gContactSync.LoginManager.mNumAuthTokens === 0)
      com.gContactSync.LoginManager.getAuthTokens();
    return com.gContactSync.LoginManager.mNumAuthTokens > 0;
  },
  /**
   * Backs up the Google contacts or groups feed to a file.
   * @param aFeed {string}    The feed to backup (as a string).
   * @param aAccount {string} The username of the account.
   * @param aPrefix {string}  The prefix for the backup file.
   * @param aSuffix {string}  The suffix for the backup file.
   * @return {boolean} True if the backup was successful.
   */
  backupFeed: function gdata_backupFeed(aFeed, aAccount, aPrefix, aSuffix) {
    var destFile = com.gContactSync.FileIO.getProfileDirectory();
    destFile.append(com.gContactSync.FileIO.fileNames.FOLDER_NAME);
    destFile.append(com.gContactSync.FileIO.fileNames.GOOGLE_BACKUP_DIR);
    destFile.append((aPrefix || "") + aAccount + (aSuffix || ""));
    com.gContactSync.LOGGER.LOG("Beginning a backup of the Google Account:\n" +
                                aAccount + "\nto:\n" + destFile.path);
    return com.gContactSync.FileIO.writeToFile(destFile, aFeed);
  },
  /**
   * Requests a new refresh token.
   * @param aEmail {string} The email address to request a token for.
   * @param aCallback {function} The function to call once there is a new token.
   */
  requestNewRefreshToken: function gdata_requestNewRefreshToken(aEmail, aCallback) {
    var wizard = window.open("chrome://gcontactsync/content/NewRefreshToken.xul",
                             "NewRefreshTokenWindow",
                             "chrome,resizable=yes,scrollbars=no,status=no");
    // when the setup window loads, set its onunload property to begin a sync
    wizard.addEventListener("load", function onloadListener() {
      var browser = wizard.document.getElementById("browser");
      var url = com.gContactSync.gdata.getOAuthURL(aEmail);
      com.gContactSync.LOGGER.VERBOSE_LOG("Opening browser with URL: " + url);
      browser.loadURI(url);
      com.gContactSync.OAuth2.init(browser, com.gContactSync.gdata.REDIRECT_URI, function callback(aResponse) {
        wizard.close();
        aCallback(aResponse);
      });
    });
  },
};
