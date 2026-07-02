import p from "pema";

const fileSchema = p({
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

export const outputSchema = p({
  files: p.array(fileSchema),
});

export const instructionsSchema = p({
  name: p.string,
  variables: p.array(p.string),
  intent: p.array(p.string),
  output: outputSchema,
});

export type Instructions = (typeof instructionsSchema)["infer"];