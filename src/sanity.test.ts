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

  const functions = NetlifyGraph.extractFunctionsFromOperationDoc(parsedDoc);

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    netlifyGraphPath: ["..", "..", "lib", "netlifyGraph"],
    graphQLConfigJsonFilename: [".graphqlrc.json"],
    framework: "custom",
    webhookBasePath: "/api",
    functionsPath: [],
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

  const result = NetlifyGraph.generateHandlerSource({
    handlerOptions: {
      postHttpMethod: true,
      useClientAuth: true,
    },
    netlifyGraphConfig,
    operationId: "c67c5c11-cbc4-48ed-8ac8-2803a4e4dc5f",
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

    const contentPath = `/Users/s/code/gravity/gravity/netlify/functions/${filename}.ts`;

    console.log(
      `${contentPath}:
`,
      exportedFile.content
    );

    writeFileSync(contentPath, exportedFile.content);
  });
};

test();
