'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Sale = require('../sale-break-even.js');

const close = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Number.isFinite(actual), `expected a finite result, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, received ${actual}`);
};
const valid = result => {
  assert.equal(result.valid, true, JSON.stringify(result.errors || result));
  return result;
};
const noInvalidNumbers = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `invalid numeric result: ${value}`);
  else if (Array.isArray(value)) value.forEach(noInvalidNumbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(noInvalidNumbers);
};

function aggregateInput(overrides = {}) {
  return {
    purchasePrice: 350000,
    downPayment: 50000,
    purchaseCosts: 10000,
    financedPurchaseCosts: 0,
    initialMortgage: 300000,
    remainingMortgage: 270000,
    principalPaid: 30000,
    interestPaid: 50000,
    ownerCosts: 15000,
    netTaxBenefit: 15000,
    rentPaid: 90000,
    salePrice: 350000,
    sellingCostPct: 1.5,
    sellingCostFixed: 3000,
    ...overrides
  };
}

function scenario(overrides = {}) {
  const base = {
    purchasePrice: 360000,
    downPayment: 60000,
    purchaseCosts: 12000,
    financedPurchaseCosts: 0,
    months: 60,
    startYear: 2026,
    startMonth: 1,
    salePrice: 360000,
    sellingCostPct: 1.5,
    sellingCostFixed: 3000,
    rentMonthly: 1500,
    rentGrowthPct: 0,
    ownerCostsMonthly: 250,
    ownerCostsGrowthPct: 0,
    oneOffTaxBenefit: 0,
    mortgage: {
      balance: 300000,
      annualRatePct: 4,
      termYears: 30,
      type: 'annuity',
      extraMonthly: 0,
      extraAnnual: 0,
      ratePeriods: []
    },
    tax: {enabled: false},
    investment: {enabled: false, annualReturnPct: 0, box3: {mode: 'none'}}
  };
  return {
    ...base,
    ...overrides,
    mortgage: {...base.mortgage, ...overrides.mortgage},
    tax: {...base.tax, ...overrides.tax},
    investment: {...base.investment, ...overrides.investment}
  };
}

// Closed-form references below are independent of FinanceCore's implementation.
function payment(principal, annualRatePct, months) {
  const r = annualRatePct / 1200;
  return r === 0 ? principal / months : principal * r / (1 - (1 + r) ** -months);
}
function balanceAfter(principal, annualRatePct, paymentAmount, months) {
  const r = annualRatePct / 1200;
  return r === 0 ? principal - paymentAmount * months : principal * (1 + r) ** months - paymentAmount * ((1 + r) ** months - 1) / r;
}
function monthlySeriesTotal(first, annualGrowthPct, months) {
  const ratio = (1 + annualGrowthPct / 100) ** (1 / 12);
  return ratio === 1 ? first * months : first * (ratio ** months - 1) / (ratio - 1);
}

test('hand-worked five-year case reconciles cash, total spending and avoided rent', () => {
  const result = valid(Sale.aggregate(aggregateInput()));
  close(result.initialCash, 60000);
  close(result.cashContributed, 140000);
  close(result.remainingMortgage, 270000);
  close(result.saleCosts, 8250);
  close(result.netSaleProceeds, 71750);
  close(result.ownershipProfit, -68250);
  close(result.owningCost, 68250);
  close(result.advantageVsRent, 21750);
  close(result.breakEven.cashRecovery, 413000 / 0.985);
  close(result.breakEven.rentParity, 323000 / 0.985);
  close(result.breakEven.debtClearance, 273000 / 0.985);
});

test('four sale prices distinguish returned equity from nominal profit and rent advantage', () => {
  for (const [salePrice, cash, profit, advantage] of [
    [330000, 52050, -87950, 2050],
    [350000, 71750, -68250, 21750],
    [400000, 121000, -19000, 71000],
    [420000, 140700, 700, 90700]
  ]) {
    const result = valid(Sale.aggregate(aggregateInput({salePrice})));
    close(result.netSaleProceeds, cash);
    close(result.ownershipProfit, profit);
    close(result.advantageVsRent, advantage);
  }
});

