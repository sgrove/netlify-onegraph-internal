// Rusha gives us a SHA1 (good enough for file content hashing) and was already
// present in the Netlify React UI JS bundle when we introduced lockfiles
import { createHash } from "rusha";

export type V0_format = {
  version: "v0";
  locked: {
    schemaId: string;
    operationsHash: string;
  };
};

export const createLockfile = ({
  schemaId,
  operationsFileContents,
}: {
  version?: string;
  schemaId: string;
  operationsFileContents: string;
}): V0_format => {
  const operationsHash = createHash()
    .update(operationsFileContents)
    .digest("hex");

  return {
    version: "v0",
    locked: {
      schemaId,
      operationsHash,
    },
  };
};

export const defaultLockFileName = "netlifyGraph.lock";
