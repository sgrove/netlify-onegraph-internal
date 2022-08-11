import { writeFileSync, readFileSync } from "fs";
import { buildASTSchema, parse } from "graphql";
import * as GraphQL from "graphql";
import { registerConsole } from "./internalConsole";

import path = require("path/posix");

import { NetlifyGraph } from "./index";

const test = async () => {
  registerConsole(console);

  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");
  const schemaGraphQLFile = readFileSync(schemaGraphQLFilename, "utf8");

  const schema = buildASTSchema(parse(schemaGraphQLFile));
  const parsedDoc = parse(sourceGraphQLFile);

  const { functions, fragments } =
    NetlifyGraph.extractFunctionsFromOperationDoc(GraphQL, parsedDoc);

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    netlifyGraphPath: ["functions", "netlifyGraph"],
    graphQLConfigJsonFilename: [".graphqlrc.json"],
    framework: "custom",
    webhookBasePath: "/api",
    functionsPath: ["pages", "api"],
    graphQLOperationsSourceDirectory: ["functions", "netlifyGraph"],
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

  const result = await NetlifyGraph.generateFunctionsSource(
    GraphQL,
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

  const sourcePath = `/tmp/index.js`;

  writeFileSync(sourcePath, clientSource[0]);

  const typeDefinitionsSourcePath = `/tmp/index.d.ts`;
  writeFileSync(typeDefinitionsSourcePath, typeDefinitionsSource);
};

test();
