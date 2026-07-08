import p from "pema";

const createFileSchema = p({
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

const modifyFileSchema = p({
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

export const outputSchema = p({
  create: p.array(createFileSchema),
  modify: p.array(modifyFileSchema),
});

const suboutputSchema = p({
  name: p.string,
  variables: p.record(p.string, p.string),
  outputPathOverride: p({
    create: p.record(p.string, p.string).optional(),
    modify: p.record(p.string, p.string).optional(),
  }).optional(),
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