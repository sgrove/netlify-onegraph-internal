import { readFileSync, writeFileSync } from "fs";
import { buildASTSchema, parse } from "graphql";

import { NetlifyGraph } from "./index";

const test = () => {
  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");
  const schemaGraphQLFile = readFileSync(schemaGraphQLFilename, "utf8");

  const schema = buildASTSchema(parse(schemaGraphQLFile));

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    extension: "js",
    graphQLConfigJsonFilename: [".graphqlrc.json"],
    webhookBasePath: "/webhooks",
    functionsPath: [
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "netlify",
      "functions",
    ],
    netlifyGraphPath: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "app",
      "netlifyGraph",
    ],
    netlifyGraphImplementationFilename: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "app",
      "netlifyGraph",
      "index.js",
    ],
    netlifyGraphTypeDefinitionsFilename: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "app",
      "netlifyGraph",
      "index.d.ts",
    ],
    graphQLOperationsSourceDirectory: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "netlify",
      "functions",
      "netlifyGraph",
    ],
    graphQLSchemaFilename: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "netlify",
      "functions",
      "netlifyGraph",
      "netlifyGraphSchema.graphql",
    ],
    netlifyGraphRequirePath: ["../../netlify/functions/netlifyGraph"],
    framework: "Remix",
    moduleType: "esm",
    language: "typescript",
    runtimeTargetEnv: "node",
  };

  console.log("config: ", netlifyGraphConfig);

  const result = NetlifyGraph.generateHandlerSource({
    handlerOptions: {
      postHttpMethod: true,
      useClientAuth: true,
    },
    netlifyGraphConfig,
    operationId: "39b94699-9a08-4deb-bf06-8e5b4d5eee9f",
    operationsDoc: sourceGraphQLFile,
    schema,
  });

  if (typeof result === "undefined") {
    console.error("No generated remix code");
  }

  // @ts-ignore
  const { exportedFiles } = result;

  console.log("exportedFiles", exportedFiles);

  exportedFiles?.forEach((element) => {
    console.log(element.name?.join("/"), element.content);

    const sourcePath =
      "/Users/s/code/remix-netlify-graph-test/" +
      (element.name?.join("/") || "default.ts");

    writeFileSync(sourcePath, element.content);
  });
};

test();
