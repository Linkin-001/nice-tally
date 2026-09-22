const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const storage = new Map();
let failStorage = false;
const uni = { setStorageSync(key, value) { if (failStorage) throw new Error('quota'); storage.set(key, value); }, showModal() {} };
function load(file) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
  assert.equal(result.diagnostics.length, 0, 'UTS-compatible TypeScript syntax');
  const exports = {};
  vm.runInNewContext(result.outputText, { exports, uni, Date, Math, JSON, Number, Array, console });
  return exports;
}
const ledger = load('common/tally/ledger.uts');
const hash = load('common/tally/sha256.uts');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS', name); }
test('decimal amounts use exact integer cents', () => {
  assert.equal(ledger.parseMoney('0.29'), 29);
  assert.equal(ledger.parseMoney('0.10') + ledger.parseMoney('0.20'), 30);
  assert.equal(ledger.parseMoney('-12.01'), -1201);
  for (const value of ['1.234', 'NaN', 'Infinity', '1e3', '', '1.', '100000000', '--2']) assert.equal(ledger.parseMoney(value), null);
});
test('strict date validation includes leap years', () => {
  assert.equal(ledger.validDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-13-01', '2026-04-31', '1999-01-01', '2026-1-01']) assert.equal(ledger.validDate(value), false);
});
const db = ledger.emptyLedger(); db.started = true; db.records = ledger.sampleRecords();
test('summary and people aggregations reconcile all mixed transactions', () => {
  const total = ledger.totals(db.records);
  assert.equal(total.income, 73000); assert.equal(total.expense, 44000); assert.equal(total.net, 29000);
  assert.equal(total.count, 4); assert.equal(total.people, 5);
  assert.equal(ledger.peopleTotals(db.records).reduce((s, p) => s + p.net, 0), total.net);
  assert.equal(ledger.monthRecords(db.records, ledger.today().slice(0, 7)).length, 4);
  assert.equal(ledger.monthRecords(db.records, '2000-01').length, 0);
});
test('backup round trip preserves records but excludes lock verifier', () => {
  db.preferences.pinHash = 'sensitive'; db.preferences.pinSalt = 'salt';
  const backup = ledger.backupText(db);
  assert.equal(backup.includes('sensitive'), false);
  const imported = ledger.parseLedger(backup);
  assert.equal(imported.records.length, 4); assert.equal(imported.preferences.pinHash, '');
  assert.equal(JSON.stringify(imported.records), JSON.stringify(db.records));
});
test('malformed and unsupported backups never validate', () => {
  for (const value of ['{', '{}', 'null', '[]', '42', '"str"']) assert.equal(ledger.parseLedger(value), null);
  const mutations = [d => d.version = 9, d => d.records = {}, d => d.preferences = {}, d => d.records[0].people[0].cents = '80', d => d.records[0].people[0].cents = 0.1, d => d.records[0].people[0].name = '', d => d.records[0].date = '2026-02-30', d => d.records.push(d.records[0]), d => d.records[0].people = [null], d => d.preferences.theme = 'invalid'];
  for (const mutate of mutations) { const copy = ledger.cloneLedger(db); mutate(copy); assert.equal(ledger.parseLedger(JSON.stringify(copy)), null); }
});
test('drafts accept incomplete input while final records reject it', () => {
  const record = ledger.newActivity('聚餐');
  assert.equal(ledger.activityError(record, true), '');
  assert.notEqual(ledger.activityError(record, false), '');
  const copy = ledger.cloneLedger(db); copy.drafts.push(record);
  assert.notEqual(ledger.parseLedger(JSON.stringify(copy)), null);
});
test('duplicate names must be merged within a final activity', () => {
  const record = ledger.cloneActivity(db.records[0]); record.people[1].name = record.people[0].name;
  assert.match(ledger.activityError(record), /重复/);
});
test('storage writes atomically and surfaces quota failure', () => {
  assert.equal(ledger.persistLedger(db), true);
  const saved = storage.get(ledger.STORAGE_KEY); failStorage = true;
  assert.equal(ledger.persistLedger(ledger.emptyLedger()), false);
  assert.equal(storage.get(ledger.STORAGE_KEY), saved); failStorage = false;
});
test('CSV quotes commas, newlines and protects against formula injection', () => {
  const copy = ledger.cloneLedger(db); copy.records[0].people[0].name = '=SUM(A1)'; copy.records[0].place = '测试,"地点"'; copy.records[0].note = ' \t+1+1\n换行';
  const csv = ledger.csvText(copy);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('"\'=SUM(A1)"'));
  assert.ok(csv.includes('"测试,""地点"""'));
  assert.ok(csv.includes('"\' \t+1+1\n换行"'));
});
test('SHA-256 matches standard empty/abc/multiblock vectors', () => {
  for (const value of ['', 'abc', 'a'.repeat(300), '2026-salt:123456']) assert.equal(hash.sha256(value), crypto.createHash('sha256').update(value).digest('hex'));
  assert.equal(hash.pinVerifier('salt', '123456'), hash.pinVerifier('salt', '123456'));
  assert.notEqual(hash.pinVerifier('salt', '123456'), hash.pinVerifier('salt', '123457'));
});
console.log(`\n${count} meaningful ledger checks passed.`);
