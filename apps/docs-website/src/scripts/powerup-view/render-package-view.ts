import {
  collectTemplatePaths,
  resolveTemplateContent,
  type PackageDetail,
  type PowerupInstructions,
  type PowerupStep,
} from "./fetch-package-detail.ts";

const BADGE_CLASS_BY_STEP_TYPE: Record<string, string> = {
  create: "pups-badge pups-badge-create",
  modify: "pups-badge pups-badge-modify",
  delete: "pups-badge pups-badge-delete",
  read: "pups-badge pups-badge-read",
  install: "pups-badge pups-badge-install",
};

function createElement({ tagName, className, textContent }: { tagName: string; className?: string; textContent?: string }): HTMLElement {
  const element = document.createElement(tagName);
  if (className !== undefined) {
    element.className = className;
  }
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

function createExternalLink({ label, href }: { label: string; href: string }): HTMLAnchorElement {
  const link = document.createElement("a");
  link.textContent = label;
  link.href = href;
  link.rel = "noreferrer";
  return link;
}

function describeStepTarget({ step }: { step: PowerupStep }): string {
  switch (step.type) {
    case "create":
    case "modify":
      return "→ " + step.outputPath + " (from " + step.template + ")";
    case "delete":
      return "→ " + step.outputPath;
    case "read":
      return "reads " + step.path + ' as "' + step.as + '"';
    case "install":
      return "installs " + ((step.dependencies ?? []).concat(step.devDependencies ?? []).join(", ") || "no dependencies");
  }
}

function renderVariables({ container, instructions }: { container: HTMLElement; instructions: PowerupInstructions }): void {
  const section = createElement({ tagName: "section", className: "pups-section" });
  section.append(createElement({ tagName: "h3", className: "pups-section-title", textContent: "Variables" }));

  const { required, optional, defaults } = instructions.variables;
  const hasAnyVariable = required.length > 0 || (optional?.length ?? 0) > 0;

  if (!hasAnyVariable) {
    section.append(createElement({ tagName: "p", className: "pups-muted", textContent: "No variables required." }));
  } else {
    const list = createElement({ tagName: "ul", className: "pups-variable-list" });
    for (const variableName of required) {
      list.append(createElement({ tagName: "li", textContent: variableName + " (required)" }));
    }
    for (const variableName of optional ?? []) {
      const defaultValue = defaults?.[variableName];
      const label = defaultValue === undefined
        ? variableName + " (optional)"
        : variableName + " (optional, default: " + defaultValue + ")";
      list.append(createElement({ tagName: "li", textContent: label }));
    }
    section.append(list);
  }

  container.append(section);
}

function renderIntent({ container, instructions }: { container: HTMLElement; instructions: PowerupInstructions }): void {
  const section = createElement({ tagName: "section", className: "pups-section" });
  section.append(createElement({ tagName: "h3", className: "pups-section-title", textContent: "Intent" }));

  const list = createElement({ tagName: "ul", className: "pups-variable-list" });
  for (const intentLine of instructions.intent) {
    list.append(createElement({ tagName: "li", textContent: intentLine }));
  }

  section.append(list);
  container.append(section);
}

function renderSteps({ container, instructions }: { container: HTMLElement; instructions: PowerupInstructions }): void {
  const section = createElement({ tagName: "section", className: "pups-section" });
  section.append(createElement({ tagName: "h3", className: "pups-section-title", textContent: "Steps (" + instructions.steps.length + ")" }));

  for (const step of instructions.steps) {
    const row = createElement({ tagName: "div", className: "pups-step" });
    row.append(createElement({ tagName: "span", className: BADGE_CLASS_BY_STEP_TYPE[step.type] ?? "pups-badge pups-badge-unknown", textContent: step.type }));
    row.append(createElement({ tagName: "strong", textContent: step.name }));
    row.append(createElement({ tagName: "span", className: "pups-step-path", textContent: describeStepTarget({ step }) }));
    section.append(row);
  }

  container.append(section);
}

function renderTemplateFiles({ container, detail, instructions }: {
  container: HTMLElement;
  detail: PackageDetail;
  instructions: PowerupInstructions;
}): void {
  const section = createElement({ tagName: "section", className: "pups-section" });
  section.append(createElement({ tagName: "h3", className: "pups-section-title", textContent: "Template files" }));

  const templatePaths = collectTemplatePaths({ instructions });

  if (templatePaths.length === 0) {
    section.append(createElement({ tagName: "p", className: "pups-muted", textContent: "This powerup has no template files." }));
    container.append(section);
    return;
  }

  const tabs = createElement({ tagName: "div", className: "pups-tabs" });
  const codeBlock = document.createElement("pre");
  codeBlock.className = "pups-code-block";
  const codeElement = document.createElement("code");
  codeBlock.append(codeElement);

  const selectTemplate = ({ templatePath }: { templatePath: string }): void => {
    codeElement.textContent = resolveTemplateContent({ templateFiles: detail.templateFiles, templatePath }) ?? "// template file not found in the published package";
    for (const tab of tabs.querySelectorAll("button")) {
      tab.setAttribute("aria-selected", String((tab as HTMLElement).dataset.templatePath === templatePath));
    }
  };

  templatePaths.forEach((templatePath, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "pups-tab";
    tab.textContent = templatePath;
    tab.dataset.templatePath = templatePath;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(index === 0));
    tab.addEventListener("click", () => selectTemplate({ templatePath }));
    tabs.append(tab);
  });

  const firstTemplatePath = templatePaths[0];
  if (firstTemplatePath !== undefined) {
    codeElement.textContent = resolveTemplateContent({ templateFiles: detail.templateFiles, templatePath: firstTemplatePath }) ?? "";
  }

  section.append(tabs, codeBlock);
  container.append(section);
}