test('computed prices substituted back into the ledger hit their own zero', () => {
  const result = valid(Sale.aggregate(aggregateInput()));
  close(valid(Sale.aggregate(aggregateInput({salePrice: result.breakEven.rentParity}))).advantageVsRent, 0);
  close(valid(Sale.aggregate(aggregateInput({salePrice: result.breakEven.cashRecovery}))).ownershipProfit, 0);
  close(valid(Sale.aggregate(aggregateInput({salePrice: result.breakEven.debtClearance}))).netSaleProceeds, 0);
});

test('principal is a balance-sheet transfer when interest and tax are held unchanged', () => {
  const before = valid(Sale.aggregate(aggregateInput()));
  const after = valid(Sale.aggregate(aggregateInput({principalPaid: 40000, remainingMortgage: 260000})));
  close(after.netSaleProceeds - before.netSaleProceeds, 10000);
  close(after.cashContributed - before.cashContributed, 10000);
  close(after.ownershipProfit, before.ownershipProfit);
  close(after.advantageVsRent, before.advantageVsRent);
  close(after.breakEven.rentParity, before.breakEven.rentParity);
});

test('financing acquisition costs does not invent a gain or charge the cost twice', () => {
  const cash = valid(Sale.aggregate(aggregateInput()));
  const financed = valid(Sale.aggregate(aggregateInput({
    financedPurchaseCosts: 10000, initialMortgage: 310000, remainingMortgage: 280000
  })));
  close(financed.initialCash, 50000);
  close(financed.ownershipProfit, cash.ownershipProfit);
  close(financed.advantageVsRent, cash.advantageVsRent);
  close(financed.breakEven.rentParity, cash.breakEven.rentParity);
});

test('additional rent lowers the required price and expenses raise it with the correct fee denominator', () => {
  const base = valid(Sale.aggregate(aggregateInput()));
  const rent = valid(Sale.aggregate(aggregateInput({rentPaid: 91000})));
  const expense = valid(Sale.aggregate(aggregateInput({ownerCosts: 16000})));
  const tax = valid(Sale.aggregate(aggregateInput({netTaxBenefit: 16000})));
  close(base.breakEven.rentParity - rent.breakEven.rentParity, 1000 / 0.985);
  close(expense.breakEven.rentParity - base.breakEven.rentParity, 1000 / 0.985);
  close(base.breakEven.rentParity - tax.breakEven.rentParity, 1000 / 0.985);
  const higherSale = valid(Sale.aggregate(aggregateInput({salePrice: 350001})));
  close(higherSale.advantageVsRent - base.advantageVsRent, 0.985);
});

test('zero rent makes rental parity and complete cash recovery the same threshold', () => {
  const result = valid(Sale.aggregate(aggregateInput({rentPaid: 0})));
  close(result.breakEven.cashRecovery, result.breakEven.rentParity);
});

test('negative housing tax benefit remains a cost and sale cash shortfalls stay visible', () => {
  const tax = valid(Sale.aggregate(aggregateInput({netTaxBenefit: -1000})));
  close(tax.cashContributed, 156000);
  const lowSale = valid(Sale.aggregate(aggregateInput({salePrice: 250000})));
  close(lowSale.netSaleProceeds, -26750);
  noInvalidNumbers(lowSale);
});

test('initial-date sale at purchase price recovers the down payment exactly without costs', () => {
  const result = valid(Sale.calculate(scenario({
    months: 0, purchaseCosts: 0, salePrice: 360000, sellingCostPct: 0, sellingCostFixed: 0
  })));
  close(result.netSaleProceeds, 60000);
  close(result.cashContributed, 60000);
  close(result.ownershipProfit, 0);
  close(result.advantageVsRent, 0);
  close(result.breakEven.cashRecovery, 360000);
  close(result.breakEven.rentParity, 360000);
});

test('annuity horizon agrees with an independent closed-form mortgage calculation', () => {
  const result = valid(Sale.calculate(scenario()));
  const scheduled = payment(300000, 4, 360);
  const expectedBalance = balanceAfter(300000, 4, scheduled, 60);
  close(result.remainingMortgage, expectedBalance, 1e-5);
  close(result.totals.principalPaid, 300000 - expectedBalance, 1e-5);
  close(result.totals.interestPaid, scheduled * 60 - (300000 - expectedBalance), 1e-5);
  close(result.totals.ownerCosts, 15000);
  close(result.totals.rentPaid, 90000);
  close(result.cashContributed, 72000 + scheduled * 60 + 15000, 1e-5);
});

