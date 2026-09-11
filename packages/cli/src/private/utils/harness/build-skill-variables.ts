import {
  CLI_CMD,
  CLI_FOLDER_NAME,
  INTERNAL_FOLDER,
  SINGULAR_NAME_FOR_CLI,
} from "#constants";
import type { ResolvedVariable } from "#utils/use/resolved-variable";

export default function buildSkillVariables(): ResolvedVariable {
  return {
    CLI_CMD,
    CLI_FOLDER_NAME,
    INTERNAL_FOLDER,
    SINGULAR_NAME_FOR_CLI,
  };
}