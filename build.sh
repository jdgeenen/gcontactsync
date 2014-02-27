#!/bin/bash

# gContactSync build script
# This script builds gContactSync into an xpi that may be installed in
# compatible applications (Thunderbird, Seamonkey, and Postbox).

#***Start editing here***

# NOTE: The VERSION here is just used for the package name
# Edit install.rdf and content/synonyms.js to change the actual VERSION
VERSION=0.4.0rc4
SRC_DIR=./src

# Dest should be absolute or relative to SRC_DIR
DEST=$(pwd)/downloads/gContactSync-$VERSION.xpi

#***Stop editing here***

# Make sure the path to $DEST exists
if [ ! -d $(dirname $DEST) ]; then
  echo "The path to $DEST does not exist, trying mkdir"
  mkdir $(dirname $DEST)
  if [ "$?" != 0 ]; then
    exit 1
  fi
fi

# remove the existing zip file
if [ -f $DEST ]; then
  echo "Removing previous zip file at:"
  echo $DEST
  rm -f $DEST
fi

cd $SRC_DIR

# finds all files in locale/ excluding CVS directories and CVS files
LOCALE_FILES=$(find locale/ -maxdepth 2 -type f ! -name CVS ! -name Repository ! -name Root ! -name Entries)

# zip the source files
zip -r $DEST content/*.* defaults/preferences/*.* $LOCALE_FILES skin/*.* install.rdf chrome.manifest -x \*.sw\*

# quit if zip failed
if [ "$?" != 0 ]; then
  echo "ERROR: zip failed, check '$DEST'"
  exit 1
fi

echo "Package ready at:"
echo $DEST
echo "MD5 checksum:"
md5sum $DEST

git add $DEST
