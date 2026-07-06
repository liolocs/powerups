import p from "pema";

const fileSchema = p({
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

export const outputSchema = p({
  files: p.array(fileSchema),
});

const suboutputSchema = p({
  name: p.string,
  variables: p.record(p.string, p.string),
  files: p.record(p.string, p.string).optional(),
});

export const instructionsSchema = p({
  name: p.string,
  variables: p.array(p.string),
  intent: p.array(p.string),
  output: outputSchema,
  includes: p.array(suboutputSchema).optional(),
});

export type Instructions = (typeof instructionsSchema)["infer"];
export type SuboutputRef = (typeof suboutputSchema)["infer"];