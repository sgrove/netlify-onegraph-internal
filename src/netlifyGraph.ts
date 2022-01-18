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
  typeScriptSignatureForOperation,
  typeScriptSignatureForOperationVariables,
} from "./graphqlHelpers";

import {
  computeOperationDataList,
  netlifyFunctionSnippet as genericNetlifyFunctionSnippet,
} from "./codegen/genericExporter";

import { nextjsFunctionSnippet } from "./codegen/nextjsExporter";
import { PersistedQuery } from "./oneGraphClient";

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
  netlifyGraphImplementationFilename: string[];
  netlifyGraphTypeDefinitionsFilename: string[];
  graphQLOperationsSourceFilename: string[];
  graphQLSchemaFilename: string[];
  netlifyGraphRequirePath: string[];
  netlifyGraphPath: string[];
  framework: string;
  extension: string;
  moduleType: "commonjs" | "esm";
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

export type ParsedFunction = ExtractedFunction & {
  id: string;
  operationString: string;
  description: string;
  fnName: string;
  safeBody: string;
  kind: OperationTypeNode;
  variableSignature: string;
  returnSignature: string;
  operationName: string;
  parsedOperation: OperationDefinitionNode;
};

export const defaultSourceOperationsFilename =
  "netlifyGraphOperationsLibrary.graphql";
export const defaultGraphQLSchemaFilename = "netlifyGraphSchema.graphql";

export const defaultNetlifyGraphConfig: NetlifyGraphConfig = {
  extension: "js",
  functionsPath: ["netlify", "functions"],
  netlifyGraphPath: ["netlify", "functions", "netlifyGraph"],
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
};

export const defaultExampleOperationsDoc = `query ExampleQuery @netlifyGraph(doc: "An example query to start with.") {
  __typename
}`;

const generatedOneGraphClient = () =>
  `
const fetch = (appId, options) => {
  var reqBody = options.body || null
  const userHeaders = options.headers || {}
  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
    'Content-Length': reqBody.length,
  }

  var reqOptions = {
    method: 'POST',
    headers: headers,
    timeout: 30000,
  }

  const url = 'https://serve.onegraph.com/graphql?app_id=' + appId

  const respBody = []

  return new Promise((resolve, reject) => {
    var req = https.request(url, reqOptions, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
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

const fetchOneGraphPersisted = async function fetchOneGraphPersisted(
  accessToken,
  docId,
  operationName,
  variables,
) {
  const payload = {
    doc_id: docId,
    variables: variables,
    operationName: operationName,
  }

  const result = await fetch(
    process.env.SITE_ID,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? "Bearer " + accessToken : '',
      },
      body: JSON.stringify(payload),
    },
  )

  // @ts-ignore
  return JSON.parse(result)
}

const fetchOneGraph = async function fetchOneGraph(
  accessToken,
  query,
  operationName,
  variables,
) {
  const payload = {
    query: query,
    variables: variables,
    operationName: operationName,
  }

  const result = await fetch(
    process.env.SITE_ID,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? "Bearer " + accessToken : '',
      },
      body: JSON.stringify(payload),
    },
  )

  // @ts-ignore
  return JSON.parse(result)
}
`;

const subscriptionParserName = (fn) => `parseAndVerify${fn.operationName}Event`;

const subscriptionFunctionName = (fn) => `subscribeTo${fn.operationName}`;

const exp = (netlifyGraphConfig, name) => {
  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `exports.${name}`;
  }

  return `export const ${name}`;
};

const imp = (netlifyGraphConfig, name, packageName) => {
  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `const ${name} = require("${packageName}")`;
  }

  return `import ${name} from "${packageName}"`;
};