test('zero-rate repayments and mortgage method do not create economic profit', () => {
  const base = scenario({mortgage: {annualRatePct: 0}, investment: {enabled: true}});
  const annuity = valid(Sale.calculate(base));
  const linear = valid(Sale.calculate({...base, mortgage: {...base.mortgage, type: 'linear'}}));
  const extra = valid(Sale.calculate({...base, mortgage: {...base.mortgage, extraMonthly: 2000}}));
  close(annuity.advantageVsRent, linear.advantageVsRent);
  close(annuity.advantageVsRent, extra.advantageVsRent);
  close(annuity.breakEven.rentParity, extra.breakEven.rentParity);
  assert.ok(extra.remainingMortgage < annuity.remainingMortgage);
});

test('rent and owner-cost growth use effective annual rates with month zero unchanged', () => {
  const base = valid(Sale.calculate(scenario({months: 24})));
  const rent = valid(Sale.calculate(scenario({months: 24, rentGrowthPct: 12})));
  const owner = valid(Sale.calculate(scenario({months: 24, ownerCostsGrowthPct: 12})));
  close(rent.totals.rentPaid, monthlySeriesTotal(1500, 12, 24), 1e-5);
  close(owner.totals.ownerCosts, monthlySeriesTotal(250, 12, 24), 1e-5);
  assert.ok(rent.breakEven.rentParity < base.breakEven.rentParity);
  assert.ok(owner.breakEven.rentParity > base.breakEven.rentParity);
});

test('sale immediately before and after a rate reset uses the outstanding debt and original remaining term', () => {
  const mortgage = {ratePeriods: [{months: 12, annualRatePct: 4}, {months: 348, annualRatePct: 6}]};
  const at = valid(Sale.calculate(scenario({months: 12, mortgage})));
  const after = valid(Sale.calculate(scenario({months: 13, mortgage})));
  const firstPayment = payment(300000, 4, 360);
  const resetBalance = balanceAfter(300000, 4, firstPayment, 12);
  const secondPayment = payment(resetBalance, 6, 348);
  close(at.remainingMortgage, resetBalance, 1e-5);
  close(after.remainingMortgage, resetBalance * 1.005 - secondPayment, 1e-5);
  close(after.totals.interestPaid - at.totals.interestPaid, resetBalance * 0.005, 1e-5);
});

test('large extra payments are clipped to actual remaining principal', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 12000, downPayment: 0, purchaseCosts: 0, months: 24,
    salePrice: 12000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0,
    mortgage: {balance: 12000, annualRatePct: 0, termYears: 1, extraMonthly: 100000, extraAnnual: 100000}
  })));
  close(result.remainingMortgage, 0);
  close(result.totals.principalPaid, 12000);
  close(result.cashContributed, 12000);
  close(result.ownershipProfit, 0);
});

test('ownership expenses and rent continue after the mortgage is fully repaid', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 12000, downPayment: 0, purchaseCosts: 0, months: 24,
    salePrice: 12000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 200, ownerCostsMonthly: 100,
    mortgage: {balance: 12000, annualRatePct: 0, termYears: 1}
  })));
  close(result.remainingMortgage, 0);
  close(result.totals.principalPaid, 12000);
  close(result.totals.ownerCosts, 2400);
  close(result.totals.rentPaid, 4800);
  close(result.ownershipProfit, -2400);
  close(result.advantageVsRent, 2400);
});

test('one-off tax benefits enter only at their specified month and retain their sign', () => {
  const before = valid(Sale.calculate(scenario({months: 5, oneOffTaxBenefit: 2000, oneOffTaxMonth: 6})));
  const without = valid(Sale.calculate(scenario({months: 5})));
  close(before.advantageVsRent, without.advantageVsRent);
  const at = valid(Sale.calculate(scenario({months: 6, oneOffTaxBenefit: 2000, oneOffTaxMonth: 6})));
  const atWithout = valid(Sale.calculate(scenario({months: 6})));
  close(at.advantageVsRent - atWithout.advantageVsRent, 2000);
  const charge = valid(Sale.calculate(scenario({months: 6, oneOffTaxBenefit: -2000, oneOffTaxMonth: 6})));
  close(charge.advantageVsRent - atWithout.advantageVsRent, -2000);
});

