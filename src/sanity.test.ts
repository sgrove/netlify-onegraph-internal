import { writeFileSync, readFileSync } from "fs";
import { buildASTSchema, parse } from "graphql";
import * as GraphQL from "graphql";
import path = require("path/posix");

import { NetlifyGraph } from "./index";
import { registerConsole } from "./internalConsole";

const test = () => {
  registerConsole(console);

  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");
  const schemaGraphQLFile = readFileSync(schemaGraphQLFilename, "utf8");

  const schema = buildASTSchema(parse(schemaGraphQLFile));
  const parsedDoc = parse(sourceGraphQLFile);

  const functions = NetlifyGraph.extractFunctionsFromOperationDoc(
    GraphQL,
    parsedDoc
  );

  console.log("functions:", functions);

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    netlifyGraphPath: ["..", "..", "lib", "netlifyGraph"],
    graphQLConfigJsonFilename: [".graphqlrc.json"],
    framework: "custom",
    webhookBasePath: "/api",
    functionsPath: [],
    graphQLOperationsSourceDirectory: ["..", "..", "lib", "netlifyGraph"],
    graphQLSchemaFilename: [
      "..",
      "..",
      "lib",
      "netlifyGraph",
      "netlifyGraphSchema.graphql",
    ],
    netlifyGraphImplementationFilename: ["..", "..", "lib", "index.js"],
    netlifyGraphTypeDefinitionsFilename: ["..", "..", "lib", "index.d.ts"],
    netlifyGraphRequirePath: ["..", "..", "lib", "netlifyGraph"],
    extension: "ts",
    moduleType: "esm",
    language: "typescript",
    runtimeTargetEnv: "node",
  };

  const result = NetlifyGraph.generateHandlerSource({
    GraphQL,
    handlerOptions: {
      postHttpMethod: true,
      useClientAuth: true,
    },
    netlifyGraphConfig,
    operationId: "5c7bb879-a810-4a7e-8aec-55d05fd9c172",
    operationsDoc: sourceGraphQLFile,
    schema,
  });

  if (!result) {
    throw new Error("result is undefined");
  }

  const { exportedFiles } = result;

  exportedFiles?.forEach((exportedFile) => {
    const filename =
      exportedFile.kind === "NamedExportedFile"
        ? path.join(...exportedFile.name)
        : "default";

    const contentPath = `/tmp/${filename}.ts`;

    console.log(
      `${contentPath}:
`,
      exportedFile.content
    );

    writeFileSync(contentPath, exportedFile.content);
  });
};

test();
