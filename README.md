# cron-h

Human readable cron interpreter web application. Live at
[cron-h.com](https://cron-h.com).

Paste a crontab in; every schedule it finds is explained in English along with
its next five run times. Everything is calculated in the browser — nothing is
uploaded.

## Running it

There is no build step. Serve the directory with anything static:

```
python3 -m http.server 8000
```

The page is an ES module, so it needs to be served over HTTP; opening
`index.html` from the filesystem will not work.

## Example pages

`examples.html` and `<lang>/examples.html` are generated from the describer so
their wording cannot drift from what the interpreter says. After changing the
describer or the list in `bin/examples.js`:

```
node bin/examples.js
```

That rewrites all seven pages and `sitemap.xml`. Commit the output — it is
served as-is, there is still no build step.

The Open Graph card is generated the same way but needs a headless Chrome, so
it is not part of the deploy:

```
node bin/og-image.js
```

## Tests

```
npm test
```

`node --test` only; there are no dev dependencies.

## Dependencies

Vendored under `js/vendor/` so the site has no runtime network dependency:

| Library | Version | Used for |
| --- | --- | --- |
| [cronstrue](https://github.com/bradymholt/cronstrue) | 3.24.0 | fallback for unrecognized schedules |
| cronstrue i18n | 3.24.0 | the same fallback, translated |
| [croner](https://github.com/hexagon/croner) | 9.1.0 | next run times |

The i18n bundle is ten times the size of the English one, so it is imported
dynamically and only when a reader picks a language other than English.

Both are MIT licensed. Common schedules are described by `js/describe/`, which
recognizes the shape of a schedule rather than translating its fields one at a
time; cronstrue handles whatever it declines. To update one, re-download it over the existing file:

```
curl -o js/vendor/cronstrue.js https://cdn.jsdelivr.net/npm/cronstrue@3.24.0/+esm
curl -o js/vendor/cronstrue-i18n.js https://cdn.jsdelivr.net/npm/cronstrue@3.24.0/i18n/+esm
curl -o js/vendor/croner.js https://cdn.jsdelivr.net/npm/croner@9.1.0/dist/croner.js
```

## Adding a language

Recognizers return a message id and typed parameters, never a sentence, so a
language is a new module rather than a rewrite:

1. Copy `js/describe/locales/en.js` and translate both `messages` (the
   schedules) and `ui` (the page's own wording). Plurals, list punctuation,
   weekday names and clock formats come from `Intl` via the formatter passed to
   every message, so they need no tables.
2. Set `fallback` to the matching [cronstrue locale
   code](https://github.com/bradymholt/cronstrue/tree/main/src/i18n/locales) —
   note it is `zh_CN`, not `zh`.
3. Register it in `LOCALES` in `js/describe/index.js`, and import it in
   `test/locales.test.js`, which checks that every locale covers every message.
4. `test/oracle.test.js` needs nothing: it asserts on descriptors, so it already
   covers every language.

Corrections to any translation are welcome as a GitHub issue; they were written
without a native speaker to check them.

Anything with no module falls back to English entirely — wording and formats
together — rather than mixing the two.
