import { v4 as uuidv4 } from "uuid";

import {
  DirectiveNode,
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  parse,
  print,
} from "graphql";

import * as GraphQLPackage from "graphql";

import { internalConsole } from "./internalConsole";
import {
  extractPersistableOperation as extractPersistableOperationString,
  patchSubscriptionWebhookField,
  patchSubscriptionWebhookSecretField,
  typeScriptSignatureForFragment,
  typeScriptSignatureForOperation,
  typeScriptSignatureForOperationVariables,
} from "./graphqlHelpers";

import {
  computeOperationDataList,
  netlifyFunctionSnippet as genericNetlifyFunctionSnippet,
} from "./codegen/genericExporter";

import { nextjsFunctionSnippet } from "./codegen/nextjsExporter";
import { remixFunctionSnippet } from "./codegen/remixExporter";
import {
  Codegen,
  ExportedFile,
  GenerateHandlerFunction,
} from "./codegen/codegenHelpers";
import { CodegenHelpers } from ".";

export type State = {
  set: (key: string, value?: any) => any;
  get: (key: string) => any;
};

export type NetlifySite = {
  id: string;
};

const capitalizeFirstLetter = (string: string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const replaceAll = (target: string, search: string, replace: string) => {
  const simpleString = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return target.replace(new RegExp(simpleString, "g"), replace);
};

export const NETLIFY_DIRECTIVE_NAME = "netlify";
export const NETLIFY_CACHE_CONTROL_DIRECTIVE_NAME = "netlifyCacheControl";

export type NetlifyGraphConfig = {
  functionsPath: string[];
  webhookBasePath: string;
  netlifyGraphImplementationFilename: string[];
  netlifyGraphTypeDefinitionsFilename: string[];
  graphQLOperationsSourceDirectory: string[];
  graphQLSchemaFilename: string[];
  netlifyGraphRequirePath: string[];
  netlifyGraphPath: string[];
  graphQLOperationsSourceFilename?: string[];
  graphQLConfigJsonFilename: string[];
  framework: string;
  extension: string;
  moduleType: "commonjs" | "esm";
  language: "javascript" | "typescript";
  runtimeTargetEnv: "node" | "browser";
};

export type ExecutionStrategy = "DYNAMIC" | "PERSISTED";

export type CacheStrategy = {
  enabled: boolean;
  timeToLiveSeconds: number;
};

export type ExtractedFunction = {
  id: string;
  operationName: string;
  description: string;
  kind: OperationTypeNode;
  executionStrategy: ExecutionStrategy;
  cacheStrategy: CacheStrategy | undefined;
  fallbackOnError: boolean;
  parsedOperation: OperationDefinitionNode;
  operationString: string;
  operationStringWithoutNetlifyDirective: string;
  persistableOperationString: string;
};

export type ExtractedFragment = {
  id: string;
  fragmentName: string;
  typeCondition: string;
  description: string;
  kind: "fragment";
  parsedOperation: FragmentDefinitionNode;
  operationString: string;
  operationStringWithoutNetlifyDirective: string;
};

export type ParsedFunction = ExtractedFunction & {
  fnName: string;
  safeBody: string;
  returnSignature: string;
  variableSignature: string;
  variableNames: string[];
};

export type ParsedFragment = ExtractedFragment & {
  safeBody: string;
  returnSignature: string;
};

export type PersistedFunction = ParsedFunction & {
  persistedDocId: string;
};

export const defaultSourceOperationsDirectoryName = ["operations"];

export const defaultSourceOperationsFilename =
  "netlifyGraphOperationsLibrary.graphql";
export const defaultGraphQLSchemaFilename = "netlifyGraphSchema.graphql";

export const defaultNetlifyGraphConfig: NetlifyGraphConfig = {
  extension: "js",
  functionsPath: ["netlify", "functions"],
  netlifyGraphPath: ["netlify", "functions", "netlifyGraph"],
  webhookBasePath: "/.netlify/functions",
  graphQLConfigJsonFilename: [".graphqlrc.json"],
  netlifyGraphImplementationFilename: [
    "netlify",
    "functions",
    "netlifyGraph",
    "index.js",
  ],
  netlifyGraphTypeDefinitionsFilename: [
    "netlify",
    "functions",
    "netlifyGraph",
    "index.d.ts",
  ],
  graphQLOperationsSourceDirectory: [
    "netlify",
    "functions",
    "netlifyGraph",
    "operations",
  ],
  graphQLSchemaFilename: [
    "netlify",
    "functions",
    "netlifyGraph",
    defaultGraphQLSchemaFilename,
  ],
  netlifyGraphRequirePath: ["./netlifyGraph"],
  framework: "custom",
  moduleType: "commonjs",
  language: "javascript",
  runtimeTargetEnv: "node",
};

export const defaultExampleOperationsDoc = `query ExampleQuery @netlify(doc: "An example query to start with.") {
  __typename
}`;

const subscriptionParserReturnName = (fn: ParsedFunction) =>
  `${fn.operationName}Event`;

const subscriptionParserName = (fn: ParsedFunction) =>
  `parseAndVerify${fn.operationName}Event`;

const subscriptionFunctionName = (fn: ParsedFunction) =>
  `subscribeTo${fn.operationName}`;

export const generateSubscriptionFunctionTypeDefinition = (
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  fn: ParsedFunction,
  fragments: Record<string, ParsedFragment>
) => {
  const fragmentDefinitions: Record<string, FragmentDefinitionNode> =
    Object.entries(fragments).reduce((acc, [fragmentName, fragment]) => {
      return { ...acc, [fragmentName]: fragment.parsedOperation };
    }, {});

  const parsingFunctionReturnSignature = typeScriptSignatureForOperation(
    GraphQL,
    schema,
    fn.parsedOperation,
    fragmentDefinitions
  );

  const variableNames = (fn.parsedOperation.variableDefinitions || []).map(
    (varDef) => varDef.variable.name.value
  );

  const variableSignature = typeScriptSignatureForOperationVariables(
    GraphQL,
    variableNames,
    schema,
    fn.parsedOperation
  );

  const jsDoc = replaceAll(fn.description || "", "*/", "!")
    .split("\n")
    .join("\n* ");

  return `/**
* ${jsDoc}
*/
export function ${subscriptionFunctionName(fn)}(
  /**
   * This will be available in your webhook handler as a query parameter.
   * Use this to keep track of which subscription you're receiving
   * events for.
   */
  variables: ${
    variableSignature === "{}" ? "Record<string, never>" : variableSignature
  },
  options?: {
    /**
     * The accessToken to use for the lifetime of the subscription.
     */
    accessToken?: string | null | undefined;
    /**
     * A string id that will be passed to your webhook handler as a query parameter
     * along with each event.
     * This can be used to keep track of which subscription you're receiving
     */
    netlifyGraphWebhookId?: string | null | undefined;
    /**
     * The absolute URL of your webhook handler to handle events from this subscription.
     */
    webhookUrl?: string | null | undefined;
    /**
     * The secret to use when signing the webhook request. Use this to verify
     * that the webhook payload is coming from Netlify Graph. Defaults to the
     * value of the NETLIFY_GRAPH_WEBHOOK_SECRET environment variable.
     */
    webhookSecret?: string | null | undefined;
  }) : void

export type ${subscriptionParserReturnName(
    fn
  )} = ${parsingFunctionReturnSignature}

/**
 * Verify the ${
   fn.operationName
 } event body is signed securely, and then parse the result.
 */
export function ${subscriptionParserName(
    fn
  )} (/** A Netlify Handler Event */ event : WebhookEvent) : null | ${subscriptionParserReturnName(
    fn
  )}
`;
};

// TODO: Handle fragments
export const generateSubscriptionFunction = (
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  fn: ParsedFunction,
  fragments: never[],
  netlifyGraphConfig: NetlifyGraphConfig
) => {
  const patchedWithWebhookUrl = patchSubscriptionWebhookField({
    GraphQL,
    schema,
    definition: fn.parsedOperation,
  });

  const patched = patchSubscriptionWebhookSecretField({
    GraphQL,
    schema,
    definition: patchedWithWebhookUrl,
  });

  // TODO: Don't allow unnamed operations as subscription
  const filename = (patched.name && patched.name.value) || "Unknown";

  const body = print(patched);
  const safeBody = replaceAll(body, "${", "\\${");

  return `const ${subscriptionFunctionName(fn)} = (
  variables,
  rawOptions
  ) => {
    const options = rawOptions || {};
    const netlifyGraphWebhookId = options.netlifyGraphWebhookId;
    const netlifyGraphWebhookUrl = options.webhookUrl || \`\${process.env.DEPLOY_URL}${
      netlifyGraphConfig.webhookBasePath
    }/${filename}?netlifyGraphWebhookId=\${netlifyGraphWebhookId}\`;
    const secret = options.webhookSecret || process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
    const fullVariables = {...variables, netlifyGraphWebhookUrl: netlifyGraphWebhookUrl, netlifyGraphWebhookSecret: { hmacSha256Key: secret }}

    const subscriptionOperationDoc = \`${safeBody}\`;

    fetchNetlifyGraph({
      query: subscriptionOperationDoc,
      operationName: "${fn.operationName}",
      variables: fullVariables,
      options: options,
      fetchStrategy: "${
        fn.executionStrategy === "PERSISTED" &&
        (fn.cacheStrategy?.timeToLiveSeconds || 0) > 0
          ? "GET"
          : "POST"
      }",
  })
}

const ${subscriptionParserName(fn)} = (event, options) => {
  if (!verifyRequestSignature({ event: event }, options)) {
    console.warn("Unable to verify signature for ${filename}")
    return null
  }

  return JSON.parse(event.body || '{}')
}`;
};

const makeFunctionName = (kind: string, operationName: string) => {
  if (kind === "query") {
    return `fetch${capitalizeFirstLetter(operationName)}`;
  }
  if (kind === "mutation") {
    return `execute${capitalizeFirstLetter(operationName)} `;
  }

  return capitalizeFirstLetter(operationName).trim();
};

const pluckDirectiveArgEnumValue = (
  directive: DirectiveNode,
  argName: string
) => {
  const targetArg = directive?.arguments?.find(
    (arg) => arg.name.value === argName
  );

  if (!(targetArg && targetArg.value)) {
    return null;
  }

  if (targetArg.value.kind === Kind.ENUM) {
    return targetArg.value.value;
  }

  return null;
};

const pluckDirectiveArgStringValue = (
  directive: DirectiveNode,
  argName: string
) => {
  const targetArg = directive?.arguments?.find(
    (arg) => arg.name.value === argName
  );

  if (!(targetArg && targetArg.value)) {
    return null;
  }

  if (targetArg.value.kind === Kind.STRING) {
    return targetArg.value.value;
  }

  return null;
};

const pluckDirectiveArgBooleanValue = (
  directive: DirectiveNode,
  argName: string
) => {
  const targetArg = directive?.arguments?.find(
    (arg) => arg.name.value === argName
  );

  if (!(targetArg && targetArg.value)) {
    return null;
  }

  if (targetArg.value.kind === Kind.BOOLEAN) {
    return targetArg.value.value;
  }

  return null;
};

const pluckDirectiveArgObjectValue = (
  directive: DirectiveNode,
  argName: string
) => {
  const targetArg = directive?.arguments?.find(
    (arg) => arg.name.value === argName
  );

  if (!(targetArg && targetArg.value)) {
    return null;
  }

  if (targetArg.value.kind === Kind.OBJECT) {
    return targetArg.value;
  }

  return null;
};

export const pluckNetlifyDirective = (
  definitionNode: OperationDefinitionNode | FragmentDefinitionNode
): {
  id: string;
  description: string;
  executionStrategy: ExecutionStrategy;
} | null => {
  const directive = definitionNode.directives?.find(
    (localDirective) => localDirective.name.value === NETLIFY_DIRECTIVE_NAME
  );

  if (!directive) {
    return null;
  }

  const docString = pluckDirectiveArgStringValue(directive, "doc") || "";
  let id = pluckDirectiveArgStringValue(directive, "id");
  let executionStrategy = pluckDirectiveArgEnumValue(
    directive,
    "executionStrategy"
  ) as null | ExecutionStrategy;

  if (id === null) {
    id = uuidv4() as string;
  }

  if (
    executionStrategy === null ||
    !["DYNAMIC", "PERSISTED"].includes(executionStrategy)
  ) {
    executionStrategy = "DYNAMIC";
  }

  return {
    id,
    description: docString,
    executionStrategy,
  };
};

export const pluckNetlifyCacheControlDirective = (
  definitionNode: OperationDefinitionNode
): {
  cacheStrategy: CacheStrategy | undefined;
  fallbackOnError: boolean;
} => {
  const defaultStrategy = {
    cacheStrategy: undefined,
    fallbackOnError: false,
  };

  const directive = definitionNode.directives?.find((localDirective) => {
    return localDirective.name.value === NETLIFY_CACHE_CONTROL_DIRECTIVE_NAME;
  });

  if (!directive) {
    return defaultStrategy;
  }

  const rawFallbackOnError = pluckDirectiveArgBooleanValue(
    directive,
    "fallbackOnError"
  );

  const fallbackOnError =
    typeof rawFallbackOnError === "boolean" ? rawFallbackOnError : false;

  let rawCacheStrategy =
    pluckDirectiveArgObjectValue(directive, "cacheStrategy") || undefined;

  let cacheStrategy: CacheStrategy | undefined = undefined;

  if (rawCacheStrategy) {
    const enabledArg = pluckDirectiveArgBooleanValue(directive, "enabled");

    const enabled = enabledArg || false;

    const field = rawCacheStrategy.fields.find(
      (field) => field.name.value === "timeToLiveSeconds"
    );

    if (field?.value.kind === Kind.FLOAT || field?.value.kind === Kind.INT) {
      cacheStrategy = {
        enabled: enabled,
        timeToLiveSeconds: parseFloat(field.value.value),
      };
    }
  }

  const finalStrategy = {
    cacheStrategy: cacheStrategy,
    fallbackOnError: fallbackOnError,
  };

  return finalStrategy;
};

/**
 * Extracts basic functions from a parsed GraphQL operations document
 * @param {DocumentNode} parsedDoc The parsed GraphQL document with @netlify directives
 * @returns {functions: Record<string, ExtractedFunction>, fragments: Record<string, ExtractedFragment>}
 */
export const extractFunctionsFromOperationDoc = (
  GraphQL: typeof GraphQLPackage,
  parsedDoc: DocumentNode
): {
  functions: Record<string, ExtractedFunction>;
  fragments: Record<string, ExtractedFragment>;
} => {
  const functions: Record<string, ExtractedFunction> = {};
  const fragments: Record<string, ExtractedFragment> = {};

  parsedDoc.definitions.forEach((next) => {
    if (
      next.kind !== Kind.OPERATION_DEFINITION &&
      next.kind !== Kind.FRAGMENT_DEFINITION
    ) {
      return null;
    }

    const key = next.name?.value || "unknown";

    const netlifyDirective = pluckNetlifyDirective(next);

    if (netlifyDirective === null) {
      return null;
    }

    const nextWithoutNetlifyDirective = {
      ...next,
      directives: (next.directives || []).filter(
        (directive) =>
          ![
            NETLIFY_DIRECTIVE_NAME,
            NETLIFY_CACHE_CONTROL_DIRECTIVE_NAME,
          ].includes(directive.name.value)
      ),
    };

    if (next.kind === Kind.FRAGMENT_DEFINITION) {
      const typeCondition = next.typeCondition.name.value;
      const operation: ExtractedFragment = {
        id: netlifyDirective.id,
        fragmentName: key,
        typeCondition: typeCondition,
        description: netlifyDirective.description,
        parsedOperation: next,
        kind: "fragment",
        operationString: print(next),
        operationStringWithoutNetlifyDirective: print(
          nextWithoutNetlifyDirective
        ),
      };

      fragments[netlifyDirective.id] = operation;
    } else if (next.kind === Kind.OPERATION_DEFINITION) {
      const isQuery = next.operation === "query";
      const fnName = makeFunctionName(next.operation, key);

      const cacheControl = isQuery
        ? pluckNetlifyCacheControlDirective(next)
        : { cacheStrategy: undefined, fallbackOnError: false };

      const { persistableOperationString } = extractPersistableOperationString(
        GraphQL,
        parsedDoc,
        next
      ) || { persistableOperationString: null };

      const operation: ExtractedFunction = {
        id: netlifyDirective.id,
        operationName: key,
        description: netlifyDirective.description,
        cacheStrategy: cacheControl.cacheStrategy,
        fallbackOnError: cacheControl.fallbackOnError,
        persistableOperationString: persistableOperationString || print(next),
        parsedOperation: next,
        kind: next.operation,
        operationString: print(next),
        operationStringWithoutNetlifyDirective: print(
          nextWithoutNetlifyDirective
        ),
        executionStrategy: netlifyDirective.executionStrategy,
      };

      functions[netlifyDirective.id] = operation;
    }
  });

  return { functions, fragments };
};

const frameworkGeneratorMap: Record<string, GenerateHandlerFunction> = {
  "Next.js": nextjsFunctionSnippet.generateHandler,
  Remix: remixFunctionSnippet.generateHandler,
  default: genericNetlifyFunctionSnippet.generateHandler,
};

const defaultGenerator = genericNetlifyFunctionSnippet.generateHandler;

/**
 * Given a schema, GraphQL operations doc, a target definitionId, and a Netlify Graph config, generates a set of handlers (and potentially components) for the correct framework.
 */
export const generateHandlerSource = async ({
  GraphQL,
  handlerOptions,
  netlifyGraphConfig,
  operationId: definitionId,
  operationsDoc,
  schema,
}: {
  GraphQL: typeof GraphQLPackage;
  handlerOptions: Record<string, boolean>;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationId: string;
  operationsDoc: string;
  schema: GraphQLSchema;
}): Promise<
  | {
      exportedFiles: ExportedFile[];
      operation: OperationDefinitionNode;
    }
  | undefined
> => {
  const parsedDoc = parse(operationsDoc, { noLocation: true });
  const operations = extractFunctionsFromOperationDoc(GraphQL, parsedDoc);
  const functions = operations.functions;
  const fn = functions[definitionId] || operations.fragments[definitionId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${definitionId} not found in graphql, found: ${Object.keys(
        functions
      ).join(", ")}}`
    );
    return;
  }

  const odl = computeOperationDataList({
    GraphQL,
    parsedDoc,
    query: fn.operationString,
    variables: {},
    fragmentDefinitions: parsedDoc.definitions.filter(
      (d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION
    ),
  });

  const generate =
    frameworkGeneratorMap[netlifyGraphConfig.framework] || defaultGenerator;

  const { exportedFiles } = await generate({
    GraphQL,
    netlifyGraphConfig,
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  });

  return { exportedFiles, operation: fn.parsedOperation };
};

/**
 * Given a schema, GraphQL operations doc, a target operationId, and a Netlify Graph config, generates a set of handlers (and potentially components) for the correct framework.
 */
export const generateCustomHandlerSource = async ({
  GraphQL,
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  schema,
  generate,
}: {
  GraphQL: typeof GraphQLPackage;
  handlerOptions: Record<string, boolean>;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationId: string;
  operationsDoc: string;
  schema: GraphQLSchema;
  generate: Codegen["generateHandler"];
}): Promise<
  | {
      exportedFiles: ExportedFile[];
      operation: OperationDefinitionNode;
    }
  | undefined
> => {
  const parsedDoc = parse(operationsDoc, { noLocation: true });
  const operations = extractFunctionsFromOperationDoc(GraphQL, parsedDoc);
  const fn =
    operations.functions[operationId] || operations.fragments[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql among:
 [${Object.keys(operations).join(",\n ")}]`
    );
    return;
  }

  const odl = computeOperationDataList({
    GraphQL,
    parsedDoc,
    query: fn.operationString,
    variables: {},
    fragmentDefinitions: parsedDoc.definitions.filter(
      (d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION
    ),
  });

  const { exportedFiles } = await generate({
    GraphQL,
    netlifyGraphConfig,
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  });

  return { exportedFiles, operation: fn.parsedOperation };
};

