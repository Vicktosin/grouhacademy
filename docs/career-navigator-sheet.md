# Career Navigator leads in a Google Sheet

1. Create a Google Sheet. Open **Extensions > Apps Script** and replace everything with the code below.
2. Change `CHANGE_ME` to a long random password.
3. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the web app URL.
4. In Vercel, add these environment variables, then redeploy:
   - `CAREER_NAVIGATOR_SHEET_URL`: the web app URL
   - `CAREER_NAVIGATOR_SHEET_SECRET`: the same password

The form on the result page appears once both are set. Keep the Sheet private: it holds people's phone numbers.

```js
const SECRET = "CHANGE_ME";

function doPost(e) {
  const reply = (data) =>
    ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return reply({ ok: false });
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(["Date", "Name", "WhatsApp", "Skill"]);
    // The leading ' keeps what people type as text, never a formula.
    sheet.appendRow([new Date(), "'" + data.name, "'" + data.phone, "'" + data.skill]);
    return reply({ ok: true });
  } catch (error) {
    return reply({ ok: false });
  } finally {
    lock.releaseLock();
  }
}
```
