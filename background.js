var defaultSettings = {
  maxTabs: 10,
  badgeFormat: "openTabs",
  errorTitle: "Too many tabs opened",
  errorContent: "Max Tabs Limit: {maxTabs}"
};
var currentSettings = {};
var managArr;
var localArr;
var isLoading = false;

//set default and managed values to local storage, do not overwrite unless locked = true in managed storage.
async function loadStorageValues() {
  //Make double-sure it does not cause infinite recursions!!
  browser.storage.onChanged.removeListener(configUpdated);
  console.log("loadStorageValues: locking now")
  isLoading = true;
  //always reset locked to prevent a case where managed storage is removed, leaving the settings unchangeable
  await browser.storage.local.remove("locked")
  //get the keys of the local storage as an array, useful for not overwriting things
  await browser.storage.local.get().then(data => {localArr = Object.keys(data);})
  console.log("loadStorageValues: localArr:")
  console.log(localArr)
  //get the keys of the managed storage as an array, if there is an error just save the error which is NOT an array
  await browser.storage.managed.get().then(data => {managArr = Object.keys(data);}, err => {managArr = err})
  console.log("loadStorageValues: managArr")
  console.log(managArr)
  /*
  If browser.storage.managed.get() does not throw an error, it will be an array.
  We prioritize the managed settings by adding, or if locked overwriting, first and only then adding the default settings for missing entries after everything else.
  */
  if (Array.isArray(managArr)) {
    let result = await browser.storage.managed.get("locked");
    //if locked overwrite instead of adding
    if (result.locked === true) {
      //Can't use .forEach as that causes some async shenanigans as await does not work on it
      for (const key of managArr) {
        await writeManagedToLocal(key);
      } //await managArr.forEach(key=>{writeManagedToLocal(key)});
    } else {
      //only set variables not already set
      let toRemove = new Set(localArr);
      let toSet = managArr.filter( x => !toRemove.has(x) );
      console.log("loadStorageValues: toSet:");
      console.log(toSet);
      for (const key of toSet) {
        await writeManagedToLocal(key);
      } //await toSet.forEach(key=>{writeManagedToLocal(key)});
    }
  } else {
    console.log("loadStorageValues: managArr is not Array, assuming managed Storage is not in use.")
  }
  //lastly always add the default values to ensure nothing stays empty
  //Refresh localArr
  await browser.storage.local.get().then(data => {localArr = Object.keys(data);})
  let toRemove = new Set(localArr);
  let toSet = Object.keys(defaultSettings).filter( x => !toRemove.has(x) );
  console.log("loadStorageValues: toSetDefault:");
  console.log(toSet);
  for (const key of toSet) {
    await browser.storage.local.set({[key]: defaultSettings[key]});
  } //await toSet.forEach(key=>{browser.storage.local.set({[key]: defaultSettings[key]})});

  //Copy local storage to variable
  await browser.storage.local.get().then(data => {localArr = Object.keys(data);});
  for (const key of localArr) {
    await writeLocalToVariable(key);
  } //await localArr.forEach(key=>{writeLocalToVariable(key)});

  //If config gets updated in settings page reload everything
  browser.storage.onChanged.addListener(configUpdated);
  console.log("loadStorageValues: unlocking");
  isLoading = false;
}

async function writeManagedToLocal(key) {
  let manval;
  await browser.storage.managed.get(key).then(data => {manval = data[key];});
  console.log("writeManagedToLocal: Setting " + key.toString() + " to " + manval);
  await browser.storage.local.set({[key]: manval});
  //console.log(key.toString() + " is set to: " + manval);
}

async function writeLocalToVariable(key) {
  let locval;
  await browser.storage.local.get(key).then(data => {locval = data[key];});
  console.log("writeLocalToVariable: Variabelizing " + key.toString() + " with " + locval);
  currentSettings[key] = locval;
}