test('investment comparison at zero return reproduces the basic cash comparison', () => {
  for (const overrides of [
    {},
    {rentMonthly: 3000},
    {rentMonthly: 100, ownerCostsMonthly: 2000},
    {oneOffTaxBenefit: 20000, oneOffTaxMonth: 1},
    {mortgage: {extraMonthly: 100000}},
    {financedPurchaseCosts: 12000, mortgage: {balance: 312000}}
  ]) {
    const result = valid(Sale.calculate(scenario({...overrides, investment: {enabled: true}})));
    close(result.investment.advantage, result.advantageVsRent, 1e-5);
    close(result.investment.breakEvenSalePrice, result.breakEven.rentParity, 1e-5);
  }
});

test('positive and negative alternative investment returns compound the retained initial cash', () => {
  for (const annualReturnPct of [-5, 5]) {
    const result = valid(Sale.calculate(scenario({
      purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 60,
      salePrice: 120000, sellingCostPct: 0, sellingCostFixed: 0,
      rentMonthly: 0, ownerCostsMonthly: 0,
      mortgage: {balance: 0, annualRatePct: 0},
      investment: {enabled: true, annualReturnPct}
    })));
    const renterPortfolio = 100000 * (1 + annualReturnPct / 100) ** 5;
    close(result.investment.renterTerminalInvestments, renterPortfolio, 1e-5);
    close(result.investment.ownerTerminalInvestments, 0);
    close(result.investment.advantage, 120000 - renterPortfolio, 1e-5);
    close(result.investment.breakEvenSalePrice, renterPortfolio, 1e-5);
  }
});

test('both alternatives can invest their own monthly cash surplus under the same budget', () => {
  for (const ownerCostsMonthly of [0, 1500]) {
    const result = valid(Sale.calculate(scenario({
      purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
      salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
      rentMonthly: 1000, ownerCostsMonthly,
      mortgage: {balance: 0, annualRatePct: 0},
      investment: {enabled: true, annualReturnPct: 6}
    })));
    const monthlyRate = 1.06 ** (1 / 12) - 1;
    const contributionFactor = (1.06 - 1) / monthlyRate;
    const owner = Math.max(0, 1000 - ownerCostsMonthly) * contributionFactor;
    const renter = 106000 + Math.max(0, ownerCostsMonthly - 1000) * contributionFactor;
    close(result.investment.ownerTerminalInvestments, owner, 1e-5);
    close(result.investment.renterTerminalInvestments, renter, 1e-5);
    close(result.investment.advantage, 100000 + owner - renter, 1e-5);
  }
});

test('a negative net ownership payment is available to invest instead of being discarded', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
    salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0, oneOffTaxBenefit: 10000, oneOffTaxMonth: 1,
    mortgage: {balance: 0, annualRatePct: 0},
    investment: {enabled: true, annualReturnPct: 6}
  })));
  const owner = 10000 * 1.06 ** (11 / 12);
  close(result.investment.ownerTerminalInvestments, owner, 1e-5);
  close(result.investment.advantage, 100000 + owner - 106000, 1e-5);
});

test('aggregate rejects contradictory purchase funding, debt and invalid sale-cost rates', () => {
  for (const input of [
    aggregateInput({initialMortgage: 301000}),
    aggregateInput({remainingMortgage: 269000}),
    aggregateInput({financedPurchaseCosts: 11000, initialMortgage: 311000, remainingMortgage: 281000}),
    aggregateInput({sellingCostPct: 100}),
    aggregateInput({sellingCostPct: -1}),
    aggregateInput({purchasePrice: NaN}),
    aggregateInput({purchasePrice: ''}),
    aggregateInput({salePrice: Infinity}),
    aggregateInput({principalPaid: -1})
  ]) {
    const result = Sale.aggregate(input);
    assert.equal(result.valid, false, `should reject ${JSON.stringify(input)}`);
    assert.ok(result.errors.length > 0);
    noInvalidNumbers(result);
  }
});

