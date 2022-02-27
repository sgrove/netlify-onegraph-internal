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
import { ExportedFile, FrameworkGenerator } from "./codegen/codegenHelpers";
import { executeCreatePersistedQueryMutation } from "./oneGraphClient";

export type State = {
  set: (key: string, value?: any) => any;
  get: (key: string) => any;
};

export type NetlifySite = {
  id: string;
};

const capitalizeFirstLetter = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const replaceAll = (target, search, replace) => {
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
  graphQLOperationsSourceFilename: string[];
  graphQLSchemaFilename: string[];
  netlifyGraphRequirePath: string[];
  netlifyGraphPath: string[];
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
  graphQLOperationsSourceFilename: [
    "netlify",
    "functions",
    "netlifyGraph",
    defaultSourceOperationsFilename,
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

const generatedNetlifyGraphDynamicClient = (
  netlifyGraphConfig: NetlifyGraphConfig
) =>
  `${out(
    netlifyGraphConfig,
    ["node"],
    `const httpFetch = (siteId, options) => {
      const reqBody = options.body || null
      const userHeaders = options.headers || {}
      const headers = {
        ...userHeaders,
        'Content-Type': 'application/json',
        'Content-Length': reqBody.length,
      }

      const timeoutMs = 30_000

      const reqOptions = {
        method: 'POST',
        headers: headers,
        timeout: timeoutMs,
      }

  const url = 'https://serve.onegraph.com/graphql?app_id=' + siteId

  const respBody = []

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
        return reject(
          new Error(
            "Netlify Graph return non-OK HTTP status code" + res.statusCode,
          ),
        )
      }

      res.on('data', (chunk) => respBody.push(chunk))

      res.on('end', () => {
        const resString = buffer.Buffer.concat(respBody).toString()
        resolve(resString)
      })
    })

    req.on('error', (error) => {
      console.error('Error making request to Netlify Graph:', error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request to Netlify Graph timed out'))
    })

    req.write(reqBody)
    req.end()
  })
}
`
  )}
${out(
  netlifyGraphConfig,
  ["browser"],
  `const httpFetch = (siteId, options) => {
  const reqBody = options.body || null;
  const userHeaders = options.headers || {};
  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
  };

  const timeoutMs = 30_000;

  const reqOptions = {
    method: 'POST',
    headers: headers,
    timeout: timeoutMs,
    body: reqBody
  };

  const url = 'https://serve.onegraph.com/graphql?app_id=' + siteId;

  return fetch(url, reqOptions).then(response => response.text());
}`
)}

const fetchNetlifyGraph = function fetchNetlifyGraph(input) {
  const query = input.query;
  const docId = input.doc_id;
  const operationName = input.operationName;
  const variables = input.variables;

  const options = input.options || {};
  const accessToken = options.accessToken;
  const siteId = options.siteId || process.env.SITE_ID;

  const payload = {
    query: query,
    doc_id: docId,
    variables: variables,
    operationName: operationName,
  };

  const response = httpFetch(
    siteId,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? "Bearer " + accessToken : '',
      },
      body: JSON.stringify(payload),
    },
  );

  return response.then(result => JSON.parse(result));
}
`;

const generatedNetlifyGraphPersistedClient = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schemaId: string
) =>
  `${out(
    netlifyGraphConfig,
    ["node"],
    `const httpGet = (input) => {
  const userHeaders = input.headers || {};
  const fullHeaders = {
    ...userHeaders,
    'Content-Type': 'application/json'
  };
  const timeoutMs = 30_000
  const reqOptions = {
    method: 'GET',
    headers: fullHeaders,
    timeout: timeoutMs,
  };

  if (!input.docId) {
    throw new Error('docId is required for GET requests: ' + input.operationName);
  }

  const schemaId = input.schemaId || ${
    schemaId ? `"${schemaId}"` : "undefined"
  };

  console.log("httpGet node schemaId: ", schemaId);

  const encodedVariables = encodeURIComponent(input.variables || "null");
  const url = 'https://serve.onegraph.com/graphql?app_id=' + input.siteId + '&doc_id=' + input.docId + (input.operationName ? ('&operationName=' + input.operationName) : '') + (schemaId ? ('&schemaId=' + schemaId) : '') + '&variables=' + encodedVariables;
        
  const respBody = []

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
        return reject(
          new Error(
            "Netlify Graph return non-OK HTTP status code" + res.statusCode,
          ),
        )
      }

      res.on('data', (chunk) => respBody.push(chunk))

      res.on('end', () => {
        const resString = buffer.Buffer.concat(respBody).toString()
        resolve(resString)
      })
    })

    req.on('error', (error) => {
      console.error('Error making request to Netlify Graph:', error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request to Netlify Graph timed out'))
    })

    req.end()
  })
}

