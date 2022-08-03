import * as fs from "fs";
import { buildASTSchema, DocumentNode, Kind, parse } from "graphql";
import path = require("path/posix");
import * as GraphQL from "graphql";

import { NetlifyGraph } from "./index";

const { writeFileSync, readFileSync } = fs;

type BasicOperationFile = {
  name: string;
  path: string;
  content: string;
  parsedOperation: DocumentNode;
};

const cleanDirectory = (directory: string) => {
  fs.readdirSync(directory).forEach((filename) =>
    fs.rmSync(path.resolve(directory, filename))
  );
};

const test = async () => {
  const inputNetlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
    netlifyGraphPath: ["functions", "netlifyGraph"],
    graphQLConfigJsonFilename: [".graphqlrc.json"],
    framework: "custom",
    webhookBasePath: "/api",
    functionsPath: ["pages", "api"],
    graphQLOperationsSourceDirectory: ["tests", "assets", "operations"],
    graphQLOperationsSourceFilename: [
      "tests",
      "assets",
      "netlifyGraphOperationsLibrary2.graphql",
    ],
    graphQLSchemaFilename: ["tests", "assets", "netlifyGraphSchema.graphql"],
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

  const sourceGraphQLFilename =
    inputNetlifyGraphConfig.graphQLOperationsSourceFilename &&
    path.resolve(
      path.join(...inputNetlifyGraphConfig.graphQLOperationsSourceFilename)
    );
  const sourceGraphQLDirectory = path.resolve(
    ...inputNetlifyGraphConfig.graphQLOperationsSourceDirectory
  );
  const schemaGraphQLFilename = path.resolve(
    ...inputNetlifyGraphConfig.graphQLSchemaFilename
  );

  const schemaGraphQLFile = readFileSync(schemaGraphQLFilename, "utf8");
  const schema = buildASTSchema(parse(schemaGraphQLFile));

  const legacySourceGraphQLFile =
    sourceGraphQLFilename &&
    fs.existsSync(sourceGraphQLFilename) &&
    readFileSync(sourceGraphQLFilename, "utf8");

  const operationsPath = path.resolve(sourceGraphQLDirectory);
  fs.mkdirSync(operationsPath, { recursive: true });

  if (legacySourceGraphQLFile) {
    const legacyParsedDoc: DocumentNode = parse(legacySourceGraphQLFile);

    const { functions: legacyFunctions, fragments: legacyFragments } =
      NetlifyGraph.extractFunctionsFromOperationDoc(GraphQL, legacyParsedDoc);

    console.log("Legacy operations file found, migrating...");

    console.log("Migrating functions...");
    Object.values(legacyFunctions).forEach((fn) => {
      const filename = path.resolve(
        ...[
          ...inputNetlifyGraphConfig.graphQLOperationsSourceDirectory,
          `${fn.operationName}.graphql`,
        ]
      );
      console.log(`Migrating ${fn.operationName} to ${filename}...`);
      fs.writeFileSync(filename, fn.operationString, "utf8");
    });

    console.log("Migrating fragments...");
    Object.values(legacyFragments).forEach((fn) => {
      const filename = path.resolve(
        ...[
          ...inputNetlifyGraphConfig.graphQLOperationsSourceDirectory,
          `${fn.fragmentName}.graphql`,
        ]
      );
      console.log(`Migrating ${fn.fragmentName} to ${filename}...`);
      fs.writeFileSync(filename, fn.operationString, "utf8");
    });

    console.log("Deleting legacy operations file...");
    // fs.unlinkSync(sourceGraphQLFilename);
    console.log("(skipping for test)");
  }

  const operationFiles: BasicOperationFile[] = [];

  let dirCont = fs.readdirSync(operationsPath);
  dirCont.forEach(function (filename) {
    if (filename.match(/.*\.(graphql?)/gi)) {
      const content = fs.readFileSync(
        path.resolve(operationsPath, filename),
        "utf8"
      );
      const file = {
        name: filename,
        path: path.resolve(operationsPath, filename),
        content: content,
        parsedOperation: parse(content),
      };

      operationFiles.push(file);
    }
  });

  const emptyDocDefinitionNode: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [],
  };

  const parsedDoc: DocumentNode = operationFiles.reduce((acc, file) => {
    const { parsedOperation } = file;
    const { definitions } = parsedOperation;
    return {
      kind: Kind.DOCUMENT,
      definitions: [...acc.definitions, ...definitions],
    };
  }, emptyDocDefinitionNode);

  const { functions, fragments } =
    NetlifyGraph.extractFunctionsFromOperationDoc(GraphQL, parsedDoc);

  cleanDirectory(sourceGraphQLDirectory);

  console.log("Writing functions...");
  Object.values(functions).forEach((fn) => {
    const filename = path.resolve(
      ...[
        ...inputNetlifyGraphConfig.graphQLOperationsSourceDirectory,
        `${fn.operationName}.graphql`,
      ]
    );
    console.log(`Writing ${fn.operationName} to ${filename}...`);
    fs.writeFileSync(filename, fn.operationString, "utf8");
  });

  console.log("Writing fragments...");
  Object.values(fragments).forEach((fn) => {
    const filename = path.resolve(
      ...[
        ...inputNetlifyGraphConfig.graphQLOperationsSourceDirectory,
        `${fn.fragmentName}.graphql`,
      ]
    );
    console.log(`Writing ${fn.fragmentName} to ${filename}...`);
    fs.writeFileSync(filename, fn.operationString, "utf8");
  });

  const outputNetlifyGraphConfig = { ...inputNetlifyGraphConfig };

  // const result = NetlifyGraph.generateFunctionsSource(
  //   netlifyGraphConfig,
  //   schema,
  //   sourceGraphQLFile,
  //   functions,
  //   fragments
  // );

  // if (!result) {
  //   throw new Error("result is undefined");
  // }

  // const { clientSource, typeDefinitionsSource } = await result;

  // console.log(typeDefinitionsSource);

  // const sourcePath = `/Users/s/code/gravity/gravity/netlify/functions/netlifyGraph/index.js`;

  // writeFileSync(sourcePath, clientSource);

  // const typeDefinitionsSourcePath = `/Users/s/code/gravity/gravity/netlify/functions/netlifyGraph/index.d.ts`;
  // writeFileSync(typeDefinitionsSourcePath, typeDefinitionsSource);
};

test();
