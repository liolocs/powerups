#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { previewJsonSchema } from "#schema/preview";

const outputPath = new URL("../preview.schema.json", import.meta.url);

await writeFile(outputPath, `${JSON.stringify(previewJsonSchema(), null, 2)}\n`);