# Powerups Search Filter

## Goal

Add client-side search filtering to the powerups directory page (`src/pages/powerups.astro`) so users can filter the list of npm packages by typing in the search bar.

## Context

The powerups page is an SSR Astro page (`prerender = false`) that fetches npm packages tagged `powerups-package` via a live collection at request time. Entries are rendered server-side as cards in a grid. The search input (`SearchPowerups.astro`) currently has no filtering logic.

Each entry contains: `name`, `description`, `keywords`, `publisher`, `version`, `license`, `date`, `links`, `searchScore`, and `score`.

## Approach

**Client-side filtering with vanilla JS and data attributes.** All entries are already fetched and rendered server-side, so filtering is done in the browser by toggling card visibility. No server round-trip, no hydration cost.

## Design

### Component Changes

#### `PowerupCard.astro`
- Expand props to accept: `name`, `description`, `keywords`, `publisher`
- Add a `data-search` attribute to the root element containing the lowercased concatenation of all four fields (space-separated)

#### `SearchPowerups.astro`
- Add `id="powerups-search"` to the input element so the script can target it reliably
- Add a results-count `<div>` with `id="powerups-results-count"` below the input (e.g. "Showing 12 of 45") that updates as the user types

#### `powerups.astro`
- Pass the full entry data (`name`, `description`, `keywords`, `publisher`) to each `PowerupCard`
- Add a "no results" message element with `id="powerups-no-results"` (e.g. "No powerups match your search") below the card grid, hidden by default via the Tailwind `hidden` class, shown when all cards are filtered out
- Add a `<script>` at the bottom of the page with the filtering logic

### Filtering Logic

The `<script>` in `powerups.astro`:

1. **Query references** — grab the search input (`#powerups-search`), all card elements (`[data-search]`), the results-count element, and the no-results message element
2. **On input event** — read the query, lowercase it:
   - **If query length < 2** — show all cards, reset count to total, hide no-results message. No filtering happens.
   - **If query length >= 2** — for each card, check if the card's `data-search` value includes the query string (case-insensitive substring match). Toggle the Tailwind `hidden` class (sets `display: none`) accordingly.
3. **Update results count** — count visible cards and update the "Showing X of Y" text
4. **Toggle no-results message** — show it only when query length >= 2 and zero cards are visible; hide it otherwise

**Matching behavior:**
- Case-insensitive substring match against the concatenated `data-search` string
- Matches across all four fields: name, description, keywords, publisher
- Minimum 2 characters before filtering activates
- No debounce — show/hide is cheap for ~250 cards, filtering is instant on every keystroke

### Error Handling & Edge Cases

- **Empty/missing data fields** — the loader already defaults `description` to `""`, `keywords` to `[]`, and `publisher` to `""`. The `data-search` attribute concatenates whatever fields exist with spaces, so no null checks are needed in the card.
- **Script timing** — Astro `<script>` tags are automatically deferred and run after DOM parsing, so no `DOMContentLoaded` wrapper is needed.
- **No entries at all** (npm fetch error) — the page logs the error; the cards grid is empty. The results count shows "Showing 0 of 0". The no-results message does not show when query length < 2. If query length >= 2 with zero total cards, the no-results message shows.

### Testing

Manual testing only — this is a small client-side DOM script:

- Type various queries (name fragments, description words, keyword matches, publisher names) and verify correct cards show/hide
- Verify the 2-character threshold: typing 1 character shows all, typing 2+ starts filtering
- Verify empty input resets to full list
- Verify no-results message appears/disappears correctly