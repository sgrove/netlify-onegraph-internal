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
import { executeCreatePersistedQueryMutation } from "./oneGraphClient";
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

const lruCacheImplementation = `// Basic LRU cache implementation
// Basic LRU cache implementation
const makeLRUCache = (max) => {
  return { max: max, cache: new Map() };
};

const oldestCacheKey = (lru) => {
  return lru.keys().next().value
}

// Depend on Map keeping track of insertion order
const getFromCache = (lru, key) => {
  const item = lru.cache.get(key);
  if (item) {
    // Delete key and re-insert so key is now at the end,
    // and now the last to be gc'd.
    lru.cache.delete(key);
    lru.cache.set(key, item);
  }
  return item;
};

const setInCache = (lru, key, value) => {
  if (lru.cache.has(key)) {
    lru.cache.delete(key);
  }
  if (lru.cache.size == lru.max) {
    const cacheKey = oldestCacheKey(lru);

    if (cacheKey) {
      lru.cache.delete(cacheKey);
    }
  }

  lru.cache.set(key, value);
};

// Cache the results of the Netlify Graph API for conditional requests
const cache = makeLRUCache(100);

const calculateCacheKey = (payload) => {
  return JSON.stringify(payload);
};`;

const generatedNetlifyGraphDynamicClient = (
  netlifyGraphConfig: NetlifyGraphConfig
) =>
  `${lruCacheImplementation}

${out(
  netlifyGraphConfig,
  ["node"],
  `const httpFetch = (siteId, options) => {
  const reqBody = options.body || null;
  const userHeaders = options.headers || {};
  const headers = {
    ...userHeaders,
    "Content-Type": "application/json",
    "Content-Length": reqBody.length,
  };

  const timeoutMs = 30_000;

  const reqOptions = {
    method: "POST",
    headers: headers,
    timeout: timeoutMs,
  };

  const url = "https://graph.netlify.com/graphql?app_id=" + siteId;

  const respBody = [];

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299) && res.statusCode !== 304) {
        return reject(
          new Error(
            "Netlify Graph return non-OK HTTP status code" + res.statusCode
          )
        );
      }

      res.on("data", (chunk) => respBody.push(chunk));

      res.on("end", () => {
        const resString = buffer.Buffer.concat(respBody).toString();
        resolve({
          status: res.statusCode,
          body: resString,
          headers: res.headers,
        });
      });
    });

    req.on("error", (error) => {
      console.error("Error making request to Netlify Graph:", error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request to Netlify Graph timed out"));
    });

    req.write(reqBody);
    req.end();
  });
};
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
    body: reqBody,
  };

  const url = 'https://graph.netlify.com/graphql?app_id=' + siteId;

  return fetch(url, reqOptions).then((body) => {
    return body.text().then((bodyString) => {
      const headers = {};
      body.headers.forEach((k, v) => (headers[k] = v));

      return {
        body: bodyString,
        headers: headers,
        status: body.status,
      };
    });
  });
};`
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

  let cachedOrLiveValue = new Promise((resolve) => {
    const cacheKey = calculateCacheKey(payload);

    // Check the cache for a previous result
    const cachedResultPair = getFromCache(cache, cacheKey);

    let conditionalHeaders = {
      "If-None-Match": "",
    };
    let cachedResultValue;

    if (cachedResultPair) {
      const [etag, previousResult] = cachedResultPair;
      conditionalHeaders = {
        "If-None-Match": etag,
      };
      cachedResultValue = previousResult;
    }

    const response = httpFetch(siteId, {
      method: "POST",
      headers: {
        ...conditionalHeaders,
        Authorization: accessToken ? "Bearer " + accessToken : "",
      },
      body: JSON.stringify(payload),
    });

    response.then((result) => {
      // Check response headers for a 304 Not Modified
      if (result.status === 304) {
        // Return the cached result
        resolve(cachedResultValue);
      } else if (result.status === 200) {
        // Update the cache with the new etag and result
        const etag = result.headers["etag"];
        const resultJson = JSON.parse(result.body)
          if (etag) {
            // Make a note of the new etag for the given payload
            setInCache(cache, cacheKey, [etag, resultJson]);
          }
          resolve(resultJson);
      } else {
        return result.json().then((json) => {
          resolve(json);
        });
      }
    });
  });

  return cachedOrLiveValue;
};
`;

