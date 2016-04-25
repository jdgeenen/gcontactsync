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
 * Contains all of the string bundles included in gContactSync and provides
 * a method (getStr) to find a string by looking in every bundle.
 * NOTE:  This requires that string bundles have unique names for strings.
 * NOTE:  Must be initialized when the window is loaded.
 * @class
 */
gContactSync.StringBundle = {
  /** Stores all string bundle elements */
  mBundles:     {},
  /** Stores whether this class has been initialized */
  mInitialized: false,
  /** Stores whether the user agent should be replaced in strings */
  mReplaceUserAgent: false,
  /** The user agent (Thunderbird, SeaMonkey, or Postbox). */
  mUserAgent:   "Thunderbird",

  /**
   * Initializes the string bundle.
   */
  init: function StringBundle_init() {
    if (gContactSync.StringBundle.mInitialized) {
      return true;
    }

    gContactSync.StringBundle.mBundles.mStrings =
      document.getElementById("gContactSyncStringBundle");
      
    if (!gContactSync.StringBundle.mBundles.mStrings) {
      var err = "Error - gContactSync.StringBundle could not be initialized\n";
      gContactSync.alert(err, "Error");
      throw err;
    }

    // Check the user agent
    if (window.navigator.userAgent.indexOf("SeaMonkey") != -1) {
      gContactSync.StringBundle.mUserAgent        = "SeaMonkey";
      gContactSync.StringBundle.mReplaceUserAgent = true;
    } else if (window.navigator.userAgent.indexOf("Postbox") != -1) {
      gContactSync.StringBundle.mUserAgent        = "Postbox";
      gContactSync.StringBundle.mReplaceUserAgent = true;
    }

    gContactSync.StringBundle.mInitialized = true;
    return true;
  },
  /**
   * Searches every string bundle until a string is found with the given name.
   * If gContactSync.StringBundle.mReplaceUserAgent is set to true, this
   * will replace all instances of "Thunderbird" with the string in
   * gContactSync.StringBundle.mUserAgent.
   * @param aName {string} The name of the string to search for.
   * @returns {string} The translated string.
   */
  getStr: function StringBundle_getStr(aName) {
    var str = aName, i;
    
    // initialize the string bundle if it wasn't already done
    if (!gContactSync.StringBundle.mInitialized) {
      gContactSync.StringBundle.init();
    }

    for (i in gContactSync.StringBundle.mBundles) {
      try {
        str = gContactSync.StringBundle.mBundles[i].getString(aName);

        // If necessary, replace all instances of Thunderbird with the actual
        // user agent.
        if (gContactSync.StringBundle.mReplaceUserAgent) {
          str = str.replace(/Thunderbird/g, gContactSync.StringBundle.mUserAgent);
        }

        break;
      } catch (e) {} // if the bundle doesn't exist or if the string
                     // isn't in it skip to the next
    }

    return str;
  }
};
