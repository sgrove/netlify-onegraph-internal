import { v4 as uuidv4 } from "uuid";

import {
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

export type NetlifyGraphConfig = {
  functionsPath: string[];
  webhookBasePath: string;
  netlifyGraphImplementationFilename: string[];
  netlifyGraphTypeDefinitionsFilename: string[];
  graphQLOperationsSourceFilename: string[];
  graphQLSchemaFilename: string[];
  netlifyGraphRequirePath: string[];
  netlifyGraphPath: string[];
  framework: string;
  extension: string;
  moduleType: "commonjs" | "esm";
  language: "javascript" | "typescript";
  runtimeTargetEnv: "node" | "browser";
};

export type ExtractedFunction = {
  id: string;
  operationName: string;
  description: string;
  kind: OperationTypeNode;
  parsedOperation: OperationDefinitionNode;
  operationString: string;
  operationStringWithoutNetlifyDirective: string;
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
};

export type ParsedFragment = ExtractedFragment & {
  safeBody: string;
  returnSignature: string;
};

export const defaultSourceOperationsFilename =
  "netlifyGraphOperationsLibrary.graphql";
export const defaultGraphQLSchemaFilename = "netlifyGraphSchema.graphql";

export const defaultNetlifyGraphConfig: NetlifyGraphConfig = {
  extension: "js",
  functionsPath: ["netlify", "functions"],
  netlifyGraphPath: ["netlify", "functions", "netlifyGraph"],
  webhookBasePath: "/.netlify/functions",
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

const generatedOneGraphClient = (netlifyGraphConfig: NetlifyGraphConfig) =>
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
   
      const reqOptions = {
        method: 'POST',
        headers: headers,
        timeout: 30000,
      }
      
  const url = 'https://serve.onegraph.com/graphql?app_id=' + siteId

  const respBody = []

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
        return reject(
          new Error(
            "Netlify OneGraph return non - OK HTTP status code" + res.statusCode,
          ),
        )
      }

      res.on('data', (chunk) => respBody.push(chunk))

      res.on('end', () => {
        const resString = Buffer.concat(respBody).toString()
        resolve(resString)
      })
    })

    req.on('error', (e) => {
      console.error('Error making request to Netlify OneGraph: ', e)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request to Netlify OneGraph timed out'))
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
  const reqBody = options.body || null
  const userHeaders = options.headers || {}
  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
  }

  const  reqOptions = {
    method: 'POST',
    headers: headers,
    timeout: 30000,
    body: reqBody
  }

  const url = 'https://serve.onegraph.com/graphql?app_id=' + siteId

  return fetch(url, reqOptions).then(response => response.text());
}`
)}

const fetchOneGraph = async function fetchOneGraph(input) {
  const accessToken = input.accessToken 
  const query = input.query
  const operationName = input.operationName
  const variables = input.variables
  const options = input.options || {}

  const siteId = options.siteId || process.env.SITE_ID

  const payload = {
    query: query,
    variables: variables,
    operationName: operationName,
  }

  const result = await httpFetch(
    siteId,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? "Bearer " + accessToken : '',
      },
      body: JSON.stringify(payload),
    },
  )

  return JSON.parse(result)
}
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
  netlifyGraphWebhookId: string,
  variables: ${
    variableSignature === "{}" ? "Record<string, never>" : variableSignature
  },
  accessToken?: string | null | undefined
  ) : void

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

  return `const ${subscriptionFunctionName(fn)} = async (
  /**
   * This will be available in your webhook handler as a query parameter.
   * Use this to keep track of which subscription you're receiving
   * events for.
   */
  netlifyGraphWebhookId,
  variables,
  rawOptions
  ) => {
    const options = rawOptions || {}
    const netlifyGraphWebhookUrl = \`\${process.env.DEPLOY_URL}${
      netlifyGraphConfig.webhookBasePath
    }/${filename}?netlifyGraphWebhookId=\${netlifyGraphWebhookId}\`
    const secret = options.secret || process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
    const fullVariables = {...variables, netlifyGraphWebhookUrl: netlifyGraphWebhookUrl, netlifyGraphWebhookSecret: { hmacSha256Key: secret }}

    const subscriptionOperationDoc = \`${safeBody}\`;

    const result = await fetchOneGraph({
      query: subscriptionOperationDoc,
      operationName: "${fn.operationName}",
      variables: fullVariables,
      options: Object.assign({accessToken: accessToken}, options || {}),
  })
}

const ${subscriptionParserName(fn)} = (event) => {
  if (!verifyRequestSignature({ event: event })) {
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

  const parsed = parse(body);
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
      (directive) => directive.name.value !== "netlify"
    ),
  };

  const fn: ParsedFunction = {
    ...basicFn,
    fnName: makeFunctionName(operation.operation, operationName),
    safeBody,
    kind: operation.operation,
    variableSignature,
    returnSignature,
    operationName,
    parsedOperation: operation,
    operationStringWithoutNetlifyDirective: print(
      operationWithoutNetlifyDirective
    ),
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

  const parsed = parse(body);
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
      (directive) => directive.name.value !== "netlify"
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
      return fetchOneGraph({
        query: \`${fn.safeBody}\`,
        variables: variables,
        options: options || {},
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
      return fetchOneGraph({
        query: operationsDoc,
        operationName: "${fn.operationName}",
        variables: variables,
        options: options || {},
      });
    }
`
    )}`;
    return fn.id ? staticFunction : dynamicFunction;
  });

  const exportedFunctionsObjectProperties = enabledFunctions
    .sort((a, b) => {
      return a.fnName.localeCompare(b.fnName);
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
${imp(netlifyGraphConfig, ["node"], "https", "https")}
${imp(netlifyGraphConfig, ["node"], "crypto", "crypto")}

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
    const [k, v] = pair.split('=')
    sig[k] = v
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

const operationsDoc = \`${safeOperationsDoc}\`

${generatedOneGraphClient(netlifyGraphConfig)}

${exp(
  netlifyGraphConfig,
  ["node"],
  "verifyRequestSignature",
  `(request) => {
  const event = request.event
  const secret = process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
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
  variables: ${
    shouldExportInputSignature ? inputSignatureName : "Record<string, never>"
  },
  options?: NetlifyGraphFunctionOptions
): Promise<${returnSignatureName}>;`;
  });

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!

export type NetlifyGraphFunctionOptions = {
  accessToken?: string;
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
`;

  return source;
};

