import { readFileSync } from "fs";
import { buildASTSchema, parse } from "graphql";

import { NetlifyGraph } from "../src/index";

const test = () => {
  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");
  const schemaGraphQLFile = readFileSync(schemaGraphQLFilename, "utf8");

  const schema = buildASTSchema(parse(schemaGraphQLFile));
  const parsedDoc = parse(sourceGraphQLFile);

  const functions = NetlifyGraph.extractFunctionsFromOperationDoc(parsedDoc);

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    netlifyGraphPath: ["..", "..", "lib", "netlifyGraph"],
    framework: "Next.js",
    functionsPath: ["pages", "api"],
    graphQLOperationsSourceFilename: [
      "..",
      "..",
      "lib",
      "netlifyGraphOperationsLibrary.graphql",
    ],
    graphQLSchemaFilename: ["..", "..", "lib", "netlifyGraphSchema.graphql"],
    netlifyGraphImplementationFilename: ["..", "..", "lib", "index.js"],
    netlifyGraphTypeDefinitionsFilename: ["..", "..", "lib", "index.d.ts"],
    netlifyGraphRequirePath: ["..", "..", "lib", "netlifyGraph"],
    extension: "ts",
    moduleType: "esm",
  };

  const source = NetlifyGraph.generateHandlerSource({
    handlerOptions: {
      postHttpMethod: true,
      useClientAuth: true,
    },
    netlifyGraphConfig,
    operationId: "2b0c3674-06b0-4a84-b296-afa92c10dc6b",
    operationsDoc: sourceGraphQLFile,
    schema,
  });

  console.log(source?.source);
};
