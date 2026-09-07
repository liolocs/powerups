# Powerups Sort Dropdown

## Goal

Add client-side sorting to the powerups directory page so users can reorder the list of npm packages using the sort dropdown. Sorting works alongside the existing search filtering.

## Context

The powerups page already has a `SortPowerupsDropdown.astro` component rendered alongside the search bar, with four options: Most downloads, Recently published, A-Z, and Z-A. The dropdown currently has no sorting logic. The page also has client-side search filtering that toggles card visibility via the `hidden` Tailwind class. Each card has a `data-search` attribute used for filtering.

The live collection entries provide: `name`, `downloads.monthly`, `date` (publication date string), and other fields. `date` is not currently passed to `PowerupCard`.

## Approach

**Client-side DOM reordering with data attributes.** Each card gets `data-name`, `data-downloads`, and `data-date` attributes. A script listens to the dropdown's `change` event, sorts the card elements by the selected criterion, and re-appends them to the grid container. On page load, the default "Most downloads" sort is applied immediately. Sort logic lives entirely in one client-side script — no server-side sorting.

## Design

### Component Changes

#### `PowerupCard.astro`
- Add `date` to the props (string — publication date from the live collection entry)
- Add three data attributes to the root `<a>` element:
  - `data-name` — the package name, lowercased (for alphabetical sort)
  - `data-downloads` — `downloads.monthly` as a number (for "Most downloads" sort)
  - `data-date` — the publication date as a Unix timestamp via `Date.parse()` (for "Recently published" sort)

#### `SortPowerupsDropdown.astro`
- Add `id="powerups-sort"` to the `NativeSelect` so the script can target it
- Mark the "Most downloads" option as `selected` so the dropdown reflects the default sort state

#### `powerups.astro`
- Pass `date={entry?.data?.date}` to each `PowerupCard`
- Extend the existing `<script>` with sort logic

### Sort Logic

The existing `<script>` in `powerups.astro` is extended:

1. **Query references** — grab the sort select (`#powerups-sort`) and the card grid container (the `div` with the `grid` class holding the cards)
2. **Sort function** — reads the select's current value, collects all card elements (`[data-search]`) from the grid, sorts them, and re-appends them to the grid container in order using `appendChild` (moves existing nodes, no cloning)
3. **On page load** — call the sort function immediately to apply the default "Most downloads" sort before first paint
4. **On `change` event** — call the sort function whenever the dropdown value changes

**Sort criteria by option value:**
- `most-downloads` — sort by `data-downloads` (numeric), descending (highest first)
- `recently-published` — sort by `data-date` (timestamp), descending (newest first)
- `asc` — sort by `data-name` (string), ascending (A-Z)
- `desc` — sort by `data-name` (string), descending (Z-A)

The `data-downloads` and `data-date` values are stored as strings in HTML attributes, so the sort function parses them to numbers before comparing. For `data-name`, `localeCompare` is used for alphabetical ordering.

### Search + Sort Interaction

Sort and search are independent operations:
- **Sort** reorders DOM elements within the grid container
- **Search** toggles the `hidden` class on cards

When both are active, cards remain in sorted order and non-matching cards are hidden. After sorting reorders the DOM, search filtering continues to work on the same elements regardless of their position. No coordination between the two is needed.

### Error Handling & Edge Cases

- **Sort with active search** — sorting reorders all cards (including hidden ones). Hidden cards stay hidden in their new position. When the user clears the search, cards reappear in sorted order.
- **Empty grid (no entries)** — sort function operates on zero elements; no-op.
- **Missing date** — the loader defaults `date` to `""`. An empty string parses to `NaN` in `Date.parse()`. Cards with missing dates sort to the end (treated as 0 for descending sorts).
- **Re-sorting** — calling `appendChild` on already-attached nodes moves them; no duplication.

### Testing

Manual testing only:

- Verify the page loads with cards sorted by most downloads (highest first)
- Change the dropdown to each option and verify correct ordering
- Type a search query, then change the sort — visible cards should reorder while filtered state persists
- Clear the search — all cards reappear in the sorted order
- Verify alphabetical sort is case-insensitive and uses locale-aware comparison