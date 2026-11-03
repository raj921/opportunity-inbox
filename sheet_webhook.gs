// Paste into the Sheet: Extensions > Apps Script. Deploy > New deployment > Web app,
// execute as Me, access Anyone. Put the web app URL in SHEET_WEBHOOK_URL (it is a secret).
function doPost(e) {
  const r = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActive().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(["Found", "Kind", "Author", "Post", "Why", "Draft reply", "Status"]);
  sheet.appendRow([new Date(), r.kind, r.author, r.url, r.reason, r.reply, ""]);
  return ContentService.createTextOutput("ok");
}
