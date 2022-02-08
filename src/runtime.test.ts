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
    netlifyGraphPath: ["functions", "netlifyGraph"],
    graphQLConfigJsonFilename: [".graphqlrc.json"],
    framework: "custom",
    webhookBasePath: "/api",
    functionsPath: ["pages", "api"],
    graphQLOperationsSourceFilename: [
      "functions",
      "netlifyGraph",
      "netlifyGraphOperationsLibrary.graphql",
    ],
    graphQLSchemaFilename: [
      "functions",
      "netlifyGraph",
      "netlifyGraphSchema.graphql",
    ],
    netlifyGraphImplementationFilename: [
      "functions",
      "netlifyGraph",
      "index.js",
    ],
    netlifyGraphTypeDefinitionsFilename: [
      "functions",
      "netlifyGraph",
      "index.d.ts",
    ],
    netlifyGraphRequirePath: ["functions", "netlifyGraph"],
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

  const sourcePath = `/Users/s/code/gravity/gravity/netlify/functions/netlifyGraph/index.js`;

  writeFileSync(sourcePath, clientSource);

  const typeDefinitionsSourcePath = `/Users/s/code/gravity/gravity/netlify/functions/netlifyGraph/index.d.ts`;
  writeFileSync(typeDefinitionsSourcePath, typeDefinitionsSource);
};

test();