export const generateSubscriptionFunctionTypeDefinition = (
  schema: GraphQLSchema,
  fn: ParsedFunction,
  fragments: FragmentDefinitionNode[]
) => {
  const parsingFunctionReturnSignature = typeScriptSignatureForOperation(
    schema,
    fn.parsedOperation,
    fragments
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
  variables: ${variableSignature},
  accessToken?: string | null
  ) : void

/**
 * Verify the ${
   fn.operationName
 } event body is signed securely, and then parse the result.
 */
export function ${subscriptionParserName(
    fn
  )} (/** A Netlify Handler Event */ event) : null | ${parsingFunctionReturnSignature}
`;
};

// TODO: Handle fragments
export const generateSubscriptionFunction = (schema, fn, fragments) => {
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
  accessToken,
  ) => {
    const netlifyGraphWebhookUrl = \`\${process.env.DEPLOY_URL}/.netlify/functions/${filename}?netlifyGraphWebhookId=\${netlifyGraphWebhookId}\`
    const secret = process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
    const fullVariables = {...variables, netlifyGraphWebhookUrl: netlifyGraphWebhookUrl, netlifyGraphWebhookSecret: { hmacSha256Key: secret }}

    const persistedInput = {
      doc_id: "${fn.id}",
      oeprationName: "${fn.operationName}",
      variables: fullVariables,
      accessToken: accessToken
    }

    const subscriptionOperationDoc = \`${safeBody}\`;

    // const result = await fetchOneGraphPersisted(persistedInput)
    const result = await fetchOneGraph(accessToken, subscriptionOperationDoc, "${
      fn.operationName
    }", fullVariables)
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

  return capitalizeFirstLetter(operationName);
};

export const queryToFunctionDefinition = (
  fullSchema: GraphQLSchema,
  persistedQuery: ExtractedFunction
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
  const fragments = parsed.definitions.filter(
    (def) => def.kind === Kind.FRAGMENT_DEFINITION
  ) as FragmentDefinitionNode[];

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
      return generateSubscriptionFunction(schema, fn, fragments);
    }

    const dynamicFunction = `${exp(netlifyGraphConfig, fn.fnName)} = (
  variables,
  accessToken,
  ) => {
  return fetchOneGraph({
    query: \`${fn.safeBody}\`,
    variables: variables,
    accessToken: accessToken
  })
}

  `;

    const staticFunction = `${exp(netlifyGraphConfig, fn.fnName)} = (
  variables,
  accessToken,
) => {
  return fetchOneGraph(accessToken, operationsDoc, "${
    fn.operationName
  }", variables)
}

`;
    return fn.id ? staticFunction : dynamicFunction;
  });

  const exportedFunctionsObjectProperties = enabledFunctions
    .map((fn) => {
      const isSubscription = fn.kind === "subscription";

      if (isSubscription) {
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
    .join(",\n  ");

  const dummyHandler = `${exp(
    netlifyGraphConfig,
    "handler"
  )} = async (event, context) => {
  // return a 401 json response
  return {
    statusCode: 401,
    body: JSON.stringify({
      message: 'Unauthorized',
    }),
  }
}`;

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
${imp(netlifyGraphConfig, "https", "https")}
${imp(netlifyGraphConfig, "crypto", "crypto")}

${exp(netlifyGraphConfig, "verifySignature")} = (input) => {
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
}

const operationsDoc = \`${safeOperationsDoc}\`

${generatedOneGraphClient()}

${exp(netlifyGraphConfig, "verifyRequestSignature")} = (request) => {
  const event = request.event
  const secret = process.env.NETLIFY_GRAPH_WEBHOOK_SECRET
  const signature = event.headers['x-onegraph-signature']
  const body = event.body

  if (!secret) {
    console.error(
      'NETLIFY_GRAPH_WEBHOOK_SECRET is not set, cannot verify incoming webhook request'
    )
    return false
  }

  return verifySignature({ secret, signature, body: body || '' })
}

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

export const generateTypeScriptDefinitions = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  enabledFunctions: ParsedFunction[]
) => {
  const functionDecls = enabledFunctions.map((fn) => {
    const isSubscription = fn.kind === "subscription";

    if (isSubscription) {
      const fragments = [];
      return generateSubscriptionFunctionTypeDefinition(schema, fn, fragments);
    }

    const jsDoc = replaceAll(fn.description || ``, "*/", "")
      .split("\n")
      .join("\n* ");

    return `/**
 * ${jsDoc}
 */
export function ${fn.fnName}(
  variables: ${fn.variableSignature},
  accessToken?: string
): Promise<
  ${fn.returnSignature}
>;`;
  });

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
${functionDecls.join("\n\n")}
`;

  return source;
};

export const generateFunctionsSource = (
  netlifyGraphConfig: NetlifyGraphConfig,
  schema: GraphQLSchema,
  operationsDoc: string,
  queries: ExtractedFunction[]
) => {
  const functionDefinitions: ParsedFunction[] = Object.values(queries)
    .map((query) => queryToFunctionDefinition(schema, query))
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
    functionDefinitions
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
 * @returns Record<string, ExtractedFunction>
 */
export const extractFunctionsFromOperationDoc = (
  parsedDoc: DocumentNode
): Record<string, ExtractedFunction> => {
  const functionEntries = parsedDoc.definitions
    .map((next) => {
      if (next.kind !== Kind.OPERATION_DEFINITION) {
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

      return [id, operation];
    })
    .filter(Boolean);

  //@ts-ignore
  return Object.fromEntries(functionEntries);
};

const frameworkGeneratorMap = {
  "Next.js": nextjsFunctionSnippet.generate,
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
      source: string;
      operation: OperationDefinitionNode;
    }
  | undefined => {
  const parsedDoc = parse(operationsDoc);
  const operations = extractFunctionsFromOperationDoc(parsedDoc);
  const fn = operations[operationId];

  if (!fn) {
    internalConsole.warn(
      `Operation ${operationId} not found in graphql.`,
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

  const source = generate({
    netlifyGraphConfig,
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  });

  return { source, operation: fn.parsedOperation };
};