const httpPost = (input) => {
  const reqBody = input.body || null
  const userHeaders = input.headers || {}
  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
    'Content-Length': reqBody.length,
  }

  const timeoutMs = 30_000

  const reqOptions = {
    method: 'POST',
    headers: headers,
    timeout: timeoutMs,
  }

  const schemaId = input.schemaId || ${
    schemaId ? `"${schemaId}"` : "undefined"
  };

  console.log("httpPost node schemaId: ", schemaId);


  const url = 'https://serve.onegraph.com/graphql?app_id=' + input.siteId +
              (schemaId ? ('&schemaId=' + schemaId) : '');
  const respBody = []

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
        return reject(
          new Error(
            "Netlify Graph return non-OK HTTP status code" + res.statusCode,
          ),
        )
      }

      res.on('data', (chunk) => respBody.push(chunk))

      res.on('end', () => {
        const resString = buffer.Buffer.concat(respBody).toString()
        resolve(resString)
      })
    })

    req.on('error', (error) => {
      console.error('Error making request to Netlify Graph:', error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request to Netlify Graph timed out'))
    })

    req.write(reqBody)
    req.end()
  })
}`
  )}

${out(
  netlifyGraphConfig,
  ["browser"],
  `const httpGet = (input) => {
  const userHeaders = input.headers || {};
  const fullHeaders = {
    ...userHeaders,
    'Content-Type': 'application/json',
  };

  const timeoutMs = 30_000;

  const reqOptions = {
    method: 'GET',
    headers: fullHeaders,
    timeout: timeoutMs,
  };

  const encodedVariables = encodeURIComponent(
    JSON.stringify(input.variables || null)
  );

  const schemaId = input.schemaId || ${
    schemaId ? `"${schemaId}"` : "undefined"
  };

  console.log("httpGet browser schemaId: ", schemaId);

  const encodedVariables = encodeURIComponent(input.variables || "null");

  const url =
    'https://serve.onegraph.com/graphql?app_id=' +
    input.siteId +
    '&doc_id=' +
    input.docId +
    (input.operationName ? '&operationName=' + input.operationName : '') +
    (schemaId ? ('&schemaId=' + schemaId) : '') +
    '&variables=' +
    encodedVariables;

  return fetch(url, reqOptions).then((response) => response.text());
};

const httpPost = (input) => {
  const userHeaders = input.headers || {};
  const fullHeaders = {
    ...userHeaders,
    'Content-Type': 'application/json',
  };

  const reqBody = JSON.stringify({
    doc_id: input.docId,
    query: input.query,
    operationName: input.operationName,
    variables: input.variables,
  });

  const timeoutMs = 30_000;

  const reqOptions = {
    method: 'POST',
    headers: fullHeaders,
    timeout: timeoutMs,
    body: reqBody,
  };

  const schemaId = input.schemaId || ${
    schemaId ? `"${schemaId}"` : "undefined"
  };

  console.log("httpPost browser schemaId: ", schemaId);

  const url = 'https://serve.onegraph.com/graphql?app_id=' + input.siteId +
              (schemaId ? ('&schemaId=' + schemaId) : '');

  return fetch(url, reqOptions).then((response) => response.text());
};`
)}

const fetchNetlifyGraph = function fetchNetlifyGraph(input) {
  const docId = input.doc_id;
  const operationName = input.operationName;
  const variables = input.variables;

  const options = input.options || {};
  const accessToken = options.accessToken;
  const siteId = options.siteId || process.env.SITE_ID;

  const httpMethod = input.fetchStrategy === 'GET' ? httpGet : httpPost;

  const response = httpMethod({
    siteId: siteId,
    docId: docId,
    query: input.query,
    headers: {
      Authorization: accessToken ? 'Bearer ' + accessToken : '',
    },
    variables: variables,
    operationName: operationName,
  });

  return response.then((result) => JSON.parse(result));
};
`;

const subscriptionParserReturnName = (fn) => `${fn.operationName}Event`;

const subscriptionParserName = (fn) => `parseAndVerify${fn.operationName}Event`;

const subscriptionFunctionName = (fn) => `subscribeTo${fn.operationName}`;

const out = (
  netlifyGraphConfig: NetlifyGraphConfig,
  envs: ("browser" | "node")[],
  value: string
) => {
  if (!envs.includes(netlifyGraphConfig.runtimeTargetEnv)) {
    return "";
  }

  return value;
};

const exp = (
  netlifyGraphConfig: NetlifyGraphConfig,
  envs: ("browser" | "node")[],
  name: string,
  value: string
) => {
  if (!envs.includes(netlifyGraphConfig.runtimeTargetEnv)) {
    return "";
  }

  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `exports.${name} = ${value}`;
  }

  return `export const ${name} = ${value}`;
};

