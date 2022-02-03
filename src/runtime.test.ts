import { writeFileSync, readFileSync } from "fs";
import { buildASTSchema, parse } from "graphql";
import path = require("path/posix");

import { NetlifyGraph } from "./index";

const test = () => {
  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");
  const schemaGraphQLFile = readFileSync(schemaGraphQLFilename, "utf8");

  const schema = buildASTSchema(parse(schemaGraphQLFile));
  const parsedDoc = parse(sourceGraphQLFile);

  const { functions, fragments } =
    NetlifyGraph.extractFunctionsFromOperationDoc(parsedDoc);

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    netlifyGraphPath: ["..", "..", "lib", "netlifyGraph"],
    framework: "Next.js",
    webhookBasePath: "/api",
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
    language: "typescript",
    runtimeTargetEnv: "node",
  };

  const result = NetlifyGraph.generateFunctionsSource(
    netlifyGraphConfig,
    schema,
    sourceGraphQLFile,
    functions,
    fragments
  );

  if (!result) {
    throw new Error("result is undefined");
  }

  const { clientSource, typeDefinitionsSource } = result;

  console.log(typeDefinitionsSource);
};

test();
