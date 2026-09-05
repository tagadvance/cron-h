import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpretCrontab, interpretLine, nextRuns, parseLine } from '../js/crontab.js';
import { SPECS, parseField } from '../js/describe/fields.js';

const FROM = new Date('2026-01-01T00:00:00Z');
const UTC = { count: 3, from: FROM, timezone: 'UTC' };

const iso = (runs) => runs.map((run) => run.toISOString());

test('blank, comment and environment lines are not schedules', () => {
	assert.equal(parseLine('').kind, 'blank');
	assert.equal(parseLine('   ').kind, 'blank');
	assert.equal(parseLine('# m h dom mon dow').kind, 'comment');
	assert.equal(parseLine('MAILTO=tag@example.com').kind, 'env');
	assert.equal(parseLine('PATH = /usr/bin').kind, 'env');
});

test('a five field line splits into expression and command', () => {
	assert.deepEqual(parseLine('*/15 * * * * /usr/local/bin/sync --now'), {
		kind: 'entry',
		expression: '*/15 * * * *',
		command: '/usr/local/bin/sync --now',
	});
});

test('a nickname line splits into expression and command', () => {
	assert.deepEqual(parseLine('@Daily /usr/local/bin/rotate-logs'), {
		kind: 'entry',
		expression: '@daily',
		command: '/usr/local/bin/rotate-logs',
	});
});

test('a schedule with no command is still an entry', () => {
	assert.deepEqual(parseLine('0 3 * * 0'), { kind: 'entry', expression: '0 3 * * 0', command: '' });
});

test('too few fields is an error', () => {
	assert.equal(parseLine('* * * *').kind, 'error');
	assert.equal(parseLine('nonsense').kind, 'error');
});

test('an unparseable expression becomes an error, not an exception', () => {
	const entry = interpretLine('* * * * bogus /bin/nope');
	assert.equal(entry.kind, 'error');
	// A reason the page can translate, not a message from a vendor's internals.
	assert.equal(entry.reason, 'unreadable');
	assert.equal(entry.expression, '* * * * bogus', 'and it keeps what it was given');
});

test('next runs are listed soonest first', () => {
	assert.deepEqual(iso(nextRuns('*/15 * * * *', UTC)), [
		'2026-01-01T00:15:00.000Z',
		'2026-01-01T00:30:00.000Z',
		'2026-01-01T00:45:00.000Z',
	]);
	assert.deepEqual(iso(nextRuns('0 3 * * 0', UTC)), [
		'2026-01-04T03:00:00.000Z',
		'2026-01-11T03:00:00.000Z',
		'2026-01-18T03:00:00.000Z',
	]);
});

test('@midnight is scheduled even though croner does not know it', () => {
	assert.deepEqual(iso(nextRuns('@midnight', UTC)), iso(nextRuns('0 0 * * *', UTC)));
});

test('@reboot has no next run', () => {
	assert.equal(nextRuns('@reboot', UTC), null);
});

test('a schedule that can never fire has no next run', () => {
	assert.deepEqual(nextRuns('0 0 30 2 *', UTC), []);
});

test('a crontab is interpreted line by line', () => {
	const crontab = [
		'# comment',
		'MAILTO=tag@example.com',
		'',
		'@daily /bin/rotate',
		'* * * * bogus /bin/nope',
	];
	const entries = interpretCrontab(crontab.join('\n'), UTC);

	assert.deepEqual(
		entries.map((entry) => entry.kind),
		['comment', 'env', 'blank', 'entry', 'error'],
	);
	assert.deepEqual(
		entries.map((entry) => entry.lineNumber),
		[1, 2, 3, 4, 5],
	);
	assert.equal(entries[3].description, 'Every day at 12:00 AM');
	assert.equal(entries[3].command, '/bin/rotate');
	assert.equal(entries[4].reason, 'unreadable');
});

test('carriage returns do not leak into the last field', () => {
	const entries = interpretCrontab('@daily /bin/rotate\r\n0 3 * * 0 /bin/backup\r\n', UTC);
	assert.deepEqual(
		entries.map((entry) => entry.kind),
		['entry', 'entry', 'blank'],
	);
	assert.equal(entries[0].command, '/bin/rotate');
});

// The regex exists to tell MAILTO=x from a schedule. Relaxing it to /=/ passed
// the whole suite, and under that relaxation any command containing = — which
// is most of them — was silently reclassified as an environment line and
// vanished from the page.
test('a command containing = is still a schedule, not an environment line', () => {
	assert.equal(parseLine('*/5 * * * * /bin/x --mode=fast').kind, 'entry');
	assert.equal(parseLine('0 3 * * 0 FOO=bar /bin/backup').kind, 'entry');
	assert.equal(parseLine('@daily /bin/x --set a=b').kind, 'entry');
	assert.equal(parseLine('MAILTO=tag@example.com').kind, 'env');
	assert.equal(parseLine('9NOTAVAR=x').kind, 'error', 'a name cannot start with a digit');
});

test('the run count and start default rather than being required', () => {
	const now = Date.now();
	const defaults = nextRuns('*/15 * * * *');
	assert.equal(defaults.length, 5, 'five runs by default');
	assert.ok(defaults[0].getTime() > now, 'and they start from now');

	assert.equal(nextRuns('*/15 * * * *', { count: 2 }).length, 2);
});

test('fields separated by anything but a space or tab are rejected', () => {
	// NBSP is common in text copied out of a web page or a PDF. Cron separates
	// fields with spaces and tabs, so such a line is not a schedule, and saying
	// it is would be worse than saying nothing.
	assert.equal(interpretLine('0\u00A00 * * * /bin/x').kind, 'error', 'NBSP is not a separator');
	assert.equal(interpretLine('0\u30000 * * * /bin/x').kind, 'error', 'nor an ideographic space');

	assert.equal(parseLine('0\t0 * * * /bin/x').kind, 'entry', 'a tab is a real separator');
	assert.equal(parseLine('0  0   * * * /bin/x').kind, 'entry', 'so is a run of spaces');
	assert.equal(interpretLine('0\t0 * * * /bin/x').description, 'Every day at 12:00 AM');
});

// The flag exists because month lengths vary, so a stride over days of the
// month has no fixed wrap-around gap and can never honestly be called "every N
// days". Nothing read it, so flipping it changed no output and no test — this
// pins the behaviour the comment describes.
test('a stride over days of the month is never an even cycle', () => {
	const dayOfMonth = SPECS.find((spec) => spec.name === 'dayOfMonth');
	const minute = SPECS.find((spec) => spec.name === 'minute');

	assert.equal(parseField('*/10', dayOfMonth).isEvenCycle, false, 'months vary in length');
	assert.equal(parseField('*/5', dayOfMonth).stride, 5, 'the stride itself is still known');
	assert.equal(parseField('*/10', minute).isEvenCycle, true, 'but an hour is always 60 minutes');
});
