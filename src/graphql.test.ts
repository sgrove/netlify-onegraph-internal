import { writeFileSync, readFileSync } from "fs";
import { normalizeOperationsDoc } from "./graphqlHelpers";

const test = () => {
  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");

  const result = normalizeOperationsDoc(sourceGraphQLFile);

  if (!result) {
    throw new Error("result is undefined");
  }

  writeFileSync("/tmp/netlifyGraphOperationsLibrary.graphql", result);
};

test();
