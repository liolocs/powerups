import test from "#test-utils/test/index";
import runtime from "@rcompat/runtime";
import buildVariables from "#utils/create/build-variables";
import { runTemplate } from "#template-runners/index";

const root = await runtime.projectRoot();

test.case("intent and variables flags land in the rendered index.ts", async assert => {
  const templateRef = root.append("/.powerups/installed/_internal/create-powerup/src/dynamic-create/powerup-index.ts");

  const variables = buildVariables({
    name: "saas-starter",
    description: "Scaffolds a SaaS starter",
    intent: "Saas, Nextjs with tailwind and auth0",
    requiredVariables: "theme,projectName,auth0ClientId,auth0Domain,auth0Audience",
    optionalVariables: undefined,
    powerupType: "single-use",
    outputPath: "installed/_internal",
  });

  const rendered = await runTemplate({ templatePath: templateRef, variables });

  assert(rendered).includes('["Saas","Nextjs with tailwind and auth0"]');
  assert(rendered).includes('["theme","projectName","auth0ClientId","auth0Domain","auth0Audience"]');
  assert(rendered).includes('"single-use"');
});