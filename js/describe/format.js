// Locale-aware primitives, all backed by Intl so every locale gets correct
// plural categories, list punctuation (English "a, b and c", Chinese
// "a、b和c"), weekday names and clock formats without shipping tables.
//
// Anything genuinely language-specific — ordinal suffixes, word order, whether
// a clause reads better before or after the verb — belongs in the locale
// module, not here.

// Any Sunday will do; this one is only ever used to name weekdays.
const REFERENCE_SUNDAY = Date.UTC(2024, 0, 7);

export function createFormat(locale) {
	const plurals = new Intl.PluralRules(locale);
	const ordinals = new Intl.PluralRules(locale, { type: 'ordinal' });
	const conjunction = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
	const weekday = {
		long: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }),
		short: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }),
	};
	const clock = new Intl.DateTimeFormat(locale, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC',
	});
	const calendar = new Intl.DateTimeFormat(locale, {
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
	const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });

	return {
		locale,
		number: (value) => value.toLocaleString(locale),
		/** Picks from CLDR plural categories: { one: 'minute', other: 'minutes' } */
		plural: (count, forms) => forms[plurals.select(count)] ?? forms.other,
		/** The CLDR ordinal category. The suffix that goes with it is the
		 *  locale's business, not this module's. */
		ordinal: (value) => ordinals.select(value),
		list: (items) => conjunction.format(items),
		/** Individually, so a locale can inflect them before they are joined. */
		weekdayNames: (values, style = 'long') =>
			values.map((day) => weekday[style].format(REFERENCE_SUNDAY + day * 86400000)),
		weekdays: (values, style = 'long') =>
			conjunction.format(
				values.map((day) => weekday[style].format(REFERENCE_SUNDAY + day * 86400000)),
			),
		time: ({ hour, minute }) => clock.format(Date.UTC(2024, 0, 7, hour, minute)),
		/** A day and month together, which every locale words differently:
		 *  "January 1", "1 de enero", "1月1日". */
		date: ({ month: m, day }) => calendar.format(Date.UTC(2024, m - 1, day)),
		monthNames: (values) => values.map((m) => month.format(Date.UTC(2024, m - 1, 1))),
		months: (values) =>
			conjunction.format(values.map((m) => month.format(Date.UTC(2024, m - 1, 1)))),
	};
}