export function renderPackageView({ container, detail }: { container: HTMLElement; detail: PackageDetail }): void {
  container.replaceChildren();

  const header = createElement({ tagName: "header", className: "pups-view-header" });
  header.append(
    createElement({ tagName: "h2", className: "pups-view-name", textContent: detail.name }),
    createElement({ tagName: "p", className: "pups-view-description", textContent: detail.description }),
  );

  const chips = createElement({ tagName: "div", className: "pups-chips" });
  chips.append(
    createElement({ tagName: "span", className: "pups-chip", textContent: "v" + detail.version }),
    createElement({ tagName: "span", className: "pups-chip", textContent: detail.license === "" ? "license unknown" : detail.license }),
  );
  if (detail.publisherUsername !== "") {
    chips.append(createElement({ tagName: "span", className: "pups-chip", textContent: "by " + detail.publisherUsername }));
  }
  header.append(chips);

  const installCommand = "pup install " + detail.name;
  const installRow = createElement({ tagName: "div", className: "pups-install" });
  installRow.append(createElement({ tagName: "code", textContent: installCommand }));

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "pups-copy-button";
  copyButton.textContent = "Copy";
  copyButton.addEventListener("click", () => {
    navigator.clipboard?.writeText(installCommand);
    copyButton.textContent = "Copied!";
    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1500);
  });
  installRow.append(copyButton);
  header.append(installRow);

  const links = createElement({ tagName: "div", className: "pups-view-links" });
  links.append(createExternalLink({ label: "npm", href: detail.npmUrl }));
  if (detail.repositoryUrl !== null) {
    links.append(createExternalLink({ label: "GitHub", href: detail.repositoryUrl }));
  }
  header.append(links);

  container.append(header);

  if (detail.instructions === null) {
    container.append(createElement({ tagName: "div", className: "pups-panel", textContent: "This powerup hasn't published viewable instructions." }));
    return;
  }

  renderVariables({ container, instructions: detail.instructions });
  if (detail.instructions.intent.length > 0) {
    renderIntent({ container, instructions: detail.instructions });
  }
  renderSteps({ container, instructions: detail.instructions });
  renderTemplateFiles({ container, detail, instructions: detail.instructions });
}

export function renderSkeleton({ container }: { container: HTMLElement }): void {
  const skeletons = Array.from({ length: 4 }, () => createElement({ tagName: "div", className: "pups-skeleton" }));
  container.replaceChildren(...skeletons);
}

export function renderViewError({ container, message }: { container: HTMLElement; message: string }): void {
  const panel = createElement({ tagName: "div", className: "pups-panel" });
  panel.append(createElement({ tagName: "p", textContent: message }));
  container.replaceChildren(panel);
}
