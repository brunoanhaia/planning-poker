# Adding a Language

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

A language is data, not code — five small edits and the test suite enforces the rest.

## The architecture in one paragraph

English is the fallback and Brazilian Portuguese is the existing audience, so both are
**bundled inline** (`INLINE_DICTIONARIES`); every other language ships as **its own chunk**,
fetched when picked (`LOCALE_LOADERS`), so the initial bundle never grows with the language
list. The catalogs are plain JSON, `Dictionary` is derived from the English file, and the
choice persists in `localStorage` under `planit_language`.

## The recipe

1. **Translate the catalog.** Copy `apps/client/src/assets/locales/en.json` to
   `assets/locales/<code>.json` and translate the values — keep every key and every
   `{{placeholder}}` exactly. A missing key fails `tsc` (the type is derived from English);
   an invented extra key fails the i18n spec.
2. **Plurals follow CLDR.** Where English has `key_one` / `key_other`, add the categories
   your language actually needs (`_few`, `_many` for Polish, Russian, Arabic…). Never branch
   on `count === 1` in a component — `t('key', { count })` and `Intl.PluralRules` pick the
   form.
3. **Register the code.** Add it to `Language` / `LANGUAGES` in
   `apps/client/src/i18n/languages.ts` (the order there is the picker's order) and to
   `LOCALE_LOADERS` in `i18n/dictionary.ts`.
4. **Ant Design's own locale.** Import the matching `antd/locale/<locale>` pack and map it in
   `ANT_LOCALES` in `app/app.tsx`, so DatePickers and friends follow the language too.
5. **Name it everywhere.** Add the native name under `language.<code>` in **every** catalog —
   including English and Brazilian Portuguese, which are inline.

Then run the client tests: the key-set spec, the plural spec and the provider spec fail loudly
if anything is missing.

## Rules that will bite if ignored

- **Deck names and error codes never appear as literal copy.** Decks go through
  `deckLabelKey` and server failures through `ERROR_KEYS` — so a new `DeckType` or `ErrorCode`
  cannot be silently untranslated. (The server's own `message` stays English on purpose: it is
  the log line, not the interface.)
- **Notices are stored as codes and translated on render**, which is why an error already on
  screen follows a language switch instead of freezing in the arrival language.
- **Copy parity across locales.** A label shortened or reworded in one language is shortened or reworded in every shipped locale — same concept, same tone, comparable length — so no language presents a different action.
- **Keep `assets/locales/` JSON-only.** The folder is excluded from the Sonar scan as a whole;
  the i18n spec fails if anything else lives there.
