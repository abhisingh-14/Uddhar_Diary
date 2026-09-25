const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSplit, SplitError } = require('./splitCalculator');

test('₹300 among You/B/C, You paid → two debts of 100 each', (t) => {
  const result = calculateSplit({
    totalPaise: 30000,
    participantIds: ['B', 'C'],
    payer: 'you'
  });

  assert.equal(result.userSharePaise, 10000);
  assert.equal(result.debts.length, 2);
  
  const bDebt = result.debts.find(d => d.personId === 'B');
  const cDebt = result.debts.find(d => d.personId === 'C');
  
  assert.ok(bDebt);
  assert.ok(cDebt);
  assert.equal(bDebt.direction, 'they_owe_you');
  assert.equal(bDebt.amountPaise, 10000);
  assert.equal(cDebt.direction, 'they_owe_you');
  assert.equal(cDebt.amountPaise, 10000);
});

test('B paid → single debt to B for 100, none for C', (t) => {
  const result = calculateSplit({
    totalPaise: 30000,
    participantIds: ['B', 'C'],
    payer: 'B'
  });

  assert.equal(result.userSharePaise, 10000);
  assert.equal(result.debts.length, 1);
  
  assert.equal(result.debts[0].personId, 'B');
  assert.equal(result.debts[0].direction, 'you_owe_them');
  assert.equal(result.debts[0].amountPaise, 10000);
});

test('C paid → mirrors B', (t) => {
  const result = calculateSplit({
    totalPaise: 30000,
    participantIds: ['B', 'C'],
    payer: 'C'
  });

  assert.equal(result.userSharePaise, 10000);
  assert.equal(result.debts.length, 1);
  
  assert.equal(result.debts[0].personId, 'C');
  assert.equal(result.debts[0].direction, 'you_owe_them');
  assert.equal(result.debts[0].amountPaise, 10000);
});

test('You paid, C already paid ₹50 → C debt is 50, userSharePaise still 100', (t) => {
  const result = calculateSplit({
    totalPaise: 30000,
    participantIds: ['B', 'C'],
    payer: 'you',
    alreadyPaid: { C: 5000 }
  });

  assert.equal(result.userSharePaise, 10000);
  assert.equal(result.debts.length, 2);
  
  const bDebt = result.debts.find(d => d.personId === 'B');
  const cDebt = result.debts.find(d => d.personId === 'C');
  
  assert.ok(bDebt);
  assert.ok(cDebt);
  assert.equal(bDebt.direction, 'they_owe_you');
  assert.equal(bDebt.amountPaise, 10000);
  assert.equal(cDebt.direction, 'they_owe_you');
  assert.equal(cDebt.amountPaise, 5000); // 10000 - 5000 already paid
});

test('fully-paid participant produces no debt row', (t) => {
  const result = calculateSplit({
    totalPaise: 30000,
    participantIds: ['B', 'C'],
    payer: 'you',
    alreadyPaid: { B: 10000 } // B paid their full share
  });

  assert.equal(result.userSharePaise, 10000);
  assert.equal(result.debts.length, 1);
  
  assert.equal(result.debts[0].personId, 'C');
  assert.equal(result.debts[0].direction, 'they_owe_you');
  assert.equal(result.debts[0].amountPaise, 10000);
});

test('₹100 among 3 people → shares 3334/3333/3333, sum to exactly 10000', (t) => {
  const result = calculateSplit({
    totalPaise: 10000,
    participantIds: ['B', 'C'],
    payer: 'you'
  });

  assert.equal(result.userSharePaise, 3334); // You gets the leftover paisa
  
  const bDebt = result.debts.find(d => d.personId === 'B');
  const cDebt = result.debts.find(d => d.personId === 'C');
  
  assert.ok(bDebt);
  assert.ok(cDebt);
  assert.equal(bDebt.amountPaise, 3333);
  assert.equal(cDebt.amountPaise, 3333);
  
  // Verify sum equals total
  const totalDebts = result.debts.reduce((sum, d) => sum + d.amountPaise, 0);
  assert.equal(result.userSharePaise + totalDebts, 10000);
});

test('property test: userSharePaise + sum(debts) === totalPaise when you are payer', (t) => {
  for (let totalPaise = 1; totalPaise <= 500; totalPaise++) {
    for (let participantCount = 1; participantCount <= 6; participantCount++) {
      const participantIds = Array.from({ length: participantCount }, (_, i) => `P${i}`);
      
      // Test with payer = 'you'
      const resultYou = calculateSplit({
        totalPaise,
        participantIds,
        payer: 'you'
      });
      
      const totalDebtsYou = resultYou.debts.reduce((sum, d) => sum + d.amountPaise, 0);
      assert.equal(
        resultYou.userSharePaise + totalDebtsYou,
        totalPaise,
        `Failed for totalPaise=${totalPaise}, participants=${participantCount}, payer=you`
      );
    }
  }
});

test('rejection: payer not a participant', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'C'],
      payer: 'D'
    }),
    SplitError
  );
});

test('rejection: alreadyPaid supplied with non-you payer', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'C'],
      payer: 'B',
      alreadyPaid: { C: 5000 }
    }),
    SplitError
  );
});

test('rejection: alreadyPaid amount exceeding share', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'C'],
      payer: 'you',
      alreadyPaid: { B: 15000 } // More than their 10000 share
    }),
    SplitError
  );
});

test('rejection: alreadyPaid referencing non-participant', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'C'],
      payer: 'you',
      alreadyPaid: { D: 5000 }
    }),
    SplitError
  );
});

test('rejection: duplicate participantIds', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'B'],
      payer: 'you'
    }),
    SplitError
  );
});

test('rejection: empty participantIds', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: [],
      payer: 'you'
    }),
    SplitError
  );
});

test('rejection: non-integer totalPaise', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000.5,
      participantIds: ['B', 'C'],
      payer: 'you'
    }),
    SplitError
  );
});

test('rejection: non-positive totalPaise', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 0,
      participantIds: ['B', 'C'],
      payer: 'you'
    }),
    SplitError
  );

  assert.throws(
    () => calculateSplit({
      totalPaise: -100,
      participantIds: ['B', 'C'],
      payer: 'you'
    }),
    SplitError
  );
});

test('rejection: alreadyPaid amount not a safe integer', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'C'],
      payer: 'you',
      alreadyPaid: { B: 10000.5 }
    }),
    SplitError
  );
});

test('rejection: alreadyPaid amount negative', (t) => {
  assert.throws(
    () => calculateSplit({
      totalPaise: 30000,
      participantIds: ['B', 'C'],
      payer: 'you',
      alreadyPaid: { B: -100 }
    }),
    SplitError
  );
});
