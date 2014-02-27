// refresh interval in minutes
pref("extensions.gContactSync.refreshInterval", 120);
// the delay between synchronizing individual accounts (in ms)
pref("extensions.gContactSync.accountDelay", 5000);
// the number of contacts supported.  Automatically raised, if necessary.
pref("extensions.gContactSync.maxContacts", 10000);
// set to true if Google should be updated when a contact changes in Thunderbird
// and Google.  False to update TB instead.
pref("extensions.gContactSync.updateGoogleInConflicts", true);
// set to true to enable an extended method of copying/moving cards that copies
// the extra attributes added by this extension
pref("extensions.gContactSync.overrideCopy", true);
// how long gContactSync should wait to sync after the address book is opened
pref("extensions.gContactSync.initialDelayMinutes", 5);
// set to true to enable logging (recommended)
pref("extensions.gContactSync.enableLogging", true);
// set to true to enable verbose logging
pref("extensions.gContactSync.verboseLog", false);
// set to true to enable automatic synchronizing when Thunderbird opens and after the sync delay
pref("extensions.gContactSync.autoSync", true);
// set to true to synchronize groups with mailing lists
pref("extensions.gContactSync.syncGroups", true);
// enable/disable the menu
pref("extensions.gContactSync.enableMenu", true);
// enable/disable read-only mode (TB gets updates from Google only)
pref("extensions.gContactSync.readOnly", false);
// enable/disable write-only mode (TB writes updates Google only)
pref("extensions.gContactSync.writeOnly", false);
// only sync the My Contacts group
pref("extensions.gContactSync.myContacts", false);
// the name of the group to sync if myContacts is true
// this must be the system group or title of the group
pref("extensions.gContactSync.myContactsName", "Contacts");
// true = new phone labels in the abResultsTreeCols (column labels in the AB)
pref("extensions.gContactSync.phoneColLabels", true);
// set to true to add types to phone numbers (Work, Home, Mobile, etc.)
pref("extensions.gContactSync.phoneTypes", true);
// swap the mobile and pager fields in the new/edit contact dialog
// ignored if phoneTypes == false
pref("extensions.gContactSync.swapMobilePager", true);
// whether or not gContactSync should add new tree column labels
// in Thunderbird 3 (it can't work in 2)
pref("extensions.gContactSync.newColLabels", true);
// enable the dummy e-mail address (used when contacts don't have an address)
// if disabled this can cause problems w/ mailing lists...
// in cases where problems will almost certainly happen this pref is ignored
pref("extensions.gContactSync.dummyEmail", false);
// enable different IM URLs as defined in Overlay.js
pref("extensions.gContactSync.enableImUrls", true);
// the last version of gContactSync loaded
pref("extensions.gContactSync.lastVersionMajor", 0);
pref("extensions.gContactSync.lastVersionMinor", 0);
pref("extensions.gContactSync.lastVersionRelease", 0);
pref("extensions.gContactSync.lastVersionSuffix", "");
// fix a CSS problem in Duplicate Contacts Manager
// https://www.mozdev.org/bugs/show_bug.cgi?id=21883
pref("extensions.gContactSync.fixDupContactManagerCSS", false);
// download contact photos (TB 3/SM 2+)
pref("extensions.gContactSync.getPhotos", true);
// upload contact photos (TB 3/SM 2+)
pref("extensions.gContactSync.sendPhotos", true);
// add a 'reset' menuitem to the AB context menu
pref("extensions.gContactSync.addReset", true);
// Show an alert dialog with a summary after manual syncs
pref("extensions.gContactSync.alertSummary", true);
// default plugin for new synchronization accounts
pref("extensions.gContactSync.Plugin", "Google");
// enable address synchronization
pref("extensions.gContactSync.syncAddresses", true);
// the interval between AB backups, in days
pref("extensions.gContactSync.backupInterval", 14);
// the minimum number of contacts about to be deleted for a confirmation dialog to be displayed
pref("extensions.gContactSync.confirmDeleteThreshold", 5);
// this is set to true when TB should be restarted beore syncing.
// this pref is set to false on startup
pref("extensions.gContactSync.needRestart", false);
// the text to be displayed on the status bar in addressbook.xul & messenger.xul
pref("extensions.gContactSync.statusBarText", "");
// set to true when a synchronization is occurring (to avoid one being run from multiple places at one time)
pref("extensions.gContactSync.synchronizing", false);
// override getCardForEmail in mail/base/content/msgHdrViewOverlay.js to add support for the Third and FourthEmail addresses
pref("extensions.gContactSync.overrideGetCardForEmail", true);
// synchronize phonetic first and last names
pref("extensions.gContactSync.syncPhoneticNames", true);
// delay after uploading a contact photo to Google on new contacts, in ms
pref("extensions.gContactSync.newContactPhotoDelay", 2000);
// Stores whether an upgrade is required from <0.4.0b1 to version 0.4
pref("extensions.gContactSync.v04UpgradeNeeded", false);
// Stores whether an upgrade is required from <0.4.0b5 and > 0.3.x to version 0.4
pref("extensions.gContactSync.v04RCUpgradeNeeded", false);
// Timeout in ms for HTTP requests, 0 means no timeout.
pref("extensions.gContactSync.httpRequestTimeout", 0);
// Delay between HTTP requests to mitigate 503 errors.
pref("extensions.gContactSync.httpRequestDelay", 120);
// extended properties to sync
pref("extensions.gContactSync.extended1", "PreferMailFormat");
pref("extensions.gContactSync.extended2", "AllowRemoteContent");
pref("extensions.gContactSync.extended3", "AnniversaryYear");
pref("extensions.gContactSync.extended4", "AnniversaryMonth");
pref("extensions.gContactSync.extended5", "AnniversaryDay");
pref("extensions.gContactSync.extended6", "PopularityIndex");
pref("extensions.gContactSync.extended7", "Custom1");
pref("extensions.gContactSync.extended8", "Custom2");
pref("extensions.gContactSync.extended9", "Custom3");
pref("extensions.gContactSync.extended10", "Custom4");
pref("extensions.gContactSync.syncExtended", true);
pref("extensions.gContactSync.faqURL",   "http://www.pirules.org/addons/gcontactsync/faq.php");
pref("extensions.gContactSync.forumURL", "http://www.pirules.org/forum/");
pref("extensions.gContactSync.errorURL", "http://www.pirules.org/extensions/submit_error.php?ext=gContactSync");
pref("extensions.gContactSync.googleContactsURL", "http://www.google.com/contacts");
pref("extensions.gContactSync@pirules.net.description", "chrome://gContactSync/locale/gcontactsync.properties");
