import { writeFileSync, readFileSync } from "fs";
import { buildASTSchema, Kind, OperationDefinitionNode, parse } from "graphql";
import * as GraphQL from "graphql";
import {
  normalizeOperationsDoc,
  typeScriptSignatureForOperationVariables,
} from "./graphqlHelpers";

const test = () => {
  const sourceGraphQLFilename =
    "./tests/assets/netlifyGraphOperationsLibrary.graphql";
  const schemaGraphQLFilename = "./tests/assets/netlifyGraphSchema.graphql";

  const sourceGraphQLFile = readFileSync(sourceGraphQLFilename, "utf8");
  const schemaFile = readFileSync(schemaGraphQLFilename, "utf8");

  const schema = buildASTSchema(parse(schemaFile));
  const opsDoc = parse(sourceGraphQLFile);

  const targetOperationName = "Deprecated_FindLoggedInServicesQuery";

  const operation: OperationDefinitionNode | undefined =
    opsDoc.definitions.find((operation) => {
      if (
        operation.kind === Kind.OPERATION_DEFINITION &&
        operation.name?.value === targetOperationName
      ) {
        return true;
      }
    }) as OperationDefinitionNode | undefined;

  if (!operation) {
    throw new Error(`Could not find operation: ${targetOperationName}`);
  }

  const operationVariableNames =
    operation.variableDefinitions?.map(
      (variableDefinition) => variableDefinition.variable.name.value
    ) || [];

  const variableSignature = typeScriptSignatureForOperationVariables(
    GraphQL,
    operationVariableNames,
    schema,
    operation
  );

  console.log(`variableSignature:\n${variableSignature}`);

  const result = normalizeOperationsDoc(GraphQL, sourceGraphQLFile);

  if (!result) {
    throw new Error("result is undefined");
  }

  writeFileSync("/tmp/netlifyGraphOperationsLibrary.graphql", result);
};

test();
