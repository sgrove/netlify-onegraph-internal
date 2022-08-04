// Rusha gives us a SHA1 (good enough for file content hashing) and was already
// present in the Netlify React UI JS bundle when we introduced lockfiles
import { createHash } from "rusha";

//TODO add schema content hash too?
export type V0_format = {
  version: "v0";
  locked: {
    schemaId: string;
    operationsHash: string;
  };
};

export const defaultLockFileName = "netlifyGraph.lock";

export const hashOperations = (operationsDoc: string) => {
  return createHash().update(operationsDoc).digest("hex");
};

export const createLockfile = ({
  schemaId,
  operationsFileContents,
}: {
  version?: string;
  schemaId: string;
  operationsFileContents: string;
}): V0_format => {
  const operationsHash = hashOperations(operationsFileContents);
  return {
    version: "v0",
    locked: {
      schemaId,
      operationsHash,
    },
  };
};
