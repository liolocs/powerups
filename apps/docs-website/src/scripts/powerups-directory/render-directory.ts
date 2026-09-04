import { pagerPageNumbers } from "./directory-state.ts";
import type { PowerupSummary } from "./fetch-powerups.ts";

function createExternalLink({ label, href }: { label: string; href: string }): HTMLAnchorElement {
  const link = document.createElement("a");
  link.textContent = label;
  link.href = href;
  link.rel = "noreferrer";
  return link;
}

export function formatDownloadCount({ count }: { count: number }): string {
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(count);
}

export function createPowerupCard({ powerup }: { powerup: PowerupSummary }): HTMLAnchorElement {
  const card = document.createElement("a");
  card.className = "pups-card";
  card.href = "/powerups/view?package=" + encodeURIComponent(powerup.name);

  const nameRow = document.createElement("div");
  nameRow.className = "pups-card-name-row";

  const name = document.createElement("span");
  name.className = "pups-card-name";
  name.textContent = powerup.name;

  const links = document.createElement("span");
  links.className = "pups-card-links";
  if (powerup.npmUrl !== "") {
    links.append(createExternalLink({ label: "npm", href: powerup.npmUrl }));
  }
  if (powerup.repositoryUrl !== null) {
    links.append(createExternalLink({ label: "GitHub", href: powerup.repositoryUrl }));
  }

  nameRow.append(name, links);

  const description = document.createElement("p");
  description.className = "pups-card-description";
  description.textContent = powerup.description;

  const metaRow = document.createElement("div");
  metaRow.className = "pups-card-meta";

  const avatar = document.createElement("span");
  avatar.className = "pups-card-avatar";
  avatar.textContent = powerup.publisherUsername.charAt(0).toUpperCase() || "?";

  const publisher = document.createElement("span");
  publisher.textContent = powerup.publisherUsername || "unknown publisher";

  const version = document.createElement("span");
  version.className = "pups-card-version";
  version.textContent = "v" + powerup.version;

  const downloads = document.createElement("span");
  downloads.textContent = formatDownloadCount({ count: powerup.monthlyDownloads }) + " dl/mo";

  metaRow.append(avatar, publisher, version, downloads);
  card.append(nameRow, description, metaRow);

  return card;
}

export function renderPowerupCards({ container, powerups }: { container: HTMLElement; powerups: PowerupSummary[] }): void {
  container.replaceChildren(...powerups.map((powerup) => createPowerupCard({ powerup })));
}

export function renderResultCount({ container, firstIndex, lastIndex, total }: {
  container: HTMLElement;
  firstIndex: number;
  lastIndex: number;
  total: number;
}): void {
  container.textContent = firstIndex + "-" + lastIndex + " / " + total;
}

export function renderSkeletonCards({ container, count = 12 }: { container: HTMLElement; count?: number }): void {
  const skeletons = Array.from({ length: count }, () => {
    const skeleton = document.createElement("div");
    skeleton.className = "pups-skeleton";
    return skeleton;
  });
  container.replaceChildren(...skeletons);
}

export function renderEmptyPanel({ container, query }: { container: HTMLElement; query: string }): void {
  const panel = document.createElement("div");
  panel.className = "pups-panel";
  panel.textContent = query === "" ? "No powerups found." : 'No powerups found for "' + query + '".';
  container.replaceChildren(panel);
}

export function renderErrorPanel({ container, onRetry }: { container: HTMLElement; onRetry: () => void }): void {
  const panel = document.createElement("div");
  panel.className = "pups-panel";

  const message = document.createElement("p");
  message.textContent = "Could not load the powerups list. Check your connection and try again.";

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "pups-button";
  retryButton.textContent = "Retry";
  retryButton.addEventListener("click", onRetry);

  panel.append(message, retryButton);
  container.replaceChildren(panel);
}

export function renderPager({ container, page, totalPages, onPageChange }: {
  container: HTMLElement;
  page: number;
  totalPages: number;
  onPageChange: ({ page }: { page: number }) => void;
}): void {
  if (totalPages <= 1) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  container.hidden = false;

  const entries = pagerPageNumbers({ page, totalPages }).map((entry) => {
    if (entry === "gap") {
      const gap = document.createElement("span");
      gap.className = "pups-pager-gap";
      gap.textContent = "…";
      return gap;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(entry);

    if (entry === page) {
      button.setAttribute("aria-current", "page");
    } else {
      button.addEventListener("click", () => onPageChange({ page: entry }));
    }

    return button;
  });

  container.replaceChildren(...entries);
}
