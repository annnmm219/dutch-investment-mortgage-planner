# iPhone Safari checklist

Physical-device check against a preview build. This is not replaced by the WebKit iPhone proxy in CI. Mark each step pass or fail.

1. Open the preview URL in Safari on an iPhone. Pass / fail.
2. The planning-estimates disclaimer is visible without scrolling past the title. Pass / fail.
3. Investment, Mortgage and Scenarios tabs each open. Pass / fail.
4. A date field (notary transfer or plan date) opens the iOS date control and keeps the chosen date. Pass / fail.
5. Currency and rate fields bring up a number keyboard. Pass / fail.
6. Changing the notary transfer date from 2026 to 2027 recalculates transfer tax without editing another field. Pass / fail.
7. Changing a mortgage amount or rate updates the result on that tab. Pass / fail.
8. Export or share the CSV from the share sheet and confirm the file opens. Pass / fail.
9. Portrait: no horizontal page scroll. Pass / fail.
10. Landscape: no horizontal page scroll and the tables can still be reached. Pass / fail.
11. Chart.js draws on the Investment tab. Pass / fail.
12. Safari shows no requests to hosts other than the preview host (no analytics or font CDNs). Pass / fail.
13. Type in a euro field, leave it, and confirm the figure is still there after switching tabs and coming back. Pass / fail.
14. "Start fresh" asks before it clears the saved plan. Pass / fail.
15. The footer shows the R6.6 release line and the page text remains readable at the default text size. Pass / fail.
