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

  const result = NetlifyGraph.generateHandlerSource({
    handlerOptions: {
      postHttpMethod: true,
      useClientAuth: true,
    },
    netlifyGraphConfig,
    operationId: "2b0c3674-06b0-4a84-b296-afa92c10dc6b",
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

    console.log(
      `${filename}:
`,
      exportedFile.content
    );
    writeFileSync(`/tmp/${filename}.ts`, exportedFile.content);
  });
};

test();
