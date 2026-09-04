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
	const conjunction = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
	const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
	const clock = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

	return {
		locale,
		number: (value) => value.toLocaleString(locale),
		/** Picks from CLDR plural categories: { one: 'minute', other: 'minutes' } */
		plural: (count, forms) => forms[plurals.select(count)] ?? forms.other,
		list: (items) => conjunction.format(items),
		weekdays: (values) =>
			conjunction.format(values.map((day) => weekday.format(REFERENCE_SUNDAY + day * 86400000))),
		time: ({ hour, minute }) => clock.format(Date.UTC(2024, 0, 7, hour, minute))
	};
}