test('calculate blocks malformed and missing inputs rather than silently producing zero-cost results', () => {
  for (const input of [
    {},
    scenario({purchasePrice: ''}),
    scenario({months: -1}),
    scenario({months: 1.5}),
    scenario({salePrice: NaN}),
    scenario({rentMonthly: -1}),
    scenario({rentGrowthPct: -100}),
    scenario({mortgage: {balance: 299000}}),
    scenario({mortgage: {annualRatePct: -1}}),
    scenario({mortgage: {termYears: 0}}),
    scenario({investment: {enabled: true, annualReturnPct: -100}})
  ]) {
    const result = Sale.calculate(input);
    assert.equal(result.valid, false, `should reject ${JSON.stringify(input)}`);
    assert.ok(result.errors.length > 0);
    noInvalidNumbers(result);
  }
});

test('annual thresholds recalculate each prospective sale year without later tax allocation leaking backward', () => {
  const input = scenario({
    months: 30, startMonth: 7,
    tax: {enabled: true, calculationMode: 'manual-rate', deductionRate: 0.37, wozValue: 400000,
      hraRemainingMonths: 360, qualifyingInterestFraction: 1}
  });
  const full = valid(Sale.calculate(input));
  assert.deepEqual(full.annual.map(entry => entry.months), [12, 24, 30]);
  for (const entry of full.annual) {
    const separate = valid(Sale.calculate({...input, months: entry.months}));
    close(entry.totals.netTaxBenefit, separate.totals.netTaxBenefit);
    close(entry.breakEven.rentParity, separate.breakEven.rentParity);
    close(entry.breakEven.cashRecovery, separate.breakEven.cashRecovery);
    close(entry.advantageVsRent, separate.advantageVsRent);
  }
  const wronglySlicedTax = full.rows.slice(0, 12).reduce((total, row) => total + row.netTaxBenefit, 0);
  assert.ok(Math.abs(full.annual[0].totals.netTaxBenefit - wronglySlicedTax) > 1,
    'fixture must exercise the difference between fresh sale-year tax and a longer schedule prefix');
  assert.equal(full.period.start, '2026-07');
  assert.equal(full.period.end, '2028-12');
  assert.equal(full.period.months, 30);
  assert.equal(full.annual[0].period.end, '2027-06');
});

test('calendar-month annual and dated extra repayments occur on their entered dates', () => {
  const result = valid(Sale.calculate(scenario({
    months: 14, startMonth: 11,
    mortgage: {annualRatePct: 0, extraAnnual: 3000, extraAnnualMonth: 12,
      extraPayments: [{monthIndex: 2, amount: 400}, {monthIndex: 2, amount: 600}]}
  })));
  close(result.rows[0].extra, 0);
  close(result.rows[1].extra, 3000);
  close(result.rows[2].extra, 1000);
  close(result.rows[13].extra, 3000);
  close(result.totals.extraPrincipalPaid, 7000);
  assert.equal(result.rows[1].month, 12);
  assert.equal(result.rows[13].year, 2027);
});

test('negative EWF/Hillen net tax continues through ownership after mortgage payoff', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 400000, downPayment: 388000, purchaseCosts: 0, months: 24,
    mortgage: {balance: 12000, annualRatePct: 0, termYears: 1},
    tax: {enabled: true, calculationMode: 'manual-rate', deductionRate: 0.37,
      wozValue: 400000, hraRemainingMonths: 12, qualifyingInterestFraction: 1}
  })));
  close(result.remainingMortgage, 0);
  assert.ok(result.totals.netTaxBenefit < 0);
  assert.ok(result.rows.slice(12).every(row => row.gross === 0 && row.taxReturn < 0));
  assert.ok(result.cashContributed > result.initialCash + result.totals.principalPaid + result.totals.ownerCosts);
});