/**
 * Given a schema, GraphQL operations doc, a target operationId, and a Netlify Graph config, generates a preview of the full handler's output
 */
export const generatePreview = ({
  GraphQL,
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  schema,
  generate,
}: {
  GraphQL: typeof GraphQLPackage;
  handlerOptions: Record<string, boolean>;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationId: string;
  operationsDoc: string;
  schema: GraphQLSchema;
  generate: Codegen["generatePreview"];
}):
  | {
      exportedFile: ExportedFile;
      operation: OperationDefinitionNode;
    }
  | undefined => {
  if (!generate) {
    return;
  }

  const parsedDoc = parse(operationsDoc, { noLocation: true });
  const operations = extractFunctionsFromOperationDoc(GraphQL, parsedDoc);
  const fn = operations.functions[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql among:
 [${Object.keys(operations).join(",\n ")}]`
    );
    return;
  }

  const odl = computeOperationDataList({
    GraphQL,
    parsedDoc,
    query: fn.operationString,
    variables: {},
    fragmentDefinitions: parsedDoc.definitions.filter(
      (d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION
    ),
  });

  const exportedFile = generate({
    GraphQL,
    netlifyGraphConfig,
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  });

  if (!exportedFile) {
    return;
  }

  return { exportedFile, operation: fn.parsedOperation };
};
