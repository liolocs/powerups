## Clean code

### Functions that have more than one parameter should have their parameters written as objects

E.G.

```ts
function Button({ componentName, theme }: { componentName: string, theme: string }) {
  `<button class="${theme}">${componentName}</button>`;
}
```
```ts
function sendMessage({ message, recipient }: { message: string, recipient: string }) {
  // Send the message to the recipient
}
```

### Variables should be descriptive

E.G.
DO:
```ts
const componentName = "Button";
const theme = "dark";

for (let color of colors) {
  // Do something
}
```
DONT:
```ts
const n = "Button";
const t = "dark";

for (let c of colors) {
  // Do something
}
```

### Spacing

You should add spaces for readability

E.G.
DO:
```ts
const componentName = "Button";
const theme = "dark";
```
DONT:
```ts
const componentName="Button";
const theme="dark";
```

### Naming

Use descriptive names for variables, functions, and files

E.G.
DO:

```ts
const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];

  const variables = {
    CLI_NAME,
    CLI_CMD,
    CLI_FOLDER_NAME,
    INTERNAL_FOLDER,
  };
  const filesWritten: string[] = [];
  const rollback = options?.rollback;

  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
    variables,
  });
```
DONT:
```ts
const harness = await detectHarness(projectRoot, harnessFlag, options);
  const config = HARNESS_CONFIG[harness];
  const variables = {
    CLI_NAME,
    CLI_CMD,
    CLI_FOLDER_NAME,
    INTERNAL_FOLDER,
  };
  const filesWritten: string[] = [];
  const rollback = options?.rollback;
  const agentsRendered = await runTemplate({
    templatePath: fs.ref(`${SCAFFOLD_DIR}/templates/agents.njk`),
    variables,
  });
```

### Comments

Don't add comments to code like
```ts
// 1. this section does this

// 2. this section does that
```
The code should be self-documenting. Only add comments when it makes absolute sense.