test('automatic Box 1 high-income benefit agrees with independent deduction and EWF rates', () => {
  const result = valid(Sale.calculate(scenario({
    months: 12,
    tax: {enabled: true, calculationMode: 'box1-2026', box1IncomeBeforeOwnHome: 100000,
      deductionRate: 0.3756, wozValue: 400000, hraRemainingMonths: 360,
      qualifyingInterestFraction: 1, box1Profile: 'non-aow-employment-2026'}
  })));
  const expected = result.totals.interestPaid * 0.3756 - 400000 * 0.0035 * 0.495;
  close(result.totals.netTaxBenefit, expected, 1e-6);
  assert.equal(result.annualTaxBuckets[2026].box1Trace.supported, true);
});

test('browser and Node entry points use the same automatic Box 1 calculation', () => {
  const browser = vm.createContext({});
  const root = path.resolve(__dirname, '..');
  for (const file of ['policy-2026.js', 'model-contract.js', 'finance-core.js', 'box1-2026.js', 'logic-integrity-ui.js', 'sale-break-even.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), browser, {filename: file});
    if (file === 'logic-integrity-ui.js') vm.runInContext('LogicIntegrityUI.decorateFinanceCore(FinanceCore)', browser);
  }
  const input = scenario({
    months: 27, startMonth: 4,
    tax: {enabled: true, calculationMode: 'box1-2026', box1IncomeBeforeOwnHome: 100000,
      deductionRate: 0.3756, wozValue: 400000, hraRemainingMonths: 360, qualifyingInterestFraction: 1},
    investment: {enabled: true, annualReturnPct: 5}
  });
  browser.inputJSON = JSON.stringify(input);
  const browserResult = JSON.parse(vm.runInContext('JSON.stringify(SaleBreakEvenCore.calculate(JSON.parse(inputJSON)))', browser));
  const nodeResult = JSON.parse(JSON.stringify(Sale.calculate(input)));
  assert.deepEqual(browserResult, nodeResult);
});

test('unsupported automatic Box 1 profile is unavailable instead of silently returning zero relief', () => {
  const result = Sale.calculate(scenario({
    tax: {enabled: true, calculationMode: 'box1-2026', box1IncomeBeforeOwnHome: 60000,
      wozValue: 400000, box1Profile: 'aow'}
  }));
  assert.equal(result.valid, false);
  assert.match(result.reason, /Box 1|profile|AOW/i);
});

test('current Box 3 reduces the renter investment using the existing actual-return comparison', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
    salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0,
    mortgage: {balance: 0, annualRatePct: 0},
    investment: {enabled: true, annualReturnPct: 5,
      box3: {mode: 'current', currentAllowance: 0, currentNotional: 0.06, currentTaxRate: 0.36,
        paySource: 'portfolio', taxPartners: 1}}
  })));
  assert.equal(result.investment.available, true);
  close(result.investment.owner.totalTax, 0);
  close(result.investment.renter.totalTax, 1800, 1e-6);
  close(result.investment.renterTerminalInvestments, 103200, 1e-5);
  close(result.investment.advantage, -3200, 1e-5);
});

test('common starting investments, remaining savings and debt are retained on both sides', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
    salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0,
    mortgage: {balance: 0, annualRatePct: 0},
    investment: {enabled: true, annualReturnPct: 0, commonInitialPortfolio: 80000,
      box3: {mode: 'current', savings: 20000, debt: 10000, savingsReturnPct: 0, debtInterestPct: 0}}
  })));
  close(result.investment.owner.portfolio, 80000);
  close(result.investment.renter.portfolio, 180000);
  for (const side of [result.investment.owner, result.investment.renter]) {
    close(side.savings, 20000);
    close(side.box3Debt, 10000);
    close(side.totalTax, 0);
  }
  close(result.investment.advantage, 0);
});

test('missing January 1 snapshots block only the midyear Box 3 comparison', () => {
  const input = scenario({months: 12, startMonth: 7,
    investment: {enabled: true, annualReturnPct: 5, box3: {mode: 'current'}}});
  const missing = valid(Sale.calculate(input));
  assert.equal(missing.investment.enabled, true);
  assert.equal(missing.investment.available, false);
  assert.match(missing.investment.reason, /January 1/);
  assert.equal(typeof missing.advantageVsRent, 'number');
  const explicit = valid(Sale.calculate({...input, investment: {...input.investment,
    box3: {mode: 'current', firstJan1Portfolio: 0, firstJan1Savings: 0, firstJan1Debt: 0}}}));
  assert.equal(explicit.investment.available, true);
});

