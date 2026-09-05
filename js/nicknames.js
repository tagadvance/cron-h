// The @nicknames every cron implementation accepts, expanded to their five
// field equivalents. @reboot expands to nothing: it is not a schedule.
const NICKNAMES = {
	'@yearly': '0 0 1 1 *',
	'@annually': '0 0 1 1 *',
	'@monthly': '0 0 1 * *',
	'@weekly': '0 0 * * 0',
	'@daily': '0 0 * * *',
	'@midnight': '0 0 * * *',
	'@hourly': '0 * * * *',
	'@reboot': null,
};

// Object.hasOwn, not `in`: `in` walks the prototype chain, so 'constructor'
// and '__proto__' would read as nicknames and expand() would hand back a
// function or an object instead of a string.
export function isNickname(expression) {
	return Object.hasOwn(NICKNAMES, expression.trim().toLowerCase());
}

/**
 * Returns the five field form of a nickname, null for @reboot, and the
 * expression unchanged if it is not a nickname.
 */
export function expand(expression) {
	const nickname = expression.trim().toLowerCase();
	return Object.hasOwn(NICKNAMES, nickname) ? NICKNAMES[nickname] : expression;
}