const generatedNetlifyGraphPersistedClient = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schemaId: string
) =>
  `${lruCacheImplementation}

${out(
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

  const encodedVariables = encodeURIComponent(input.variables || "null");
  const url = 'https://graph.netlify.com/graphql?app_id=' + input.siteId + '&doc_id=' + input.docId + (input.operationName ? ('&operationName=' + input.operationName) : '') + (schemaId ? ('&schemaId=' + schemaId) : '') + '&variables=' + encodedVariables;

  const respBody = []

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299) && res.statusCode !== 304) {
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


  const url = 'https://graph.netlify.com/graphql?app_id=' + input.siteId +
              (schemaId ? ('&schemaId=' + schemaId) : '');
  const respBody = []

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299) && res.statusCode !== 304) {
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

  const url =
    'https://graph.netlify.com/graphql?app_id=' +
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

  const url = 'https://graph.netlify.com/graphql?app_id=' + input.siteId +
              (schemaId ? ('&schemaId=' + schemaId) : '');

  return fetch(url, reqOptions);
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

  let response;

  if (input.fetchStrategy === 'GET') {
    response = httpMethod({
      siteId: siteId,
      docId: docId,
      query: input.query,
      headers: {
        Authorization: accessToken ? 'Bearer ' + accessToken : '',
      },
      variables: variables,
      operationName: operationName,
    }).then((result) => JSON.parse(result));
  } else {
    const payload = {
      query: input.query,
      doc_id: docId,
      variables: variables,
      operationName: operationName,
    };

    let cachedOrLiveValue = new Promise((resolve) => {
      const cacheKey = calculateCacheKey(payload);

      // Check the cache for a previous result
      const cachedResultPair = getFromCache(cache, cacheKey);

      let conditionalHeaders = {
        'If-None-Match': ''
      };
      let cachedResultValue;

      if (cachedResultPair) {
        const [etag, previousResult] = cachedResultPair;
        conditionalHeaders = {
          'If-None-Match': etag
        };
        cachedResultValue = previousResult;
      }

      const persistedResponse = httpMethod({
        siteId: siteId,
        docId: docId,
        query: input.query,
        headers: {
          ...conditionalHeaders,
          Authorization: accessToken ? 'Bearer ' + accessToken : '',
        },
        variables: variables,
        operationName: operationName,
      });

      persistedResponse.then((result) => {
        // Check response headers for a 304 Not Modified
        if (result.status === 304) {
          // Return the cached result
          resolve(cachedResultValue);
        }
        else if (result.status === 200) {
          // Update the cache with the new etag and result
          const etag = result.headers.get('etag');
          const resultJson = result.json();
          resultJson.then((json) => {
            if (etag) {
              // Make a note of the new etag for the given payload
              setInCache(cache, cacheKey, [etag, json])
            };
            resolve(json);
          });
        } else {
          return result.json().then((json) => {
            resolve(json);
          });
        }
      });
    });

    response = cachedOrLiveValue;
  }

  return response;
};
`;

const subscriptionParserReturnName = (fn: ParsedFunction) =>
  `${fn.operationName}Event`;

const subscriptionParserName = (fn: ParsedFunction) =>
  `parseAndVerify${fn.operationName}Event`;

const subscriptionFunctionName = (fn: ParsedFunction) =>
  `subscribeTo${fn.operationName}`;

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