test('common monthly investment is added equally and cancels from the before-tax comparison', () => {
  const input = scenario({
    purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
    salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0,
    mortgage: {balance: 0, annualRatePct: 0},
    investment: {enabled: true, annualReturnPct: 5, commonMonthlyContribution: 500}
  });
  const result = valid(Sale.calculate(input));
  const monthlyRate = 1.05 ** (1 / 12) - 1;
  const commonPortfolio = 500 * (1.05 - 1) / monthlyRate;
  close(result.investment.ownerTerminalInvestments, commonPortfolio, 1e-5);
  close(result.investment.renterTerminalInvestments, 105000 + commonPortfolio, 1e-5);
  close(result.investment.advantage, -5000, 1e-5);
  assert.ok(result.investment.ownerContributions.every(value => value === 500));
  assert.ok(result.investment.renterContributions.every(value => value === 500));
  assert.ok(result.investment.monthlyBudget.every(value => value === 500));
});

test('common monthly investments participate in each alternative’s Box 3 result', () => {
  const result = valid(Sale.calculate(scenario({
    purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
    salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0,
    mortgage: {balance: 0, annualRatePct: 0},
    investment: {enabled: true, annualReturnPct: 5, commonMonthlyContribution: 500,
      box3: {mode: 'current', currentAllowance: 0, currentNotional: 0.06,
        currentTaxRate: 0.36, paySource: 'portfolio', taxPartners: 1}}
  })));
  const monthlyRate = 1.05 ** (1 / 12) - 1;
  const commonPortfolio = 500 * (1.05 - 1) / monthlyRate;
  const renterTax = (5000 + commonPortfolio - 6000) * 0.36;
  close(result.investment.owner.totalTax, 0);
  close(result.investment.renter.totalTax, renterTax, 1e-5);
  close(result.investment.advantage, -5000 + renterTax, 1e-5);
});

test('an original mortgage term over 30 years blocks automatic qualifying Box 1 relief', () => {
  const input = scenario({
    mortgage: {termYears: 31},
    tax: {enabled: true, calculationMode: 'box1-2026', box1IncomeBeforeOwnHome: 60000,
      wozValue: 400000, qualifyingInterestFraction: 1}
  });
  const blocked = Sale.calculate(input);
  assert.equal(blocked.valid, false);
  assert.match(blocked.reason, /30|term|qualif/i);
  valid(Sale.calculate({...input, tax: {enabled: false}}));
  valid(Sale.calculate({...input, tax: {...input.tax, qualifyingInterestFraction: 0}}));
});

test('a proposed-regime incomplete final year keeps the cash result but no after-tax investment conclusion', () => {
  const input = scenario({months: 6, startYear: 2028,
    investment: {enabled: true, annualReturnPct: 5, box3: {mode: 'future'}}});
  const result = valid(Sale.calculate(input));
  assert.equal(result.investment.available, false);
  assert.equal(Number.isFinite(result.investment.advantage), false);
  assert.equal(Number.isFinite(result.investment.breakEvenSalePrice), false);
  assert.match(result.investment.reason, /partial|incomplete|estim|tax/i);
  assert.equal(Number.isFinite(result.advantageVsRent), true);
  const complete = valid(Sale.calculate({...input, months: 12}));
  assert.equal(complete.investment.available, true);
});

