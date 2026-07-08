import p from "pema";

export const modificationSchema = p({
  where: p.union(
    p.string,
    p.object({ after: p.string }),
    p.object({ before: p.string }),
  ),
  content: p.string,
});

export const modificationArraySchema = p.array(modificationSchema);

export type Modification = (typeof modificationSchema)["infer"];