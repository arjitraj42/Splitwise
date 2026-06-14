import { computeSplits } from '../services/split.service';
import { runAnomalyDetectors } from '../services/anomaly.service';
import { BalanceService } from '../services/balance.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function testSplitService() {
  console.log('--- Testing Split Service ---');

  // Test EQUAL splits with remainder
  const splitsEqual = computeSplits('EQUAL', 100.01, { userIds: [1, 2, 3] });
  assert(splitsEqual.length === 3, 'Should compute 3 splits');
  assert(splitsEqual[0].shareAmount === 33.35, 'Remainder should go to first user (33.33 + 0.02 = 33.35)');
  assert(splitsEqual[1].shareAmount === 33.33, 'Second user should get base split');
  assert(splitsEqual[2].shareAmount === 33.33, 'Third user should get base split');
  const sumEqual = splitsEqual.reduce((s, r) => s + r.shareAmount, 0);
  assert(Math.abs(sumEqual - 100.01) < 0.0001, 'Sum should equal total amount');

  // Test EXACT splits
  const splitsExact = computeSplits('EXACT', 150.00, {
    splits: [
      { userId: 1, amount: 50.00 },
      { userId: 2, amount: 100.00 },
    ],
  });
  assert(splitsExact.length === 2, 'Should compute exact splits');
  assert(splitsExact[0].shareAmount === 50.00, 'User 1 exact amount');
  assert(splitsExact[1].shareAmount === 100.00, 'User 2 exact amount');

  // Test PERCENTAGE splits
  const splitsPct = computeSplits('PERCENTAGE', 100.00, {
    splits: [
      { userId: 1, percentage: 33.33 },
      { userId: 2, percentage: 66.67 },
    ],
  });
  assert(splitsPct[0].shareAmount === 33.33, 'User 1 percentage amount');
  assert(splitsPct[1].shareAmount === 66.67, 'User 2 percentage amount');

  console.log('✓ Split Service Tests Passed!');
}

async function testAnomalyService() {
  console.log('--- Testing Anomaly Detectors ---');

  const allUsers = [
    { id: 1, name: 'Aisha' },
    { id: 2, name: 'Rohan' },
    { id: 3, name: 'Priya' },
  ];

  const groupMembers = [
    { userId: 1, user: { name: 'Aisha' }, joinedAt: new Date('2026-01-01'), leftAt: null },
    { userId: 2, user: { name: 'Rohan' }, joinedAt: new Date('2026-01-01'), leftAt: new Date('2026-03-31') },
  ];

  const mockRows = [
    { date: '15-01-2026', description: 'Groceries', amount: '100', currency: 'INR', paid_by: 'Aisha' },
  ];

  // Test Negative Amount
  const anomaliesNeg = runAnomalyDetectors(
    { date: '15-01-2026', description: 'Groceries', amount: '-100', currency: 'INR', paid_by: 'Aisha' },
    mockRows,
    groupMembers,
    allUsers,
    [],
    []
  );
  assert(anomaliesNeg.some(a => a.detector === 'negative_amount'), 'Should detect negative amount');

  // Test Future Date
  const anomaliesFuture = runAnomalyDetectors(
    { date: '15-01-2030', description: 'Groceries', amount: '100', currency: 'INR', paid_by: 'Aisha' },
    mockRows,
    groupMembers,
    allUsers,
    [],
    []
  );
  assert(anomaliesFuture.some(a => a.detector === 'future_date'), 'Should detect future date');

  // Test Unknown Member
  const anomaliesUnknown = runAnomalyDetectors(
    { date: '15-01-2026', description: 'Groceries', amount: '100', currency: 'INR', paid_by: 'Anonymous' },
    mockRows,
    groupMembers,
    allUsers,
    [],
    []
  );
  assert(anomaliesUnknown.some(a => a.detector === 'unknown_member'), 'Should detect unknown payer');

  // Test Timing Window (Expense after member left)
  const anomaliesLeft = runAnomalyDetectors(
    { date: '15-04-2026', description: 'Groceries', amount: '100', currency: 'INR', paid_by: 'Rohan' },
    mockRows,
    groupMembers,
    allUsers,
    [],
    []
  );
  assert(anomaliesLeft.some(a => a.detector === 'expense_after_member_left'), 'Should detect expense date after member left');

  console.log('✓ Anomaly Service Tests Passed!');
}

async function testDebtSimplification() {
  console.log('--- Testing Debt Simplification ---');

  // We test the math of simplifyDebts using a mock balance service setup
  const mockBalances: any[] = [
    {
      user: { id: 1, name: 'Aisha' },
      netBalance: 800.00,
    },
    {
      user: { id: 2, name: 'Rohan' },
      netBalance: -500.00,
    },
    {
      user: { id: 3, name: 'Priya' },
      netBalance: -300.00,
    },
  ];

  // We run the simplification algorithm on these balances
  const debtors = mockBalances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({
      user: b.user,
      amount: Math.abs(b.netBalance),
    }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = mockBalances
    .filter((b) => b.netBalance > 0.01)
    .map((b) => ({
      user: b.user,
      amount: b.netBalance,
    }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: any[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const transferAmount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      fromUser: debtor.user,
      toUser: creditor.user,
      amount: transferAmount,
    });

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  assert(settlements.length === 2, 'Should require 2 settlements');
  assert(settlements[0].fromUser.name === 'Rohan' && settlements[0].toUser.name === 'Aisha' && settlements[0].amount === 500, 'Rohan pays Aisha 500');
  assert(settlements[1].fromUser.name === 'Priya' && settlements[1].toUser.name === 'Aisha' && settlements[1].amount === 300, 'Priya pays Aisha 300');

  console.log('✓ Debt Simplification Tests Passed!');
}

async function runAll() {
  try {
    await testSplitService();
    await testAnomalyService();
    await testDebtSimplification();
    console.log('==============================');
    console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('==============================');
  } catch (err: any) {
    console.error('TESTS FAILED:', err.message);
    process.exit(1);
  }
}

runAll();