test('dated renovation costs enter only when paid and retain their investment timing', () => {
  const before = valid(Sale.calculate(scenario({months: 5, oneOffOwnerCost: 5000, oneOffOwnerCostMonth: 6})));
  const beforeWithout = valid(Sale.calculate(scenario({months: 5})));
  close(before.totals.oneOffOwnerCosts, 0);
  close(before.advantageVsRent, beforeWithout.advantageVsRent);
  const paid = valid(Sale.calculate(scenario({months: 6, oneOffOwnerCost: 5000, oneOffOwnerCostMonth: 6})));
  const paidWithout = valid(Sale.calculate(scenario({months: 6})));
  close(paid.totals.recurringOwnerCosts, 1500);
  close(paid.totals.oneOffOwnerCosts, 5000);
  close(paid.totals.ownerCosts, 6500);
  close(paid.rows[5].oneOffOwnerCosts, 5000);
  close(paid.advantageVsRent - paidWithout.advantageVsRent, -5000);

  const investmentInput = scenario({
    purchasePrice: 100000, downPayment: 100000, purchaseCosts: 0, months: 12,
    salePrice: 100000, sellingCostPct: 0, sellingCostFixed: 0,
    rentMonthly: 0, ownerCostsMonthly: 0,
    mortgage: {balance: 0, annualRatePct: 0},
    investment: {enabled: true, annualReturnPct: 6}
  });
  const base = valid(Sale.calculate(investmentInput));
  const early = valid(Sale.calculate({...investmentInput, oneOffOwnerCost: 5000, oneOffOwnerCostMonth: 1}));
  const late = valid(Sale.calculate({...investmentInput, oneOffOwnerCost: 5000, oneOffOwnerCostMonth: 12}));
  close(early.advantageVsRent, late.advantageVsRent);
  close(early.investment.advantage - base.investment.advantage, -5000 * 1.06 ** (11 / 12), 1e-5);
  close(late.investment.advantage - base.investment.advantage, -5000, 1e-5);
});

test('unrelated active planner tax context cannot alter the standalone sale scenario', () => {
  const Box1 = require('../box1-2026.js');
  const input = scenario({months: 24,
    tax: {enabled: true, deductionRate: 0.37, wozValue: 400000}});
  const standalone = valid(Sale.calculate(input));
  const inherited = Box1.withTaxContext({calculationMode: 'box1-2026', box1IncomeBeforeOwnHome: 100000,
    hillenRelief: 0, qualifyingInterestFraction: 0}, () => {
    const result = valid(Sale.calculate(input));
    assert.equal(Box1.normalizeTaxConfig({}).box1IncomeBeforeOwnHome, 100000,
      'the caller’s context must be restored after the sale calculation');
    return result;
  });
  assert.deepEqual(inherited, standalone);
});

test('explicit sale January 1 snapshots override blank or conflicting main-planner DOM fields', () => {
  const browser = vm.createContext({});
  const root = path.resolve(__dirname, '..');
  for (const file of ['policy-2026.js', 'model-contract.js', 'finance-core.js', 'box1-2026.js', 'logic-integrity-ui.js', 'sale-break-even.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), browser, {filename: file});
    if (file === 'logic-integrity-ui.js') vm.runInContext('LogicIntegrityUI.decorateFinanceCore(FinanceCore)', browser);
  }
  const input = scenario({months: 10, startMonth: 3,
    investment: {enabled: true, annualReturnPct: 5, commonInitialPortfolio: 5000,
      box3: {mode: 'current', savings: 60000, savingsReturnPct: 2,
        firstJan1Portfolio: 0, firstJan1Savings: 60000, firstJan1Debt: 0}}});
  const expected = JSON.parse(JSON.stringify(valid(Sale.calculate(input))));
  assert.equal(expected.investment.available, true);
  browser.inputJSON = JSON.stringify(input);
  browser.document = {getElementById: id => browser.mainFields[id] || null};
  for (const fields of [
    {firstJan1Portfolio: {value: ''}, firstJan1Savings: {value: ''}, firstJan1Debt: {value: ''},
      assumePlanStartAsJan1: {checked: false}},
    {firstJan1Portfolio: {value: '999999'}, firstJan1Savings: {value: '111111'}, firstJan1Debt: {value: '222222'},
      assumePlanStartAsJan1: {checked: true}}
  ]) {
    browser.mainFields = fields;
    const actual = JSON.parse(vm.runInContext('JSON.stringify(SaleBreakEvenCore.calculate(JSON.parse(inputJSON)))', browser));
    assert.equal(actual.investment.available, true);
    for (const side of [actual.investment.owner, actual.investment.renter]) {
      assert.equal(side.jan1SnapshotSource, 'entered');
      close(side.yearBuckets[2026].jan1Portfolio, 0);
      close(side.yearBuckets[2026].jan1Savings, 60000);
      close(side.yearBuckets[2026].jan1Debt, 0);
    }
    assert.deepEqual(actual, expected);
  }
});