/*
Update the browser when the number of tabs changes.
Update the badge. Including text and color.
Notify user, when too many tabs were opened.
*/
function updateCount(tabId, isOnRemoved) {
  console.log("updateCount called")
  browser.tabs.query({})
  .then((tabs) => {
    let length = tabs.length;
    console.log("length is: " + length)
    if (tabId == undefined) {
      console.log("tabId == undefined")
      updateBadge(length);
      return;
    }

    // onRemoved fires too early and the count is one too many.
    // see https://bugzilla.mozilla.org/show_bug.cgi?id=1396758
    if (isOnRemoved && tabId && tabs.map((t) => { return t.id; }).includes(tabId)) {
      length--;
    }
    // Only limit number of tabs other than preferences
    isPreferencesWindow = tabId.title == null || tabId.title.includes("about");
    isNewTabWindow = tabId.title != null && tabId.title.includes("about:newtab");
    // Do not block any about pages except for newtab. about:home and about:welcome are also blocked as they start an about:newtab page first.
    isBlockable = !isPreferencesWindow || isNewTabWindow;
    if (!isOnRemoved && length > currentSettings["maxTabs"] && isBlockable) {
      //Don't notify if title is empty
      if (currentSettings["errorTitle"] != "") {
        browser.notifications.create({
          "type": "basic",
          "iconUrl": browser.runtime.getURL("icons/link-48.png"),
          "title": currentSettings["errorTitle"],
          "message": currentSettings["errorContent"].replaceAll("{maxTabs}", currentSettings["maxTabs"])
        });
      }
      browser.tabs.remove(tabId.id);
    }

    updateBadge(length);

  });
}

/*
Display tab count on badge and switch color depending on how close user is to maxTabs limit.
*/
function updateBadge(length) {
  console.log("updateBadge called, length: " + length.toString() + "; maxTabs: " + currentSettings["maxTabs"].toString());
  switch(currentSettings["badgeFormat"]) {
    case "openTabs":
      console.log("case " + currentSettings["badgeFormat"] + " : " +  length.toString());
      browser.browserAction.setBadgeText({text: length.toString()});
      break;
    case "remainingTabs":
      console.log("case " + currentSettings["badgeFormat"] + " : " +  (currentSettings["maxTabs"] - length).toString());
      browser.browserAction.setBadgeText({text: (currentSettings["maxTabs"] - length).toString()});
      break;
    case "openTabsMax":
      console.log("case " + currentSettings["badgeFormat"] + " : " +  length.toString() + "/" + currentSettings["maxTabs"].toString());
      browser.browserAction.setBadgeText({text: length.toString() + "/" + currentSettings["maxTabs"].toString()});
      break;
    case "remainingTabsMax":
      console.log("case " + currentSettings["badgeFormat"] + " : " +  (currentSettings["maxTabs"] - length).toString() + "/" + currentSettings["maxTabs"].toString());
      browser.browserAction.setBadgeText({text: (currentSettings["maxTabs"] - length).toString() + "/" + currentSettings["maxTabs"].toString()});
      break;
    default:
      browser.browserAction.setBadgeText({text: length.toString()});
  }

  if (length > currentSettings["maxTabs"] * 0.7) {
    browser.browserAction.setBadgeBackgroundColor({'color': 'red'});
  } else if (length > currentSettings["maxTabs"] * 0.3) {
    browser.browserAction.setBadgeBackgroundColor({'color': 'yellow'});
  } else {
    browser.browserAction.setBadgeBackgroundColor({'color': 'green'});
  }
}

/*
Retrieve the values of the updated config from storage and update the UI accordingly.
*/
async function configUpdated() {
  console.log("configUpdated: Update called!");
  if (!isLoading) {
    await loadStorageValues();
  } else {
    console.log("configUpdated: configUpdated got called while isLoading is true!");
    return;
  }
  console.log("unlock");
  browser.tabs.query({})
  .then((tabs) => {
    let length = tabs.length;
    updateBadge(length);
  });
  console.log("configUpdated: configUpdated done")
}

async function main() {
  await loadStorageValues()
  updateCount();
  /*
  Listen to when user adds or removes tabs.
  */
  browser.tabs.onRemoved.addListener(
    (tabId) => { updateCount(tabId, true);
  });
  browser.tabs.onCreated.addListener(
    (tabId) => { updateCount(tabId, false);
  });
}

console.log("Calling main()")
//Have to do it like this to be able to use await.
main()
//Do not put stuff after main(), since it will be executed before main since it's async.'
