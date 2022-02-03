import { readFileSync } from "fs";
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
      "netlify",
      "functions",
      "netlifyGraph",
    ],
    netlifyGraphImplementationFilename: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "netlify",
      "functions",
      "netlifyGraph",
      "index.js",
    ],
    netlifyGraphTypeDefinitionsFilename: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "netlify",
      "functions",
      "netlifyGraph",
      "index.d.ts",
    ],
    graphQLOperationsSourceFilename: [
      "/",
      "Users",
      "s",
      "code",
      "remix-netlify-graph-test",
      "netlify",
      "functions",
      "netlifyGraph",
      "netlifyGraphOperationsLibrary.graphql",
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
    netlifyGraphRequirePath: ["./netlifyGraph"],
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
    operationId: "12b5bdea-9bab-4164-a731-5e697b1552be",
    operationsDoc: sourceGraphQLFile,
    schema,
  });

  if (typeof result === "undefined") {
    console.error("No generated next.js code");
  }

  // @ts-ignore
  const { exportedFiles } = result;

  console.log("exportedFiles", exportedFiles);

  exportedFiles?.forEach((element) => {
    console.log(element.name?.join("/"), element.content);
  });
};

test();
