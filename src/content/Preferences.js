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
  /**
   * Registers the pref observer and loads the preferences
   */
  function gCS_PreferencesLoadListener() {
    window.removeEventListener("load", gCS_PreferencesLoadListener, false);
    gContactSync.Preferences.register();
    gContactSync.Preferences.getSyncPrefs();
  },
false);

window.addEventListener("unload",
  /**
   * Unregisters the pref observer.
   */
  function gCS_PreferencesUnloadListener() {
    window.removeEventListener("unload", gCS_PreferencesUnloadListener, false);
    gContactSync.Preferences.unregister();
  },
false);

/**
 * Stores information on Preferences related to gContactSync.
 * @class
 */
gContactSync.Preferences = {
  /** The preferences service */
  mService: Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService),
  mBranchName: "extensions.gContactSync.",
  /** The Preferences branch used by gContactSync */
  mSyncBranch: Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefService)
                         .getBranch("extensions.gContactSync."),
  /** An array of the extended properties to use with Google contacts */
  mExtendedProperties: [],
  /** Different types of preferences (bool, int, and char) */
  mTypes: {
    /** Boolean preference */
    BOOL: "bool",
    /** Integer preference */
    INT:  "int",
    /** String preference */
    STRING: "string"
  },
  /** Stores whether the preference observer has been registered */
  mRegistered: false,
  /**
   * Registers the pref observer and gets the initial preference values.
   */
  register: function CP_Preferences_register() {

    // nsIPrefBranch2 was merged into nsIPrefBranch in Gecko 13 (TB 13/SM 2.10)
    // TB 57 removed support for it.
    if (!("addObserver" in this.mSyncBranch)) {
      this.mSyncBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    }
    // Add an observer
    this.mSyncBranch.addObserver("", this, false);
    this.mRegistered = true;
  },
  /**
   * Unregisters the pref observer.
   */
  unregister: function CP_Preferences_unregister() {
    if(!this.mSyncBranch || !this.mRegistered) {
      return;
    }
    gContactSync.LOGGER.VERBOSE_LOG("**Unregistering preference observer");
    this.mSyncBranch.removeObserver("", this);
    this.mRegistered = false;
  },
  /**
   * Called when a preference changes on the extensions.gContactSync. branch.
   *
   * @param aSubject {nsIPrefBranch} The branch.
   * @param aTopic {string} A description of what happened.
   * @param aData  {string} The name of the pref that was changed.
   */
  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "nsPref:changed") {
      return;
    }
    // TODO - determine the cause of 'com is not defined' errors
    // this observer shouldn't be registered when com isn't defined.
    try {
      gContactSync.LOGGER.VERBOSE_LOG("**Observed a preference change: " + aData + " - " + aTopic);
    }
    catch (e) {
      return;
    }
    var pref = this.mSyncPrefs[aData];
    if (pref) {
      var oldValue = pref.value;
      pref.value = this.getPref(this.mSyncBranch, pref.label, pref.type);
      gContactSync.LOGGER.VERBOSE_LOG(" - Old value: '" + oldValue + "'\n" +
                                          " - New value: '" + pref.value + "'");
      switch (aData) {
      case "statusBarText":
        var elem = document.getElementById("gContactSyncStatusText");
        if (elem) {
          elem.label = pref.value;
        }
        break;
      case "enableMenu":
        var elem = document.getElementById("gContactSyncMenu");
        if (elem) {
          elem.collapsed = !pref.value;
        }
        break;
      }
    }
    // if it isn't a sync pref, check if it is a preference for an existing
    // GAddressBook
    else {
      try {
        var ab = gContactSync.GAbManager.mABs[this.mBranchName + aData.substring(0, aData.lastIndexOf(".") + 1)];
        if (ab) {
          var pref         = aData.substring(aData.lastIndexOf(".") + 1),
              prefNoPrefix = pref.replace(ab.prefPrefix, ""),
              newPrefValue = ab.getStringPref(pref);
          gContactSync.LOGGER.VERBOSE_LOG("Changing AB pref: " + pref +
                                              "\nFrom: " + ab.mPrefs[prefNoPrefix] +
                                              "\nTo: " + newPrefValue);
          ab.mPrefs[prefNoPrefix] = newPrefValue;
        }
      }
      catch (ex) {} // ignore errors (GAbManager may not be defined)
    }
  },
  /**
   * Preferences related to gContactSync
   * verboseLog is first since it is used when logging preferences
   */
  mSyncPrefs: {
    verboseLog:               new gContactSync.Pref("verboseLog",               "bool", false),
    initialDelayMinutes:      new gContactSync.Pref("initialDelayMinutes",      "int",  5),
    refreshInterval:          new gContactSync.Pref("refreshInterval",          "int",  120),
    accountDelay:             new gContactSync.Pref("accountDelay",             "int",  5000),
    maxContacts:              new gContactSync.Pref("maxContacts",              "int",  10000),
    backupInterval:           new gContactSync.Pref("backupInterval",           "int",  14),
    confirmDeleteThreshold:   new gContactSync.Pref("confirmDeleteThreshold",   "int",  5),
    syncExtended:             new gContactSync.Pref("syncExtended",             "bool", true),
    overrideCopy:             new gContactSync.Pref("overrideCopy",             "bool", true),
    autoSync:                 new gContactSync.Pref("autoSync",                 "bool", true),
    syncGroups:               new gContactSync.Pref("syncGroups",               "bool", true),
    enableMenu:               new gContactSync.Pref("enableMenu",               "bool", true),
    enableLogging:            new gContactSync.Pref("enableLogging",            "bool", true),
    readOnly:                 new gContactSync.Pref("readOnly",                 "bool", false),
    writeOnly:                new gContactSync.Pref("writeOnly",                "bool", false),
    myContacts:               new gContactSync.Pref("myContacts",               "bool", false),
    phoneColLabels:           new gContactSync.Pref("phoneColLabels",           "bool", true),
    phoneTypes:               new gContactSync.Pref("phoneTypes",               "bool", true),
    swapMobilePager:          new gContactSync.Pref("swapMobilePager",          "bool", true),
    newColLabels:             new gContactSync.Pref("newColLabels",             "bool", true),
    dummyEmail:               new gContactSync.Pref("dummyEmail",               "bool", false),
    fixDupContactManagerCSS:  new gContactSync.Pref("fixDupContactManagerCSS",  "bool", false),
    getPhotos:                new gContactSync.Pref("getPhotos",                "bool", true),
    sendPhotos:               new gContactSync.Pref("sendPhotos",               "bool", true),
    addReset:                 new gContactSync.Pref("addReset",                 "bool", true),
    alertSummary:             new gContactSync.Pref("alertSummary",             "bool", true),
    statusBarText:            new gContactSync.Pref("statusBarText",            "string", ""),
    myContactsName:           new gContactSync.Pref("myContactsName",           "string", "Contacts"),
    lastVersionMajor:         new gContactSync.Pref("lastVersionMajor",         "int",  0),
    lastVersionMinor:         new gContactSync.Pref("lastVersionMinor",         "int",  0),
    lastVersionRelease:       new gContactSync.Pref("lastVersionRelease",       "int",  0),
    lastVersionSuffix:        new gContactSync.Pref("lastVersionSuffix",        "string", ""),
    Plugin:                   new gContactSync.Pref("Plugin",                   "string", "Google"),
    updateGoogleInConflicts:  new gContactSync.Pref("updateGoogleInConflicts",  "bool", true),
    syncAddresses:            new gContactSync.Pref("syncAddresses",            "bool", true),
    needRestart:              new gContactSync.Pref("needRestart",              "bool", false),
    synchronizing:            new gContactSync.Pref("synchronizing",            "bool", false),
    overrideGetCardForEmail:  new gContactSync.Pref("overrideGetCardForEmail",  "bool", true),
    syncPhoneticNames:        new gContactSync.Pref("syncPhoneticNames",        "bool", true),
    newContactPhotoDelay:     new gContactSync.Pref("newContactPhotoDelay",      "int", 2000),
    v04UpgradeNeeded:         new gContactSync.Pref("v04UpgradeNeeded",         "bool", false),
    v04RCUpgradeNeeded:       new gContactSync.Pref("v04RCUpgradeNeeded",       "bool", false),
    httpRequestTimeout:       new gContactSync.Pref("httpRequestTimeout",        "int", 0),
    httpRequestDelay:         new gContactSync.Pref("httpRequestDelay",          "int", 120),
    numRelations:             new gContactSync.Pref("numRelations",              "int", 6),
    numLogsInRotation:        new gContactSync.Pref("numLogsInRotation",         "int", 3),
    selectFirstCardAfterDrop: new gContactSync.Pref("selectFirstCardAfterDrop", "bool", true),
    notesHeight:              new gContactSync.Pref("notesHeight",              "string", "")
  },
  /**
   * Gets a preference given its branch, name, and type
   * @param aBranch   {nsIPrefBranch} The branch where the preference is stored.
   * @param aName     {string} The name of the preference
   * @param aType     {string} The type of preference.
   *                           Must be in Preferences.mTypes.
   */
  getPref: function Preferences_getPref(aBranch, aName, aType) {
    if (!aBranch)
      throw "Invalid aBranch parameter supplied to the getPref method" +
            gContactSync.StringBundle.getStr("pleaseReport");
    switch (aType) {
      case this.mTypes.INT:
        return aBranch.getIntPref(aName);
      case this.mTypes.BOOL:
        return aBranch.getBoolPref(aName);
      case this.mTypes.STRING:
        return aBranch.getStringPref(aName);
      default:
        throw "Invalid aType parameter supplied to the getPref method" +
              gContactSync.StringBundle.getStr("pleaseReport");
    }
  },
  /**
   * Sets a preference given its branch, name, type and value.
   * @param aBranch   {nsIBranch} The branch where the preference is stored.
   * @param aName     {string}    The name of the preference.
   * @param aType     {string}    The type of preference.
   *                              Must be in Preferences.mTypes.
   * @param aValue    {string}    The value to set the preference.
   */
  setPref: function Preferences_setPref(aBranch, aName, aType, aValue) {
    if (!aBranch)
      throw "Invalid aBranch parameter supplied to the setPref method" +
            gContactSync.StringBundle.getStr("pleaseReport");
    switch (aType) {
      case this.mTypes.INT:
        return aBranch.setIntPref(aName, aValue);
      case this.mTypes.BOOL:
        return aBranch.setBoolPref(aName, aValue);
      case this.mTypes.STRING:
        return aBranch.setStringPref(aName, aValue);
      default:
        throw "Invalid aType parameter supplied to the setPref method" +
              gContactSync.StringBundle.getStr("pleaseReport");
    }
  },
  /**
   * A convienient method of saving a sync preference.
   * @param aPrefName {string} The preference on the gContactSync branch
   *                           to save.
   * @param aValue {string}    The new value for the given preference.
   */
  setSyncPref: function Preferences_setSyncPref(aPrefName, aValue) {
    var pref = this.mSyncPrefs[aPrefName];
    if (!pref) {
      throw "Error - invalid pref name '" + aPrefName + "'" +
            " sent to setSyncPref";
    }
    return this.setPref(this.mSyncBranch, pref.label, pref.type, aValue);
  },
  /**
   * Tries to get each preference in mSyncPrefs and creates the preference and
   * sets its default value if it is not present.
   */
  getSyncPrefs: function Preferences_getSyncPrefs() {
    gContactSync.LOGGER.LOG("\n***Loading Preferences***");
    for (var i in this.mSyncPrefs) {
      try {
        this.mSyncPrefs[i].value = this.getPref(this.mSyncBranch,
                                                this.mSyncPrefs[i].label,
                                                this.mSyncPrefs[i].type);
      }
      catch (e) { // if it doesn't exist make it and set the value to its default
        this.mSyncPrefs[i].value = this.mSyncPrefs[i].defaultValue;
        this.setPref(this.mSyncBranch, this.mSyncPrefs[i].label,
                     this.mSyncPrefs[i].type, this.mSyncPrefs[i].defaultValue);
      }
      gContactSync.LOGGER.LOG(" * " + i + ": " + this.mSyncPrefs[i].value);
    }
    gContactSync.LOGGER.LOG("***Finished Loading Preferences***\n");
    
    // Only add these extended properties if the pref to sync them is true
    this.mExtendedProperties = [];
    if (this.mSyncPrefs.syncExtended.value) {
      for (var i = 1; i <= 10; i++) {
        this.mExtendedProperties.push(this.getPref(this.mSyncBranch,
                                                   "extended" + i,
                                                   this.mTypes.STRING));
      }
    }
    if (!gContactSync.Preferences.mSyncPrefs.enableMenu.value &&
          document.getElementById("gContactSyncMenu")) {
      document.getElementById("gContactSyncMenu").collapsed = true;
    }
  },
  /**
   * Resets all gContactSync prefs to their default values.
   */
  defaultAllSyncPrefs: function Preferences_defaultAllSyncPrefs() {
    gContactSync.LOGGER.LOG("\n***Defaulting Sync Preferences***");
    for (var i in this.mSyncPrefs) {
      // TODO - use the default branch value instead?
      this.setSyncPref(this.mSyncPrefs[i].label, this.mSyncPrefs[i].defaultValue);
    }
  }
};