const imp = (
  netlifyGraphConfig: NetlifyGraphConfig,
  envs: ("browser" | "node")[],
  name: string,
  packageName: string
) => {
  if (!envs.includes(netlifyGraphConfig.runtimeTargetEnv)) {
    return "";
  }

  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `const ${name} = require("${packageName}")`;
  }

  return `import ${name} from "${packageName}"`;
};

export const generateSubscriptionFunctionTypeDefinition = (
  schema: GraphQLSchema,
  fn: ParsedFunction,
  fragments: Record<string, ParsedFragment>
) => {
  const fragmentDefinitions: Record<string, FragmentDefinitionNode> =
    Object.entries(fragments).reduce((acc, [fragmentName, fragment]) => {
      return { ...acc, [fragmentName]: fragment.parsedOperation };
    }, {});

  const parsingFunctionReturnSignature = typeScriptSignatureForOperation(
    schema,
    fn.parsedOperation,
    fragmentDefinitions
  );

  const variableNames = (fn.parsedOperation.variableDefinitions || []).map(
    (varDef) => varDef.variable.name.value
  );

  const variableSignature = typeScriptSignatureForOperationVariables(
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
  schema,
  fn,
  fragments,
  netlifyGraphConfig: NetlifyGraphConfig
) => {
  const patchedWithWebhookUrl = patchSubscriptionWebhookField({
    schema,
    definition: fn.parsedOperation,
  });

  const patched = patchSubscriptionWebhookSecretField({
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

const makeFunctionName = (kind, operationName) => {
  if (kind === "query") {
    return `fetch${capitalizeFirstLetter(operationName)}`;
  }
  if (kind === "mutation") {
    return `execute${capitalizeFirstLetter(operationName)} `;
  }

  return capitalizeFirstLetter(operationName).trim();
};

export const queryToFunctionDefinition = (
  fullSchema: GraphQLSchema,
  parsedDoc: DocumentNode,
  persistedQuery: ExtractedFunction,
  enabledFragments: Record<string, ParsedFragment>
): ParsedFunction | undefined => {
  const basicFn = {
    id: persistedQuery.id,
    operationString: persistedQuery.operationString,
    description: persistedQuery.description || "",
  };

  const body = basicFn.operationString;
  const safeBody = replaceAll(body, "${", "\\${");

  const parsed = parse(body, { noLocation: true });
  const operations = parsed.definitions.filter(
    (def) => def.kind === Kind.OPERATION_DEFINITION
  );
  const fragmentDefinitions = parsed.definitions.filter(
    (def) => def.kind === Kind.FRAGMENT_DEFINITION
  ) as FragmentDefinitionNode[];

  const fragments = Object.values(enabledFragments).reduce(
    (acc, def) => ({ ...acc, [def.fragmentName]: def.parsedOperation }),
    {}
  );

  if (!operations) {
    internalConsole.error(`Operation definition is required in ${basicFn.id}`);
    return;
  }

  const [operation] = operations;

  if (operation.kind !== Kind.OPERATION_DEFINITION) {
    internalConsole.error(`Definition is not an operation in ${basicFn.id}`);
    return;
  }

  const returnSignature = typeScriptSignatureForOperation(
    fullSchema,
    operation,
    fragments
  );

  const variableNames = (operation.variableDefinitions || []).map(
    (varDef) => varDef.variable.name.value
  );

  const variableSignature = typeScriptSignatureForOperationVariables(
    variableNames,
    fullSchema,
    operation
  );

  const operationName = operation.name && operation.name.value;

  if (!operationName) {
    internalConsole.error(
      `Operation name is required in ${
        basicFn.operationString
      }\n\tfound: ${JSON.stringify(operation.name)}`
    );
    return;
  }

  const operationWithoutNetlifyDirective = {
    ...operation,
    directives: (operation.directives || []).filter(
      (directive) => directive.name.value !== NETLIFY_DIRECTIVE_NAME
    ),
  };

  const persistableOperationString =
    extractPersistableOperationString(parsedDoc, operation) || print(operation);

  const cacheControl = pluckNetlifyCacheControlDirective(operation);
  const netlifyDirective = pluckNetlifyDirective(operation);

  const fn: ParsedFunction = {
    ...basicFn,
    fnName: makeFunctionName(operation.operation, operationName),
    safeBody,
    kind: operation.operation,
    variableSignature,
    cacheStrategy: cacheControl.cacheStrategy,
    fallbackOnError: cacheControl.fallbackOnError,
    persistableOperationString,
    returnSignature,
    operationName,
    parsedOperation: operation,
    operationStringWithoutNetlifyDirective: print(
      operationWithoutNetlifyDirective
    ),
    variableNames: variableNames,
    executionStrategy: netlifyDirective?.executionStrategy || "DYNAMIC",
  };

  return fn;
};

export const fragmentToParsedFragmentDefinition = (
  fullSchema: GraphQLSchema,
  persistedQuery: ExtractedFragment
): ParsedFragment | undefined => {
  const basicFn = {
    id: persistedQuery.id,
    operationString: persistedQuery.operationString,
    description: persistedQuery.description || "",
  };

  const body = basicFn.operationString;
  const safeBody = replaceAll(body, "${", "\\${");

  const parsed = parse(body, { noLocation: true });
  const operations = parsed.definitions.filter(
    (def) => def.kind === Kind.OPERATION_DEFINITION
  );
  const fragmentDefinitions = parsed.definitions.filter(
    (def) => def.kind === Kind.FRAGMENT_DEFINITION
  ) as FragmentDefinitionNode[];

  const fragments = fragmentDefinitions.reduce(
    (acc, def) => ({ ...acc, [def.name.value]: def }),
    {}
  );

  if (!operations) {
    internalConsole.error(`Operation definition is required in ${basicFn.id}`);
    return;
  }

  const [operation] = fragmentDefinitions;

  if (operation.kind !== Kind.FRAGMENT_DEFINITION) {
    internalConsole.error(`Definition is not an operation in ${basicFn.id}`);
    return;
  }

  const returnSignature = typeScriptSignatureForFragment(
    fullSchema,
    operation,
    fragments
  );

  const variableNames = (operation.variableDefinitions || []).map(
    (varDef) => varDef.variable.name.value
  );

  const variableSignature = typeScriptSignatureForOperationVariables(
    variableNames,
    fullSchema,
    // @ts-ignore TODO: FIX THIS!
    operation
  );

  const operationName = operation.name && operation.name.value;

  if (!operationName) {
    internalConsole.error(
      `Operation name is required in ${
        basicFn.operationString
      }\n\tfound: ${JSON.stringify(operation.name)}`
    );
    return;
  }

  const operationWithoutNetlifyDirective = {
    ...operation,
    directives: (operation.directives || []).filter(
      (directive) => directive.name.value !== NETLIFY_DIRECTIVE_NAME
    ),
  };

  const fn: ParsedFragment = {
    ...basicFn,
    safeBody,
    kind: "fragment",
    returnSignature,
    fragmentName: operationName,
    parsedOperation: operation,
    operationStringWithoutNetlifyDirective: print(
      operationWithoutNetlifyDirective
    ),
  };

  return fn;
};

export const generateJavaScriptClient = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  operationsDoc: string,
  enabledFunctions: ParsedFunction[]
) => {
  const operationsWithoutTemplateDollar = replaceAll(
    operationsDoc,
    "${",
    "\\${"
  );
  const safeOperationsDoc = replaceAll(
    operationsWithoutTemplateDollar,
    "`",
    "\\`"
  );
  const functionDecls = enabledFunctions.map((fn) => {
    if (fn.kind === "subscription") {
      const fragments = [];
      return generateSubscriptionFunction(
        schema,
        fn,
        fragments,
        netlifyGraphConfig
      );
    }

    const dynamicFunction = `${exp(
      netlifyGraphConfig,
      ["browser", "node"],
      fn.fnName,
      `(
      variables,
      options
      ) => {
      return fetchNetlifyGraph({
        query: \`${fn.persistableOperationString}\`,
        operationName: "${fn.operationName}",
        variables: variables,
        options: options,
        fetchStrategy: "${
          fn.executionStrategy === "PERSISTED" &&
          (fn.cacheStrategy?.timeToLiveSeconds || 0) > 0
            ? "GET"
            : "POST"
        }",
      })
    }`
    )}
`;

    const staticFunction = `${exp(
      netlifyGraphConfig,
      ["browser", "node"],
      fn.fnName,
      `(
      variables,
      options
    ) => {
      return fetchNetlifyGraph({
        query: \`${fn.persistableOperationString}\`,
        operationName: "${fn.operationName}",
        variables: variables,
        options: options,
        fetchStrategy: "${
          fn.executionStrategy === "PERSISTED" &&
          (fn.cacheStrategy?.timeToLiveSeconds || 0) > 0
            ? "GET"
            : "POST"
        }",
      });
    }
`
    )}`;
    return fn.id ? staticFunction : dynamicFunction;
  });

  const exportedFunctionsObjectProperties = enabledFunctions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      const isSubscription = fn.kind === "subscription";

      if (isSubscription) {
        if (netlifyGraphConfig.runtimeTargetEnv === "node") {
          const subscriptionFnName = subscriptionFunctionName(fn);
          const parserFnName = subscriptionParserName(fn);

          const jsDoc = replaceAll(fn.description || "", "*/", "")
            .split("\n")
            .join("\n* ");

          return `/**
  * ${jsDoc}
  */
  ${subscriptionFnName}:${subscriptionFnName},
  /**
   * Verify the event body is signed securely, and then parse the result.
   */
  ${parserFnName}: ${parserFnName}`;
        } else {
          return;
        }
      }

      const jsDoc = replaceAll(fn.description || "", "*/", "")
        .split("\n")
        .join("\n* ");

      return `/**
  * ${jsDoc}
  */
  ${fn.fnName}: ${
        netlifyGraphConfig.moduleType === "commonjs" ? "exports." : ""
      }${fn.fnName}`;
    })
    .filter(Boolean)
    .join(",\n  ");

  const dummyHandler = exp(
    netlifyGraphConfig,
    ["node"],
    "handler",
    `() => {
      // return a 401 json response
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Unauthorized',
        }),
      }
    }`
  );

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
  ${imp(netlifyGraphConfig, ["node"], "buffer", "buffer")}
  ${imp(netlifyGraphConfig, ["node"], "crypto", "crypto")}
  ${imp(netlifyGraphConfig, ["node"], "https", "https")}
  ${imp(netlifyGraphConfig, ["node"], "process", "process")}

${exp(
  netlifyGraphConfig,
  ["node"],
  "verifySignature",
  `(input) => {
  const secret = input.secret
  const body = input.body
  const signature = input.signature

  if (!signature) {
    console.error('Missing signature')
    return false
  }

  const sig = {}
  for (const pair of signature.split(',')) {
    const [key, value] = pair.split('=')
    sig[key] = value
  }

  if (!sig.t || !sig.hmac_sha256) {
    console.error('Invalid signature header')
    return false
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(sig.t)
    .update('.')
    .update(body)
    .digest('hex')

  if (
    !crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(sig.hmac_sha256, 'hex')
    )
  ) {
    console.error('Invalid signature')
    return false
  }

  if (parseInt(sig.t, 10) < Date.now() / 1000 - 300 /* 5 minutes */) {
    console.error('Request is too old')
    return false
  }

  return true
}`
)}

${generatedNetlifyGraphDynamicClient(netlifyGraphConfig)}

${exp(
  netlifyGraphConfig,
  ["node"],
  "verifyRequestSignature",
  `(request, options) => {
  const event = request.event
  const secret = options.webhookSecret || process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
  const signature = event.headers['x-netlify-graph-signature']
  const body = event.body

  if (!secret) {
    console.error(
      'NETLIFY_GRAPH_WEBHOOK_SECRET is not set, cannot verify incoming webhook request'
    )
    return false
  }

  return verifySignature({ secret, signature, body: body || '' })
}`
)}

${functionDecls.join("\n\n")}

/**
 * The generated NetlifyGraph library with your operations
 */
const functions = {
  ${exportedFunctionsObjectProperties}
}

${
  netlifyGraphConfig.moduleType === "commonjs"
    ? "exports.default = functions"
    : "export default functions"
}

${dummyHandler}`;

  return source;
};

export const generateProductionJavaScriptClient = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  operationsDoc: string,
  enabledFunctions: PersistedFunction[],
  schemaId
) => {
  const functionDecls = enabledFunctions.map((fn) => {
    if (fn.kind === "subscription") {
      const fragments = [];
      return generateSubscriptionFunction(
        schema,
        fn,
        fragments,
        netlifyGraphConfig
      );
    }

    const dynamicFunction = `${exp(
      netlifyGraphConfig,
      ["browser", "node"],
      fn.fnName,
      `(
      variables,
      options
      ) => {
      return fetchNetlifyGraph({
        query: \`${replaceAll(fn.persistableOperationString, "`", "`")}\`,
        operationName: "${fn.operationName}",
        variables: variables,
        options: options,
        fetchStrategy: "${
          fn.executionStrategy === "PERSISTED" &&
          (fn.cacheStrategy?.timeToLiveSeconds || 0) > 0
            ? "GET"
            : "POST"
        }",
      })
    }`
    )}
`;

    const staticFunction = `${exp(
      netlifyGraphConfig,
      ["browser", "node"],
      fn.fnName,
      `(
      variables,
      options
    ) => {
      return fetchNetlifyGraph({
        doc_id: "${fn.persistedDocId}",
        operationName: "${fn.operationName}",
        variables: variables,
        options: options,
        fetchStrategy: "${
          fn.executionStrategy === "PERSISTED" &&
          (fn.cacheStrategy?.timeToLiveSeconds || 0) > 0
            ? "GET"
            : "POST"
        }",
      });
    }
`
    )}`;
    return fn.executionStrategy === "DYNAMIC"
      ? dynamicFunction
      : staticFunction;
  });

  const exportedFunctionsObjectProperties = enabledFunctions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      const isSubscription = fn.kind === "subscription";

      if (isSubscription) {
        if (netlifyGraphConfig.runtimeTargetEnv === "node") {
          const subscriptionFnName = subscriptionFunctionName(fn);
          const parserFnName = subscriptionParserName(fn);

          const jsDoc = replaceAll(fn.description || "", "*/", "")
            .split("\n")
            .join("\n* ");

          return `/**
  * ${jsDoc}
  */
  ${subscriptionFnName}:${subscriptionFnName},
  /**
   * Verify the event body is signed securely, and then parse the result.
   */
  ${parserFnName}: ${parserFnName}`;
        } else {
          return;
        }
      }

      const jsDoc = replaceAll(fn.description || "", "*/", "")
        .split("\n")
        .join("\n* ");

      return `/**
  * ${jsDoc}
  */
  ${fn.fnName}: ${
        netlifyGraphConfig.moduleType === "commonjs" ? "exports." : ""
      }${fn.fnName}`;
    })
    .filter(Boolean)
    .join(",\n  ");

  const dummyHandler = exp(
    netlifyGraphConfig,
    ["node"],
    "handler",
    `() => {
      // return a 401 json response
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Unauthorized',
        }),
      }
    }`
  );

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
  ${imp(netlifyGraphConfig, ["node"], "buffer", "buffer")}
  ${imp(netlifyGraphConfig, ["node"], "crypto", "crypto")}
  ${imp(netlifyGraphConfig, ["node"], "https", "https")}
  ${imp(netlifyGraphConfig, ["node"], "process", "process")}

${exp(
  netlifyGraphConfig,
  ["node"],
  "verifySignature",
  `(input) => {
  const secret = input.secret
  const body = input.body
  const signature = input.signature

  if (!signature) {
    console.error('Missing signature')
    return false
  }

  const sig = {}
  for (const pair of signature.split(',')) {
    const [key, value] = pair.split('=')
    sig[key] = value
  }

  if (!sig.t || !sig.hmac_sha256) {
    console.error('Invalid signature header')
    return false
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(sig.t)
    .update('.')
    .update(body)
    .digest('hex')

  if (
    !crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(sig.hmac_sha256, 'hex')
    )
  ) {
    console.error('Invalid signature')
    return false
  }

  if (parseInt(sig.t, 10) < Date.now() / 1000 - 300 /* 5 minutes */) {
    console.error('Request is too old')
    return false
  }

  return true
}`
)}

${generatedNetlifyGraphPersistedClient(netlifyGraphConfig, schemaId)}

${exp(
  netlifyGraphConfig,
  ["node"],
  "verifyRequestSignature",
  `(request, options) => {
  const event = request.event
  const secret = options.webhookSecret || process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
  const signature = event.headers['x-netlify-graph-signature']
  const body = event.body

  if (!secret) {
    console.error(
      'NETLIFY_GRAPH_WEBHOOK_SECRET is not set, cannot verify incoming webhook request'
    )
    return false
  }

  return verifySignature({ secret, signature, body: body || '' })
}`
)}

${functionDecls.join("\n\n")}

/**
 * The generated NetlifyGraph library with your operations
 */
const functions = {
  ${exportedFunctionsObjectProperties}
}

${
  netlifyGraphConfig.moduleType === "commonjs"
    ? "exports.default = functions"
    : "export default functions"
}

${dummyHandler}`;

  return source;
};

export const generateFragmentTypeScriptDefinition = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  fragment: ParsedFragment
) => {
  const jsDoc = replaceAll(fragment.description || ``, "*/", "")
    .split("\n")
    .join("\n* ");

  const baseName = fragment.fragmentName;

  const returnSignatureName = capitalizeFirstLetter(baseName);
  const inputSignatureName = capitalizeFirstLetter(baseName) + "Input";

  return `/**
* ${jsDoc}
*/
export type ${returnSignatureName} = ${fragment.returnSignature};
`;
};

export const generateTypeScriptDefinitions = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  enabledFunctions: ParsedFunction[],
  enabledFragments: Record<string, ParsedFragment>
) => {
  const fragmentDecls = Object.values(enabledFragments).map((fragment) => {
    return generateFragmentTypeScriptDefinition(
      netlifyGraphConfig,
      schema,
      fragment
    );
  });

  const functionDecls = enabledFunctions.map((fn) => {
    const isSubscription = fn.kind === "subscription";

    if (isSubscription) {
      return generateSubscriptionFunctionTypeDefinition(
        schema,
        fn,
        enabledFragments
      );
    }

    const jsDoc = replaceAll(fn.description || ``, "*/", "")
      .split("\n")
      .join("\n* ");

    const baseName = fn.operationName;

    const returnSignatureName = capitalizeFirstLetter(baseName);
    const inputSignatureName = capitalizeFirstLetter(baseName) + "Input";
    const shouldExportInputSignature = fn.variableSignature !== "{}";
    const emptyVariablesGuideDocString =
      fn.variableSignature === "{}"
        ? `/**
  * Pass \`{}\` as no variables are defined for this function.
  */
  `
        : ``;
    const inputSignatureExport = shouldExportInputSignature
      ? `export type ${inputSignatureName} = ${fn.variableSignature};
`
      : "";

    return `${inputSignatureExport}
export type ${returnSignatureName} = ${fn.returnSignature};

/**
 * ${jsDoc}
 */
export function ${fn.fnName}(
  ${emptyVariablesGuideDocString}variables: ${
      shouldExportInputSignature ? inputSignatureName : "Record<string, never>"
    },
  options?: NetlifyGraphFunctionOptions
): Promise<${returnSignatureName}>;`;
  });

  const exportedFunctionsObjectProperties = enabledFunctions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      const isSubscription = fn.kind === "subscription";

      if (isSubscription) {
        if (netlifyGraphConfig.runtimeTargetEnv === "node") {
          const subscriptionFnName = subscriptionFunctionName(fn);
          const parserFnName = subscriptionParserName(fn);

          const jsDoc = replaceAll(fn.description || "", "*/", "")
            .split("\n")
            .join("\n* ");

          return `/**
* ${jsDoc}
*/
${subscriptionFnName}:${subscriptionFnName},
/**
 * Verify the event body is signed securely, and then parse the result.
 */
${parserFnName}: typeof ${parserFnName}`;
        } else {
          return;
        }
      }

      const jsDoc = replaceAll(fn.description || "", "*/", "")
        .split("\n")
        .join("\n* ");

      return `/**
* ${jsDoc}
*/
${fn.fnName}: typeof ${fn.fnName}`;
    })
    .filter(Boolean)
    .join(",\n  ");

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!