export const generateFunctionsSource = (
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

  const functionDefinitions: ParsedFunction[] = Object.values(queries)
    .map((query) =>
      queryToFunctionDefinition(schema, query, fragmentDefinitions)
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

const pluckDirectiveArgValue = (directive, argName) => {
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

    const directive = next.directives?.find(
      (localDirective) => localDirective.name.value === "netlify"
    );

    if (!directive) {
      return null;
    }

    const docString = pluckDirectiveArgValue(directive, "doc") || "";
    let id = pluckDirectiveArgValue(directive, "id");

    if (!id) {
      id = uuidv4();
    }

    const nextWithoutNetlifyDirective = {
      ...next,
      directives: (next.directives || []).filter(
        (directive) => directive.name.value !== "netlify"
      ),
    };

    if (next.kind === Kind.FRAGMENT_DEFINITION) {
      next.name?.value;
      const operation: ExtractedFragment = {
        id,
        fragmentName: key,
        description: docString,
        parsedOperation: next,
        kind: "fragment",
        operationString: print(next),
        operationStringWithoutNetlifyDirective: print(
          nextWithoutNetlifyDirective
        ),
      };

      fragments[id] = operation;
    } else if (next.kind === Kind.OPERATION_DEFINITION) {
      const fnName = makeFunctionName(next.operation, key);

      const operation: ExtractedFunction = {
        id,
        operationName: key,
        description: docString,
        parsedOperation: next,
        kind: next.operation,
        operationString: print(next),
        operationStringWithoutNetlifyDirective: print(
          nextWithoutNetlifyDirective
        ),
      };

      functions[id] = operation;
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
  const parsedDoc = parse(operationsDoc);
  const operations = extractFunctionsFromOperationDoc(parsedDoc);
  const fn = operations.functions[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql, found: ${Object.keys(
        operations
      ).join(", ")}}`,
      Object.keys(operations)
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
  const parsedDoc = parse(operationsDoc);
  const operations = extractFunctionsFromOperationDoc(parsedDoc);
  const fn = operations.functions[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql, bummer!`,
      Object.keys(operations)
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
