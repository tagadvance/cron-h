import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describe, interpretCrontab, nextRuns, parseLine } from '../js/crontab.js';

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
		command: '/usr/local/bin/sync --now'
	});
});

test('a nickname line splits into expression and command', () => {
	assert.deepEqual(parseLine('@Daily /usr/local/bin/rotate-logs'), {
		kind: 'entry',
		expression: '@daily',
		command: '/usr/local/bin/rotate-logs'
	});
});

test('a schedule with no command is still an entry', () => {
	assert.deepEqual(parseLine('0 3 * * 0'), { kind: 'entry', expression: '0 3 * * 0', command: '' });
});

test('too few fields is an error', () => {
	assert.equal(parseLine('* * * *').kind, 'error');
	assert.equal(parseLine('nonsense').kind, 'error');
});

test('expressions are described in English', () => {
	assert.equal(describe('* * * * *'), 'Every minute');
	assert.equal(describe('*/15 * * * *'), 'Every 15 minutes');
	assert.equal(describe('0 */2 * * *'), 'On the hour, every 2 hours');
	assert.equal(describe('0 3 * * 0'), 'At 03:00 AM, only on Sunday');
	assert.equal(describe('*/15 * * * SUN'), 'Every 15 minutes, only on Sunday');
});

test('every nickname is described', () => {
	assert.equal(describe('@reboot'), 'Run once, at startup');
	assert.equal(describe('@yearly'), describe('0 0 1 1 *'));
	assert.equal(describe('@annually'), describe('0 0 1 1 *'));
	assert.equal(describe('@monthly'), describe('0 0 1 * *'));
	assert.equal(describe('@weekly'), describe('0 0 * * 0'));
	assert.equal(describe('@daily'), describe('0 0 * * *'));
	assert.equal(describe('@midnight'), describe('0 0 * * *'));
	assert.equal(describe('@hourly'), describe('0 * * * *'));
});

test('an unparseable expression throws', () => {
	assert.throws(() => describe('* * * * bogus'));
});

test('next runs are listed soonest first', () => {
	assert.deepEqual(iso(nextRuns('*/15 * * * *', UTC)), [
		'2026-01-01T00:15:00.000Z',
		'2026-01-01T00:30:00.000Z',
		'2026-01-01T00:45:00.000Z'
	]);
	assert.deepEqual(iso(nextRuns('0 3 * * 0', UTC)), [
		'2026-01-04T03:00:00.000Z',
		'2026-01-11T03:00:00.000Z',
		'2026-01-18T03:00:00.000Z'
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
	const crontab = ['# comment', 'MAILTO=tag@example.com', '', '@daily /bin/rotate', '* * * * bogus /bin/nope'];
	const entries = interpretCrontab(crontab.join('\n'), UTC);

	assert.deepEqual(entries.map((entry) => entry.kind), ['comment', 'env', 'blank', 'entry', 'error']);
	assert.deepEqual(entries.map((entry) => entry.lineNumber), [1, 2, 3, 4, 5]);
	assert.equal(entries[3].description, 'At 12:00 AM');
	assert.equal(entries[3].command, '/bin/rotate');
	assert.match(entries[4].message, /\S/);
});

test('carriage returns do not leak into the last field', () => {
	const entries = interpretCrontab('@daily /bin/rotate\r\n0 3 * * 0 /bin/backup\r\n', UTC);
	assert.deepEqual(entries.map((entry) => entry.kind), ['entry', 'entry', 'blank']);
	assert.equal(entries[0].command, '/bin/rotate');
});