export type NetlifyGraphFunctionOptions = {
  /**
   * The accessToken to use for the request
   */
  accessToken?: string;
  /**
   * The siteId to use for the request
   * @default process.env.SITE_ID
   */
  siteId?: string;
}

export type WebhookEvent = {
  body: string;
  headers: Record<string, string | null | undefined>;
};

export type GraphQLError = {
  "path": Array<string | number>,
  "message": string,
  "extensions": Record<string, unknown>
};

${fragmentDecls.join("\n\n")}

${functionDecls.join("\n\n")}

export interface Functions {
  ${
    exportedFunctionsObjectProperties === ""
      ? "Record<string, never>"
      : exportedFunctionsObjectProperties
  }
}

export const functions: Functions;

export default functions;
`;

  return source;
};

export const generateFunctionsSource = async (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  operationsDoc: string,
  queries: Record<string, ExtractedFunction>,
  fragments: Record<string, ExtractedFragment>
) => {
  const fragmentDefinitions: Record<string, ParsedFragment> = Object.entries(
    fragments
  ).reduce((acc, [fragmentName, fragment]) => {
    const parsed = fragmentToParsedFragmentDefinition(schema, fragment);
    if (parsed) {
      return { ...acc, [fragmentName]: parsed };
    } else {
      return acc;
    }
  }, {});

  const parsedDoc = parse(operationsDoc, { noLocation: true });

  const functionDefinitions: ParsedFunction[] = Object.values(queries)
    .map((query) =>
      queryToFunctionDefinition(schema, parsedDoc, query, fragmentDefinitions)
    )
    .filter(Boolean) as ParsedFunction[];

  const clientSource = generateJavaScriptClient(
    netlifyGraphConfig,
    schema,
    operationsDoc,
    functionDefinitions
  );

  const typeDefinitionsSource = generateTypeScriptDefinitions(
    netlifyGraphConfig,
    schema,
    functionDefinitions,
    fragmentDefinitions
  );

  return {
    clientSource,
    typeDefinitionsSource,
    functionDefinitions,
  };
};

export const generatePersistedFunctionsSource = async (
  netlifyGraphConfig: NetlifyGraphConfig,
  netlifyToken: string,
  siteId: string,
  schema: GraphQLSchema,
  operationsDoc: string,
  queries: Record<string, PersistedFunction>,
  fragments: Record<string, ExtractedFragment>,
  schemaId: string
) => {
  const fragmentDefinitions: Record<string, ParsedFragment> = Object.entries(
    fragments
  ).reduce((acc, [fragmentName, fragment]) => {
    const parsed = fragmentToParsedFragmentDefinition(schema, fragment);
    if (parsed) {
      return { ...acc, [fragmentName]: parsed };
    } else {
      return acc;
    }
  }, {});

  const parsedDoc = parse(operationsDoc, { noLocation: true });

  const functionDefinitions: ParsedFunction[] = Object.values(queries)
    .map((query) =>
      queryToFunctionDefinition(schema, parsedDoc, query, fragmentDefinitions)
    )
    .filter(Boolean) as ParsedFunction[];

  let persistedFunctionDefinitions: PersistedFunction[] = [];
  const failedPersistedFunctions: {
    attemptedFunction: ParsedFunction;
    data: any;
    errors: any;
  }[] = [];

  for (const fn of functionDefinitions) {
    if (fn.executionStrategy === "DYNAMIC") {
      console.log("Skipping dynamic operation", fn.operationName);
      // @ts-ignore
      persistedFunctionDefinitions.push({
        ...fn,
      });
      continue;
    }

    console.log("Persisting: ", fn.operationName, fn.cacheStrategy);

    const result = await executeCreatePersistedQueryMutation(
      {
        nfToken: netlifyToken,
        appId: siteId,
        description: fn.description,
        query: fn.persistableOperationString,
        tags: ["dev"],
        allowedOperationNames: [fn.operationName],
        freeVariables: fn.variableNames,
        fallbackOnError: fn.fallbackOnError,
        cacheStrategy: fn.cacheStrategy,
      },
      {
        siteId: siteId,
        accessToken: netlifyToken,
      }
    );

    const persistedFn =
      result.data?.oneGraph?.createPersistedQuery?.persistedQuery;

    if (persistedFn?.id) {
      persistedFunctionDefinitions.push({
        ...fn,
        persistedDocId: persistedFn.id,
      });
    } else if (result.errors) {
      failedPersistedFunctions.push({
        ...result,
        attemptedFunction: fn,
      });
      console.warn(
        "Failed to persist function",
        fn.operationName,
        result.errors
      );
    }
  }

  const clientSource = generateProductionJavaScriptClient(
    netlifyGraphConfig,
    schema,
    operationsDoc,
    persistedFunctionDefinitions,
    schemaId
  );

  const typeDefinitionsSource = generateTypeScriptDefinitions(
    netlifyGraphConfig,
    schema,
    functionDefinitions,
    fragmentDefinitions
  );

  return {
    clientSource,
    typeDefinitionsSource,
    functionDefinitions,
    failedPersistedFunctions,
  };
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
      next.name?.value;
      const operation: ExtractedFragment = {
        id: netlifyDirective.id,
        fragmentName: key,
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

      const persistableOperationString = extractPersistableOperationString(
        parsedDoc,
        next
      );

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

const frameworkGeneratorMap: Record<string, FrameworkGenerator> = {
  "Next.js": nextjsFunctionSnippet.generate,
  Remix: remixFunctionSnippet.generate,
  default: genericNetlifyFunctionSnippet.generate,
};

const defaultGenerator = genericNetlifyFunctionSnippet.generate;

/**
 * Given a schema, GraphQL operations doc, a target operationId, and a Netlify Graph config, generates a set of handlers (and potentially components) for the correct framework.
 */
export const generateHandlerSource = ({
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  schema,
}: {
  handlerOptions: Record<string, boolean>;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationId: string;
  operationsDoc: string;
  schema: GraphQLSchema;
}):
  | {
      exportedFiles: ExportedFile[];
      operation: OperationDefinitionNode;
    }
  | undefined => {
  console.log("Generating handler source for operation", operationId);
  const parsedDoc = parse(operationsDoc, { noLocation: true });
  const operations = extractFunctionsFromOperationDoc(parsedDoc);
  const functions = operations.functions;
  const fn = functions[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql, found: ${Object.keys(
        functions
      ).join(", ")}}`
    );
    return;
  }

  const odl = computeOperationDataList({
    query: fn.operationString,
    variables: [],
  });

  const generate =
    frameworkGeneratorMap[netlifyGraphConfig.framework] || defaultGenerator;

  const { exportedFiles } = generate({
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
export const generateCustomHandlerSource = ({
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  schema,
  generate,
}: {
  handlerOptions: Record<string, boolean>;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationId: string;
  operationsDoc: string;
  schema: GraphQLSchema;
  generate: FrameworkGenerator;
}):
  | {
      exportedFiles: ExportedFile[];
      operation: OperationDefinitionNode;
    }
  | undefined => {
  const parsedDoc = parse(operationsDoc, { noLocation: true });
  const operations = extractFunctionsFromOperationDoc(parsedDoc);
  const fn = operations.functions[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql among:
 [${Object.keys(operations).join(",\n ")}]`
    );
    return;
  }

  const odl = computeOperationDataList({
    query: fn.operationString,
    variables: [],
  });

  const { exportedFiles } = generate({
    netlifyGraphConfig,
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  });

  return { exportedFiles, operation: fn.parsedOperation };
};