const export_ = (
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

const import_ = (
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

export const queryToFunctionDefinition = (
  GraphQL: typeof GraphQLPackage,
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

  const fragments: Record<string, FragmentDefinitionNode> = Object.values(
    enabledFragments
  ).reduce(
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
    GraphQL,
    fullSchema,
    operation,
    fragments
  );

  const variableNames = (operation.variableDefinitions || []).map(
    (varDef) => varDef.variable.name.value
  );

  const variableSignature = typeScriptSignatureForOperationVariables(
    GraphQL,
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

  const persistableOperationFacts = extractPersistableOperationString(
    GraphQL,
    parsedDoc,
    operation
  ) || { persistableOperationString: print(operation) };

  const persistableOperationString =
    persistableOperationFacts.persistableOperationString;

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
  GraphQL: typeof GraphQLPackage,
  currentFragments: Record<string, FragmentDefinitionNode>,
  fullSchema: GraphQLSchema,
  extractedFragment: ExtractedFragment
): {
  fragmentDefinitions: Record<string, FragmentDefinitionNode[]>;
  fragment?: ParsedFragment | undefined;
} => {
  const basicFn = {
    id: extractedFragment.id,
    operationString: extractedFragment.operationString,
    description: extractedFragment.description || "",
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
    internalConsole.error(`Fragment definition is required in ${basicFn.id}`);
    return { fragmentDefinitions: fragments };
  }

  const [operation] = fragmentDefinitions;

  if (operation.kind !== Kind.FRAGMENT_DEFINITION) {
    internalConsole.error(`Definition is not an fragment in ${basicFn.id}`);
    return { fragmentDefinitions: fragments };
  }

  const returnSignature = typeScriptSignatureForFragment(
    GraphQL,
    fullSchema,
    operation,
    { ...currentFragments, ...fragments }
  );

  const variableNames = (operation.variableDefinitions || []).map(
    (varDef) => varDef.variable.name.value
  );

  const variableSignature = typeScriptSignatureForOperationVariables(
    GraphQL,
    variableNames,
    fullSchema,
    // @ts-ignore TODO: FIX THIS!
    operation
  );

  const fragmentName = operation.name && operation.name.value;

  if (!fragmentName) {
    internalConsole.error(
      `Operation name is required in ${
        basicFn.operationString
      }\n\tfound: ${JSON.stringify(operation.name)}`
    );
    return { fragmentDefinitions: fragments };
  }

  const operationWithoutNetlifyDirective = {
    ...operation,
    directives: (operation.directives || []).filter(
      (directive) => directive.name.value !== NETLIFY_DIRECTIVE_NAME
    ),
  };

  const typeCondition = operation.typeCondition.name.value;

  const fn: ParsedFragment = {
    ...basicFn,
    safeBody,
    kind: "fragment",
    returnSignature,
    fragmentName: fragmentName,
    typeCondition,
    parsedOperation: operation,
    operationStringWithoutNetlifyDirective: print(
      operationWithoutNetlifyDirective
    ),
  };

  return { fragmentDefinitions: fragments, fragment: fn };
};

export const generateJavaScriptClient = ({
  GraphQL,
  netlifyGraphConfig,
  schema,
  operationsDoc,
  enabledFunctions,
}: {
  GraphQL: typeof GraphQLPackage;
  netlifyGraphConfig: NetlifyGraphConfig;
  schema: GraphQLSchema;
  operationsDoc: string;
  enabledFunctions: ParsedFunction[];
}) => {
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
  const functionDecls = enabledFunctions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      if (fn.kind === "subscription") {
        const fragments = [];
        return generateSubscriptionFunction(
          GraphQL,
          schema,
          fn,
          fragments,
          netlifyGraphConfig
        );
      }

      const dynamicFunction = `${export_(
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

      const staticFunction = `${export_(
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

  const dummyHandler = export_(
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

  const source = `/* eslint-disable */
// @ts-nocheck
// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
${import_(netlifyGraphConfig, ["node"], "buffer", "buffer")}
${import_(netlifyGraphConfig, ["node"], "crypto", "crypto")}
${import_(netlifyGraphConfig, ["node"], "https", "https")}
${import_(netlifyGraphConfig, ["node"], "process", "process")}

${export_(
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

${export_(
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
  GraphQL: typeof GraphQLPackage,
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  operationsDoc: string,
  enabledFunctions: PersistedFunction[],
  schemaId: string
) => {
  const functionDecls = enabledFunctions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      if (fn.kind === "subscription") {
        const fragments = [];
        return generateSubscriptionFunction(
          GraphQL,
          schema,
          fn,
          fragments,
          netlifyGraphConfig
        );
      }

      const dynamicFunction = `${export_(
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

      const staticFunction = `${export_(
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

  const dummyHandler = export_(
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

  const source = `/* eslint-disable */
// @ts-nocheck
// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
  ${import_(netlifyGraphConfig, ["node"], "buffer", "buffer")}
  ${import_(netlifyGraphConfig, ["node"], "crypto", "crypto")}
  ${import_(netlifyGraphConfig, ["node"], "https", "https")}
  ${import_(netlifyGraphConfig, ["node"], "process", "process")}

${export_(
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

${export_(
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
  GraphQL: typeof GraphQLPackage,
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  enabledFunctions: ParsedFunction[],
  enabledFragments: Record<string, ParsedFragment>
) => {
  const fragmentDecls = Object.values(enabledFragments)
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fragment) => {
      return generateFragmentTypeScriptDefinition(
        netlifyGraphConfig,
        schema,
        fragment
      );
    });

  const functionDecls = enabledFunctions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      const isSubscription = fn.kind === "subscription";

      if (isSubscription) {
        return generateSubscriptionFunctionTypeDefinition(
          GraphQL,
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
        shouldExportInputSignature
          ? inputSignatureName
          : "Record<string, never>"
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

  const source = `/* eslint-disable */
// @ts-nocheck
// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!

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
  "path": Array<string | number>;
  "message": string;
  "extensions": Record<string, unknown>;
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
  GraphQL: typeof GraphQLPackage,
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  operationsDoc: string,
  queries: Record<string, ExtractedFunction>,
  fragments: Record<string, ExtractedFragment>
) => {
  const {
    fragmentDefinitions,
  }: { fragmentDefinitions: Record<string, ParsedFragment> } = Object.entries(
    fragments
  ).reduce(
    ({ fragmentDefinitions, fragmentNodes }, [fragmentName, fragment]) => {
      const parsed = fragmentToParsedFragmentDefinition(
        GraphQL,
        fragmentNodes,
        schema,
        fragment
      );
      return {
        fragmentDefinitions: {
          ...fragmentDefinitions,
          [fragmentName]: parsed.fragment,
        },
        fragmentNodes: { ...fragmentNodes, ...parsed.fragmentDefinitions },
      };
    },
    { fragmentNodes: {}, fragmentDefinitions: {} }
  );

  const parsedDoc = parse(operationsDoc, { noLocation: true });

  const functionDefinitions: ParsedFunction[] = Object.values(queries)
    .map((query) =>
      queryToFunctionDefinition(
        GraphQL,
        schema,
        parsedDoc,
        query,
        fragmentDefinitions
      )
    )
    .filter(Boolean)
    .sort((a: ParsedFunction, b: ParsedFunction) => {
      return a.id.localeCompare(b.id);
    }) as ParsedFunction[];

  const clientSource = generateJavaScriptClient({
    GraphQL,
    netlifyGraphConfig,
    schema,
    enabledFunctions: functionDefinitions,
    operationsDoc: operationsDoc,
  });

  const typeDefinitionsSource = generateTypeScriptDefinitions(
    GraphQL,
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

export const generateRuntime = async ({
  GraphQL,
  fragments,
  generate,
  netlifyGraphConfig,
  operationsDoc,
  operations,
  schema,
  schemaId,
}: {
  GraphQL: typeof GraphQLPackage;
  netlifyGraphConfig: NetlifyGraphConfig;
  schema: GraphQLSchema;
  operationsDoc: string;
  operations: Record<string, ExtractedFunction>;
  fragments: Record<string, ExtractedFragment>;
  generate: CodegenHelpers.GenerateRuntimeFunction;
  schemaId: string;
}) => {
  const allFragmentNodes = Object.fromEntries(
    Object.entries(fragments).map(([key, value]) => [
      value.fragmentName,
      value.parsedOperation,
    ])
  );

  const fragmentResults: {
    fragmentDefinitions: Record<string, ParsedFragment>;
  } = Object.entries(fragments).reduce(
    ({ fragmentDefinitions }, [fragmentName, fragment]) => {
      const parsed = fragmentToParsedFragmentDefinition(
        GraphQL,
        allFragmentNodes,
        schema,
        fragment
      );
      return {
        fragmentDefinitions: {
          ...fragmentDefinitions,
          [fragmentName]: parsed.fragment,
        },
      };
    },
    { fragmentDefinitions: {} }
  );

  const { fragmentDefinitions } = fragmentResults;

  const parsedDoc = parse(operationsDoc, { noLocation: true });

  const odl = computeOperationDataList({
    query: operationsDoc,
    variables: [],
  });

  const functionDefinitions: ParsedFunction[] = Object.values(operations)
    .map((query) =>
      queryToFunctionDefinition(
        GraphQL,
        schema,
        parsedDoc,
        query,
        fragmentDefinitions
      )
    )
    .filter(Boolean)
    .sort((a: ParsedFunction, b: ParsedFunction) => {
      return a.id.localeCompare(b.id);
    }) as ParsedFunction[];

  const runtime = generate({
    GraphQL,
    netlifyGraphConfig,
    schema,
    functionDefinitions,
    fragments: Object.values(fragmentDefinitions),
    operationDataList: odl.operationDataList,
    schemaId: schemaId,
    options: {},
  });

  return runtime;
};

export const generatePersistedFunctionsSource = async (
  GraphQL: typeof GraphQLPackage,
  netlifyGraphConfig: NetlifyGraphConfig,
  netlifyJwt: string,
  siteId: string,
  schema: GraphQLSchema,
  operationsDoc: string,
  queries: Record<string, PersistedFunction>,
  fragments: Record<string, ExtractedFragment>,
  schemaId: string
) => {
  const {
    fragmentDefinitions,
  }: { fragmentDefinitions: Record<string, ParsedFragment> } = Object.entries(
    fragments
  ).reduce(
    ({ fragmentDefinitions, fragmentNodes }, [fragmentName, fragment]) => {
      const parsed = fragmentToParsedFragmentDefinition(
        GraphQL,
        fragmentNodes,
        schema,
        fragment
      );
      return {
        fragmentDefinitions: {
          ...fragmentDefinitions,
          [fragmentName]: parsed.fragment,
        },
        fragmentNodes: { ...fragmentNodes, ...parsed.fragmentDefinitions },
      };
    },
    { fragmentNodes: {}, fragmentDefinitions: {} }
  );

  const parsedDoc = parse(operationsDoc, { noLocation: true });

  const functionDefinitions: ParsedFunction[] = Object.values(queries)
    .map((query) =>
      queryToFunctionDefinition(
        GraphQL,
        schema,
        parsedDoc,
        query,
        fragmentDefinitions
      )
    )
    .filter(Boolean) as ParsedFunction[];

  let persistedFunctionDefinitions: PersistedFunction[] = [];
  const failedPersistedFunctions: {
    attemptedFunction: ParsedFunction;
    data: any;
    errors?: any;
  }[] = [];

  for (const fn of functionDefinitions) {
    if (fn.executionStrategy === "DYNAMIC") {
      internalConsole.log("Skipping dynamic operation", fn.operationName);
      // @ts-ignore
      persistedFunctionDefinitions.push({
        ...fn,
      });
      continue;
    }

    internalConsole.log("Persisting: ", fn.operationName);

    const result = await executeCreatePersistedQueryMutation(
      {
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
        accessToken: netlifyJwt,
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
      internalConsole.warn(
        "Failed to persist function",
        fn.operationName,
        result.errors
      );
    }
  }

  const clientSource = generateProductionJavaScriptClient(
    GraphQL,
    netlifyGraphConfig,
    schema,
    operationsDoc,
    persistedFunctionDefinitions,
    schemaId
  );

  const typeDefinitionsSource = generateTypeScriptDefinitions(
    GraphQL,
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
 * Given a schema, GraphQL operations doc, a target operationId, and a Netlify Graph config, generates a set of handlers (and potentially components) for the correct framework.
 */
export const generateHandlerSource = ({
  GraphQL,
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  schema,
}: {
  GraphQL: typeof GraphQLPackage;
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
  const parsedDoc = parse(operationsDoc, { noLocation: true });
  const operations = extractFunctionsFromOperationDoc(GraphQL, parsedDoc);
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
export const generateCustomHandlerSource = ({
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
}):
  | {
      exportedFiles: ExportedFile[];
      operation: OperationDefinitionNode;
    }
  | undefined => {
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
    query: fn.operationString,
    variables: [],
  });

  const { exportedFiles } = generate({
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
    query: fn.operationString,
    variables: [],
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
