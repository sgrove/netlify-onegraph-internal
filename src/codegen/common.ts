import { CodegenHelpers } from "..";

export const generateFragmentTypeScriptDefinition = ({ fragment }) => {
  const jsDoc = replaceAll(fragment.description || ``, "*/", "")
    .split("\n")
    .join("\n* ");

  const baseName = fragment.fragmentName;

  const returnSignatureName = capitalizeFirstLetter(baseName);

  return `/**
    * ${jsDoc}
    */
    export type ${returnSignatureName} = ${fragment.returnSignature};
    `;
};

export const generateTypeScriptDefinitions: CodegenHelpers.GenerateRuntimeFunction =
  ({ GraphQL, netlifyGraphConfig, schema, functionDefinitions, fragments }) => {
    const fragmentDecls = Object.values(fragments)
      .sort((a, b) => {
        return a.id.localeCompare(b.id);
      })
      .map((fragment) => {
        return generateFragmentTypeScriptDefinition({
          fragment,
        });
      });

    const functionDecls = functionDefinitions
      .sort((a, b) => {
        return a.id.localeCompare(b.id);
      })
      .map((fn) => {
        const isSubscription = fn.kind === "subscription";

        if (isSubscription) {
          return "TODO";
          // return generateSubscriptionFunctionTypeDefinition(
          //   GraphQL,
          //   schema,
          //   fn,
          //   enabledFragments
          // );
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

    const exportedFunctionsObjectProperties = functionDefinitions
      .sort((a, b) => {
        return a.id.localeCompare(b.id);
      })
      .map((fn) => {
        const isSubscription = fn.kind === "subscription";

        if (isSubscription) {
          if (netlifyGraphConfig.runtimeTargetEnv === "node") {
            const subscriptionFnName = "TODO:subscriptionFunctionName(fn)";
            const parserFnName = "TODO:subscriptionParserName(fn)";

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
            return "/** unexpected branch */";
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

    const defaultRuntimePath = [
      "./",
      "netlify",
      "functions",
      "netlifyGraph",
      "index.js",
    ];

    const filename =
      netlifyGraphConfig.netlifyGraphImplementationFilename ||
      defaultRuntimePath;

    const typeDefinitionsFilename = [
      ...filename.slice(0, -1),
      `${filename.slice(-1)[0].split(".").slice(0, -1).join(".") + ".d.ts"}`,
    ];

    return [
      {
        kind: "NamedExportedFile",
        name: typeDefinitionsFilename,
        content: source,
        language: "typescript",
      },
    ];
  };

const capitalizeFirstLetter = (string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const replaceAll = (target, search, replace) => {
  const simpleString = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return target.replace(new RegExp(simpleString, "g"), replace);
};

const lruCacheImplementation = `// Basic LRU cache implementation
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

export const generateRuntime: CodegenHelpers.GenerateRuntimeFunction = (
  opts
) => {
  const { netlifyGraphConfig, schemaId } = opts;

  const export_ = (netlifyGraphConfig, envs, name, value) => {
    if (!envs.includes(netlifyGraphConfig.runtimeTargetEnv)) {
      return "";
    }

    if (netlifyGraphConfig.moduleType === "commonjs") {
      return `exports.${name} = ${value}`;
    }

    return `export const ${name} = ${value}`;
  };

  const import_ = (netlifyGraphConfig, envs, name, packageName) => {
    if (!envs.includes(netlifyGraphConfig.runtimeTargetEnv)) {
      return "";
    }

    if (netlifyGraphConfig.moduleType === "commonjs") {
      return `const ${name} = require("${packageName}")`;
    }

    return `import ${name} from "${packageName}"`;
  };

  const defaultRuntimePath = [
    "./",
    "netlify",
    "functions",
    "netlifyGraph",
    "index.js",
  ];
  const filename =
    opts.netlifyGraphConfig.netlifyGraphImplementationFilename ||
    defaultRuntimePath;

  const exportedFunctionsObjectProperties = opts.functionDefinitions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      const isSubscription = fn.kind === "subscription";

      if (isSubscription) {
        if (netlifyGraphConfig.runtimeTargetEnv === "node") {
          const subscriptionFnName = "TODO_SUB";
          const parserFnName = "TODO_SUB";

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
          return "/** unexpected branch 2 */";
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

  const fnNames = opts.operationDataList.map((op) => op.displayName);
  const functionDecls = opts.functionDefinitions
    .sort((a, b) => {
      return a.id.localeCompare(b.id);
    })
    .map((fn) => {
      if (fn.kind === "subscription") {
        const fragments = [];
        return "TODO_SUBSCRIPTION";
        // return generateSubscriptionFunction(
        //   GraphQL,
        //   schema,
        //   fn,
        //   fragments,
        //   netlifyGraphConfig
        // );
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

  const runtime = `/* eslint-disable */
  // @ts-nocheck
  // GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
  
  ${lruCacheImplementation}
  
  const schemaId = '${schemaId}';
  
  const netlifyGraphHostWithProtocol =
    process.env.NETLIFY_GRAPH_HOST_WITH_PROTOCOL || 'https://graph.netlify.com';
  
  const siteId = process.env.SITE_ID;
  
  const makeNetlifyGraphUrl = ({ operationName }) => {
    return (
      netlifyGraphHostWithProtocol +
      '/graphql?app_id=' +
      siteId +
      '&operationName=' +
      operationName +
      '&schema_id=' +
      schemaId
    );
  };
  
  const httpFetch = (operationName, options) => {
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
  
    const netlifyGraphUrl = makeNetlifyGraphUrl({ operationName: operationName });
  
    return fetch(netlifyGraphUrl, reqOptions).then((body) => {
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
  };
  
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
        'If-None-Match': '',
      };
      let cachedResultValue;
  
      if (cachedResultPair) {
        const [etag, previousResult] = cachedResultPair;
        conditionalHeaders = {
          'If-None-Match': etag,
        };
        cachedResultValue = previousResult;
      }
  
      const response = httpFetch(operationName, {
        method: 'POST',
        headers: {
          ...conditionalHeaders,
          Authorization: accessToken ? 'Bearer ' + accessToken : '',
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
          const etag = result.headers['etag'];
          const resultJson = JSON.parse(result.body);
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
  }`;

  const typeDefinitions = generateTypeScriptDefinitions(opts);

  return [
    {
      kind: "NamedExportedFile",
      name: filename,
      content: runtime,
      language: "javascript",
    },
    ...typeDefinitions,
  ];
};
