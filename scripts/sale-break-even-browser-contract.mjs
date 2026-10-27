import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json'};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (!file.startsWith(ROOT + path.sep) || !(await stat(file)).isFile()) throw new Error('Invalid path');
    res.writeHead(200, {'content-type':TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-store'});
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
const close = (actual, expected, label, tolerance = 0.02) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);

function installChartStub() {
  const charts = new Map();
  window.Chart = class ChartStub {
    constructor(context, config = {}) {
      this.data = config.data || {datasets:[]}; this.options = config.options || {};
      const canvas = context?.canvas || context;
      if (canvas) charts.set(canvas, this);
      if (canvas?.id) charts.set(canvas.id, this);
    }
    update() {} destroy() {} resize() {}
    static getChart(target) { return charts.get(target) || charts.get(target?.id) || null; }
  };
  window.HTMLCanvasElement.prototype.getContext = function () { return {canvas:this}; };
}

async function result(page) {
  return page.evaluate(() => {
    const r = window.__DIMP_SALE_BREAK_EVEN_RESULT;
    return r && {valid:r.valid, threshold:r.breakEven?.rentParity, cash:r.netSaleProceeds,
      advantage:r.advantageVsRent, recovery:r.breakEven?.cashRecovery,
      investmentAvailable:r.investment?.available, investmentAdvantage:r.investment?.advantage,
      investmentThreshold:r.investment?.breakEvenSalePrice, period:r.period};
  });
}
async function displayedMoney(page, id) {
  const value = await page.locator(`#${id}`).textContent();
  assert.match(value, /\d/, `${id} has no displayed amount`);
  return Number(value.replace(/[^0-9.-]/g, ''));
}
async function waitValid(page) {
  await page.waitForFunction(() => window.__DIMP_SALE_BREAK_EVEN_RESULT?.valid === true);
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({headless:true});
  const summaries = [];
  for (const [name, viewport, mobile] of [
    ['desktop', {width:1440, height:1000}, false],
    ['mobile', {width:390, height:844}, true]
  ]) {
    const context = await browser.newContext({viewport, isMobile:mobile, hasTouch:mobile});
    try {
      await context.addInitScript(installChartStub);
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(String(error?.stack || error)));
      await page.route(/^https:\/\//, route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => window.SaleBreakEvenUI && document.getElementById('comparisonType'));
      await page.locator('.tab[data-tab="scenarios"]').click();
      await page.selectOption('#comparisonType', 'sale-break-even');
      await waitValid(page);
      assert.equal(await page.locator('#saleBreakEvenPanel').isVisible(), true, `${name}: sale panel hidden`);
      assert.equal(await page.locator('#scenarioSourceCard').isVisible(), false, `${name}: old scenario inputs remain visible`);
      const initial = await result(page);
      close(initial.threshold, 331029.9406, `${name}: default rent threshold`);
      close(initial.cash, 70407.4606, `${name}: default sale cash`);
      close(initial.advantage, 18685.5085, `${name}: default rent advantage`);
      close(initial.recovery, 422400.4990, `${name}: default cash recovery`);
      close(await displayedMoney(page, 'saleThreshold'), Math.ceil(initial.threshold), `${name}: displayed threshold`, 0);
      close(await displayedMoney(page, 'saleCashAfterSale'), Math.round(initial.cash), `${name}: displayed cash`, 0);
      assert.equal(initial.period.months, 60);
      assert.equal(await page.locator('#saleAnnualBody tr').count(), 5);
      assert.equal(await page.locator('#saleExportCsv').isEnabled(), true);
      const layout = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth}));
      assert.ok(layout.scroll <= layout.width + 2, `${name}: page overflows horizontally (${layout.scroll}/${layout.width})`);

      await page.locator('#salePurchasePrice').fill('');
      await page.waitForFunction(() => window.__DIMP_SALE_BREAK_EVEN_RESULT?.valid === false);
      for (const id of ['saleThreshold','saleAdvantage','saleCashAfterSale','saleCashRecovery'])
        assert.equal((await page.locator(`#${id}`).textContent()).trim(), 'Unavailable', `${name}: stale ${id}`);
      assert.equal(await page.locator('#saleAnnualBody tr').count(), 0);
      assert.equal(await page.locator('#saleBreakdownBody tr').count(), 0);
      assert.equal(await page.locator('#saleExportCsv').isDisabled(), true);
      await page.locator('#salePurchasePrice').fill('350000');
      await waitValid(page);

      await page.selectOption('#saleComparisonMode', 'investment');
      await page.locator('#saleInvestmentReturn').fill('0');
      await page.waitForFunction(() => {
        const r = window.__DIMP_SALE_BREAK_EVEN_RESULT;
        return r?.valid && r.investment?.available && r.config.investment.annualReturnPct === 0;
      });
      const zeroReturn = await result(page);
      close(zeroReturn.investmentAdvantage, zeroReturn.advantage, `${name}: zero-return advantage parity`);
      close(zeroReturn.investmentThreshold, zeroReturn.threshold, `${name}: zero-return threshold parity`);

      // Main planner snapshots are deliberately blank. This scenario owns its own history.
      await page.evaluate(() => {
        for (const id of ['firstJan1Portfolio','firstJan1Savings','firstJan1Debt']) document.getElementById(id).value = '';
        const assumption = document.getElementById('assumePlanStartAsJan1');
        if (assumption) assumption.checked = false;
      });
      await page.locator('#saleMonths').fill('10');
      await page.selectOption('#saleStartMonth', '3');
      await page.selectOption('#saleBox3Mode', 'current');
      await page.waitForFunction(() => {
        const r = window.__DIMP_SALE_BREAK_EVEN_RESULT;
        return r?.valid && r.investment?.enabled && r.investment.available === false;
      });
      assert.match(await page.locator('#saleInvestmentUnavailable').textContent(), /January|snapshot/i);
      await page.locator('#saleJan1Portfolio').fill('0');
      await page.locator('#saleJan1Savings').fill('60000');
      await page.locator('#saleJan1Debt').fill('0');
      await page.waitForFunction(() => window.__DIMP_SALE_BREAK_EVEN_RESULT?.investment?.available === true);
      const snapshots = await page.evaluate(() => {
        const r = window.__DIMP_SALE_BREAK_EVEN_RESULT;
        return [r.investment.owner, r.investment.renter].map(side => {
          const year = side.yearBuckets[2026];
          return [side.jan1SnapshotSource, year.jan1Portfolio, year.jan1Savings, year.jan1Debt];
        });
      });
      assert.deepEqual(snapshots, [['entered',0,60000,0], ['entered',0,60000,0]]);
      const beforeReload = await result(page);
      await page.waitForFunction(() => {
        const saved = JSON.parse(localStorage.getItem(window.PlannerState.STORAGE_KEY) || 'null');
        return saved?.controls?.['id:saleJan1Savings']?.value === '60000'
          && saved.controls['id:comparisonType']?.value === 'sale-break-even';
      });
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => window.__DIMP_SALE_BREAK_EVEN_RESULT?.investment?.available === true);
      assert.equal(await page.locator('#comparisonType').inputValue(), 'sale-break-even');
      assert.equal(await page.locator('#saleBreakEvenPanel').isVisible(), true);
      assert.equal(await page.locator('#saleStartMonth').inputValue(), '3');
      assert.equal(await page.locator('#saleJan1Savings').inputValue(), '60000');
      assert.deepEqual(await result(page), beforeReload, `${name}: restored result changed`);

      await page.selectOption('#comparisonType', 'mortgage-invest');
      await page.waitForFunction(() => window.__DIMP_SALE_BREAK_EVEN_RESULT === null);
      assert.equal(await page.locator('#saleBreakEvenPanel').isVisible(), false);
      assert.equal(await page.locator('#scenarioSourceCard').isVisible(), true);
      await page.selectOption('#comparisonType', 'sale-break-even');
      await page.waitForFunction(() => window.__DIMP_SALE_BREAK_EVEN_RESULT?.investment?.available === true);
      assert.equal(await page.locator('#scenarioSourceCard').isVisible(), false);
      assert.deepEqual(await result(page), beforeReload, `${name}: switching scenarios changed the sale result`);
      assert.deepEqual(errors, [], `${name}: browser errors`);
      summaries.push({viewport:name, defaultResults:true, invalidClearing:true, zeroReturnParity:true,
        explicitJanuarySnapshots:true, saveReload:true, scenarioSwitching:true, pageErrors:0});
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({contract:'sale-break-even', results:summaries}, null, 2));
  console.log('Home sale break-even desktop and mobile browser contract passed.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
