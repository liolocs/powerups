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

const deleteFileSchema = p({
  name: p.string,
  outputPath: p.string,
});

export const outputSchema = p({
  create: p.array(createFileSchema),
  modify: p.array(modifyFileSchema),
  delete: p.array(deleteFileSchema).optional(),
});

const suboutputSchema = p({
  name: p.string,
  variables: p.record(p.string, p.string),
  outputPathOverride: p({
    create: p.record(p.string, p.string).optional(),
    modify: p.record(p.string, p.string).optional(),
    delete: p.record(p.string, p.string).optional(),
  }).optional(),
});

const packageDependencyGroupSchema = p({
  target: p.string.optional(),
  dependencies: p.array(p.string).optional(),
  devDependencies: p.array(p.string).optional(),
  peerDependencies: p.array(p.string).optional(),
});

export const instructionsSchema = p({
  name: p.string,
  variables: p.array(p.string),
  intent: p.array(p.string),
  packageDependencies: p.array(packageDependencyGroupSchema).optional(),
  output: outputSchema,
  includes: p.array(suboutputSchema).optional(),
});

export const packageDependencyGroupArraySchema = p.array(packageDependencyGroupSchema);

export type Instructions = (typeof instructionsSchema)["infer"];
export type SuboutputRef = (typeof suboutputSchema)["infer"];