import { fetchPackageDetail } from "./fetch-package-detail.ts";
import { renderPackageView, renderSkeleton, renderViewError } from "./render-package-view.ts";

export function bootstrapPackageView({ container }: { container: HTMLElement }): void {
  const content = container.querySelector<HTMLElement>("[data-view-content]");

  if (content === null) {
    return;
  }

  const packageName = new URLSearchParams(window.location.search).get("package");

  if (packageName === null || packageName.trim() === "") {
    renderViewError({ container: content, message: "No powerup selected. Pick one from the directory." });
    return;
  }

  renderSkeleton({ container: content });

  fetchPackageDetail({ packageName })
    .then((detail) => renderPackageView({ container: content, detail }))
    .catch(() => {
      renderViewError({
        container: content,
        message: 'Could not load "' + packageName + '". It may not exist or the network request failed.',
      });
    });
}
