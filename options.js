var managArr;
var localArr;
var currentSettings = {};
//Radio buttons sadly need special treatment :(
var valueFormElementIDs = ['maxTabs', 'errorTitle', 'errorContent'];
var allFormElementIDs = ['maxTabs', 'openTabs', 'remainingTabs', 'openTabsMax', 'remainingTabsMax', 'errorTitle', 'errorContent', 'submit'];
/**
 * Update the UI: set the value of the maxTabs textbox.
 */
async function updateUI() {
  console.log("updateUI")
  //check if settings are locked and/or overwritten by managed storage

  //Copy local storage to variable, make sure it's done by using for loop with await
  await browser.storage.local.get().then(data => {localArr = Object.keys(data);});
  for (const key of localArr) {
    await writeLocalToVariable(key);
  }

  //Fill the form, it being async is not a problem
  valueFormElementIDs.forEach(key=>{document.getElementById(key).value = currentSettings[key]});
  //Select the correct radio button
  document.getElementById(currentSettings["badgeFormat"]).checked = true;

  if (currentSettings["locked"] === true) {
    allFormElementIDs.forEach(key=>{document.getElementById(key).setAttribute('disabled', '')});
    if (currentSettings["lockText"] != "" && typeof currentSettings["lockText"] == "string") {
      document.getElementById("lockText").innerHTML = currentSettings["lockText"];
    }
    document.getElementById("lockText").hidden = false;
  }
}

async function writeLocalToVariable(key) {
  let locval;
  await browser.storage.local.get(key).then(data => {locval = data[key];});
  console.log("writeLocalToVariable: Variabelizing " + key.toString() + " with " + locval);
  currentSettings[key] = locval;
}


/**
 * Save settings to storage.
 */
function saveOptions() {
  if (currentSettings["locked"] === true) {
    return;
  }
  let toSave = {};
  //radio buttons need special treatment
  toSave["badgeFormat"] = document.querySelector('input[name="badgeFormat"]:checked').value;
  for (const id of valueFormElementIDs) {
    toSave[id] = document.getElementById(id).value;
  }
  console.log("saveOptions: toSave variable is:");
  console.log(toSave);
  browser.storage.local.set(toSave).then(savedSuccessfully, onError);
}

/*
  Log message & notify user on success
*/
function savedSuccessfully() {
  console.log("Saved Successfully!")
  browser.notifications.create({
    "type": "basic",
    "iconUrl": browser.runtime.getURL("icons/link-48.png"),
    "title": "Success!",
     "message": "Settings saved sucessfully!"
  });
}

/*
Generic error logger.
*/
function onError(e) {
  console.error(e);
  browser.notifications.create({
    "type": "basic",
    "iconUrl": browser.runtime.getURL("icons/link-48.png"),
    "title": "Error!",
    "message": e.toString()
  });
}

/**
 * Update the UI when the page loads.
 */
console.log("addEventListeners")
document.addEventListener('DOMContentLoaded', updateUI);
// document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector('form').addEventListener('submit', (event) => {event.preventDefault(); saveOptions()});
