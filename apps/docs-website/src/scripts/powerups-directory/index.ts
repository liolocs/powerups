import {
  DEFAULT_DIRECTORY_STATE,
  PAGE_SIZE,
  filterPowerups,
  paginatePowerups,
  sortPowerups,
  type DirectorySort,
  type DirectoryState,
} from "./directory-state.ts";
import { fetchPowerups, type PowerupSummary } from "./fetch-powerups.ts";
import {
  renderEmptyPanel,
  renderErrorPanel,
  renderPager,
  renderPowerupCards,
  renderResultCount,
  renderSkeletonCards,
} from "./render-directory.ts";

const CACHE_KEY = "powerups-directory-cache-v1";

interface PowerupsCache {
  fetchedAt: number;
  powerups: PowerupSummary[];
}

function readCachedPowerups(): PowerupSummary[] | null {
  try {
    const rawCache = sessionStorage.getItem(CACHE_KEY);
    if (rawCache === null) {
      return null;
    }
    const cache = JSON.parse(rawCache) as PowerupsCache;
    return Array.isArray(cache.powerups) ? cache.powerups : null;
  } catch {
    return null;
  }
}

function writeCachedPowerups({ powerups }: { powerups: PowerupSummary[] }): void {
  try {
    const cache: PowerupsCache = { fetchedAt: Date.now(), powerups };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable (private mode, quota) — caching is best-effort */
  }
}

async function loadPowerups(): Promise<PowerupSummary[]> {
  const cachedPowerups = readCachedPowerups();
  if (cachedPowerups !== null) {
    return cachedPowerups;
  }

  const { powerups } = await fetchPowerups();
  writeCachedPowerups({ powerups });
  return powerups;
}

export function bootstrapDirectory({ container }: { container: HTMLElement }): void {
  const cardGrid = container.querySelector<HTMLElement>("[data-card-grid]");
  const pager = container.querySelector<HTMLElement>("[data-pager]");
  const resultCount = container.querySelector<HTMLElement>("[data-result-count]");
  const toolbar = container.querySelector<HTMLFormElement>("[data-toolbar]");
  const searchInput = container.querySelector<HTMLInputElement>("[data-search-input]");
  const sortSelect = toolbar?.querySelector<HTMLSelectElement>("select");
  const clearButton = container.querySelector<HTMLButtonElement>("[data-clear-button]");

  if (cardGrid === null || pager === null || resultCount === null) {
    return;
  }

  let state: DirectoryState = { ...DEFAULT_DIRECTORY_STATE };
  let allPowerups: PowerupSummary[] = [];
  let hasLoaded = false;

  const getVisiblePowerups = (): PowerupSummary[] =>
    sortPowerups({ powerups: filterPowerups({ powerups: allPowerups, query: state.query }), sort: state.sort });

  const renderCurrentPage = (): void => {
    if (!hasLoaded) {
      return;
    }

    const { slice, total, firstIndex, lastIndex, totalPages } = paginatePowerups({
      powerups: getVisiblePowerups(),
      page: state.page,
      pageSize: PAGE_SIZE,
    });

    renderResultCount({ container: resultCount, firstIndex, lastIndex, total });

    if (total === 0) {
      renderEmptyPanel({ container: cardGrid, query: state.query.trim() });
      pager.hidden = true;
      pager.replaceChildren();
      return;
    }

    renderPowerupCards({ container: cardGrid, powerups: slice });
    renderPager({
      container: pager,
      page: state.page,
      totalPages,
      onPageChange: ({ page }) => {
        state = { ...state, page };
        renderCurrentPage();
      },
    });
  };

  const loadAndRender = async (): Promise<void> => {
    renderSkeletonCards({ container: cardGrid });
    renderResultCount({ container: resultCount, firstIndex: 0, lastIndex: 0, total: 0 });
    pager.hidden = true;

    try {
      allPowerups = await loadPowerups();
      hasLoaded = true;
      state = { ...state, page: 1 };
      renderCurrentPage();
    } catch {
      renderErrorPanel({
        container: cardGrid,
        onRetry: () => {
          sessionStorage.removeItem(CACHE_KEY);
          loadAndRender();
        },
      });
    }
  };

  toolbar?.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    state = { ...state, query: searchInput?.value ?? "", page: 1 };
    renderCurrentPage();
  });

  sortSelect?.addEventListener("change", () => {
    state = { ...state, sort: sortSelect.value as DirectorySort, page: 1 };
    renderCurrentPage();
  });

  clearButton?.addEventListener("click", () => {
    state = { ...DEFAULT_DIRECTORY_STATE };
    if (searchInput !== null) {
      searchInput.value = "";
    }
    if (sortSelect !== null) {
      sortSelect.value = DEFAULT_DIRECTORY_STATE.sort;
    }
    renderCurrentPage();
  });

  loadAndRender();
}
