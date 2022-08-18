import * as GraphQLPackage from "graphql";
import type {
  GraphQLSchema,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  DocumentNode,
} from "graphql";
import { NetlifyGraphConfig } from "../netlifyGraph";

import {
  ExportedFile,
  munge,
  NamedExportedFile,
  OperationData,
  OperationDataList,
  Codegen,
  UnnamedExportedFile,
} from "./codegenHelpers";
import { internalConsole } from "../internalConsole";
import { extractPersistableOperation, formElComponent } from "../graphqlHelpers";
import { CodegenHelpers, GraphQL } from "..";
import { generateRuntime } from "./common";

let operationNodesMemo = [null, null];

const formUpdateHandler = `const updateFormVariables = (setFormVariables, path, coerce) => {
  const setIn = (object, path, value) => {
    if (path.length === 1) {
      if (value === null) {
        delete object[path[0]];
      } else {
        object[path[0]] = value;
      }
    } else {
      if ([undefined, null].indexOf(object[path[0]]) > -1) {
        object[path[0]] = typeof path[1] === "number" ?  [] : {};
      }
      setIn(object[path[0]], path.slice(1), value);
    }
    return object;
  };

  const formInputHandler = (event) => {
    // We parse the form input, coerce it to the correct type, and then update the form variables
    const rawValue = event.target.value;
    // We take a blank input to mean \`null\`
    const value = rawValue === "" ? null : rawValue;
    setFormVariables((oldFormVariables) => {
      const newValue = setIn(oldFormVariables, path, coerce(value));
      return { ...newValue };
    });
  };

  return formInputHandler;
};`;

const generatePage = (opts: {
  GraphQL: typeof GraphQLPackage;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationData: OperationData;
  schema: GraphQLSchema;
  route: string;
}): NamedExportedFile => {
  const form = formElComponent({
    GraphQL,
    operationData: opts.operationData,
    schema: opts.schema,
    callFn: "submitForm()",
  });

  const extension =
    opts.netlifyGraphConfig.language === "typescript" ? "tsx" : "jsx";

  return {
    kind: "NamedExportedFile",
    language: opts.netlifyGraphConfig.language,
    name: ["pages", `${opts.operationData.displayName}Form.${extension}`],
    content: `import Head from "next/head";
import React, { useState } from "react";
import { Auth } from 'netlify-graph-auth';${ts(
      opts.netlifyGraphConfig,
      `
import NetlifyGraphAuth = Auth.NetlifyGraphAuth;`
    )}${notTs(
      opts.netlifyGraphConfig,
      `

const { NetlifyGraphAuth } = Auth;`
    )}

export default function Form(props) {
  const isServer = typeof window === "undefined";
  ${form.formHelpers}
  const [result, setResult] = useState(null);
  const [auth, setAuth] = useState(
    isServer
      ? null
      : new NetlifyGraphAuth({
          siteId: props.siteId,
        })
  );

  const submitForm = async () => {
    const res = await fetch("${opts.route}", {
      body: JSON.stringify(formVariables),
      headers: {
        "Content-Type": "application/json",
        ...auth?.authHeaders()
      },
      method: "POST"
    });

    const formResult = await res.json();
    setResult(formResult);
  };

  const needsLoginService = auth?.findMissingAuthServices(result)[0];

  return (
    <div className="container">
      <Head>
        <title>${opts.operationData.displayName} form</title>
      </Head>
      <main>
        <h1>{props.title}</h1>
${addLeftWhitespace(form.formEl, 8)}
        {needsLoginService ? (
          <button
          onClick={async () => {
            await auth.login(needsLoginService);
            const loginSuccess = await auth.isLoggedIn(needsLoginService);
            if (loginSuccess) {
              console.log("Successfully logged into " + needsLoginService);
              submitForm();
            } else {
              console.log("The user did not grant auth to " + needsLoginService);
            }
          }}
        >
          {\`Log in to \${needsLoginService.graphQLField}\`}
        </button>) 
        : null}
        <pre>{JSON.stringify(formVariables, null, 2)}</pre>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </main>
    </div>
  )
}

export async function getServerSideProps(context) {
  const siteId = process.env.SITE_ID;
  if (!siteId) {
    throw new Error("SITE_ID environment variable is not set. Be sure to run \`netlify link\` before \`netlify dev\`");
  }

  return {
    props: {
      title: "${opts.operationData.displayName} form",
      siteId: siteId
    }
  }
}

${formUpdateHandler}
`,
  };
};

const getOperationNodes = (GraphQL: typeof GraphQLPackage, query) => {
  const { parse } = GraphQL;
  if (operationNodesMemo[0] === query && operationNodesMemo[1]) {
    return operationNodesMemo[1];
  }
  const operationDefinitions: (
    | OperationDefinitionNode
    | FragmentDefinitionNode
  )[] = [];
  try {
    parse(query).definitions.forEach((def) => {
      if (
        def.kind === "FragmentDefinition" ||
        def.kind === "OperationDefinition"
      ) {
        operationDefinitions.push(def);
      }
    });
  } catch (parseError) {
    // ignore
  }
  operationNodesMemo = [query, operationDefinitions];
  return operationDefinitions;
};

const getOperationName = (operationDefinition) =>
  operationDefinition.name
    ? operationDefinition.name.value
    : operationDefinition.operation;

const getOperationDisplayName = (operationDefinition) =>
  operationDefinition.name
    ? operationDefinition.name.value
    : `<Unnamed:${operationDefinition.operation}>`;

const formatVariableName = (name) => {
  const uppercasePattern = /[A-Z]/g;

  return (
    name.charAt(0).toUpperCase() +
    name.slice(1).replace(uppercasePattern, "_$&").toUpperCase()
  );
};

const getUsedVariables = (variables, operationDefinition) =>
  (operationDefinition.variableDefinitions || []).reduce(
    (usedVariables, variable) => {
      const variableName = variable.variable.name.value;
      if (variables[variableName]) {
        usedVariables[variableName] = variables[variableName];
      }

      return usedVariables;
    },
    {}
  );

const findFragmentDependencies = (operationDefinitions, definition) => {
  const fragmentByName = (name) =>
    operationDefinitions.find((def) => def.name.value === name);

  const findReferencedFragments = (selectionSet) => {
    const { selections } = selectionSet;

    const namedFragments = selections
      .map((selection) => {
        if (selection.kind === "FragmentSpread") {
          return fragmentByName(selection.name.value);
        }
        return null;
      })
      .filter(Boolean);

    const nestedNamedFragments = selections.reduce((acc, selection) => {
      if (
        (selection.kind === "Field" ||
          selection.kind === "SelectionNode" ||
          selection.kind === "InlineFragment") &&
        selection.selectionSet !== undefined
      ) {
        return [...acc, ...findReferencedFragments(selection.selectionSet)];
      }
      return acc;
    }, []);

    return [...namedFragments, ...nestedNamedFragments];
  };

  const { selectionSet } = definition;

  return findReferencedFragments(selectionSet);
};

const operationDataByName = (graph, name) =>
  graph.find((operationData) => operationData.name === name);

const topologicalSortHelper = ({ graph, node, temp, visited }, result) => {
  temp[node.name] = true;
  const neighbors = node.fragmentDependencies;
  neighbors.forEach((fragmentDependency) => {
    const fragmentOperationData = operationDataByName(
      graph,
      fragmentDependency.name.value
    );

    if (!fragmentOperationData) {
      return;
    }

    if (temp[fragmentOperationData.name]) {
      internalConsole.error("The operation graph has a cycle");
      return;
    }
    if (!visited[fragmentOperationData.name]) {
      topologicalSortHelper(
        {
          node: fragmentOperationData,
          visited,
          temp,
          graph,
        },
        result
      );
    }
  });
  temp[node.name] = false;
  visited[node.name] = true;
  result.push(node);
};

const toposort = (graph) => {
  const result = [];
  const visited = {};
  const temp = {};
  graph.forEach((node) => {
    if (!visited[node.name] && !temp[node.name]) {
      topologicalSortHelper({ node, visited, temp, graph }, result);
    }
  });
  return result;
};

export const computeOperationDataList = ({
  GraphQL,
  parsedDoc,
  query,
  variables,
  fragmentDefinitions,
}: {
  GraphQL: typeof GraphQLPackage;
  parsedDoc: DocumentNode,
  query: string;
  variables: Record<string, unknown>;
  fragmentDefinitions: FragmentDefinitionNode[];
}): OperationDataList => {
  const { Kind, print } = GraphQL;

  const operationDefinitions = getOperationNodes(GraphQL, query);

  operationDefinitions.forEach((operationDefinition) => {
    if (operationDefinition.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentDefinitions.push(operationDefinition);
    }
  });

  const rawOperationDataList: OperationData[] = operationDefinitions.map(
    (operationDefinition) => {
      const persistableOperationString =
        operationDefinition.kind === Kind.OPERATION_DEFINITION
          ? extractPersistableOperation(GraphQL, parsedDoc, operationDefinition)
              ?.persistableOperationString ?? null
          : null;

      return {
        query: print(operationDefinition),
        name: getOperationName(operationDefinition),
        displayName: getOperationDisplayName(operationDefinition),
        type:
          operationDefinition.kind === Kind.OPERATION_DEFINITION
            ? operationDefinition.operation
            : Kind.FRAGMENT_DEFINITION,
        variableName: formatVariableName(getOperationName(operationDefinition)),
        variables: getUsedVariables(variables, operationDefinition),
        operationDefinition,
        fragmentDependencies: findFragmentDependencies(
          fragmentDefinitions,
          operationDefinition
        ),
        persistableOperationString,
      };
    }
  );

  const operationDataList = toposort(rawOperationDataList);

  return {
    operationDefinitions,
    fragmentDefinitions,
    rawOperationDataList,
    operationDataList,
  };
};

const capitalizeFirstLetter = (string: string) =>
  string.charAt(0).toUpperCase() + string.slice(1);

const unnamedSymbols = new Set(["query", "mutation", "subscription"]);

const isOperationNamed = (operationData) =>
  !unnamedSymbols.has(operationData.name.trim());

const addLeftWhitespace = (string, padding) => {
  const paddingString = " ".repeat(padding);

  return string
    .split("\n")
    .map((line) => paddingString + line)
    .join("\n");
};

const collapseExtraNewlines = (string) => string.replace(/\n{2,}/g, "\n\n");

const snippetOptions = {
  inputTypename: "Options",
  schemaSdl: `
  enum HttpMethod {
    POST
    GET
  }

input Options {
    """
    Make call over POST
    """
    postHttpMethod: HttpMethod
    """
    Use user's OAuth token
    """
    useClientAuth: Boolean!
}
    `,
};

const operationFunctionName = (operationData) => {
  const { type } = operationData;

  let prefix = "unknown";
  switch (type) {
    case "query":
      prefix = "fetch";
      break;
    case "mutation":
      prefix = "execute";
      break;
    case "subscription":
      prefix = "subscribeTo";
      break;
    default:
      break;
  }

  const fnName =
    prefix +
    (prefix.length === 0
      ? operationData.name
      : capitalizeFirstLetter(operationData.name));

  return fnName;
};

const coercerFor = (GraphQL: typeof GraphQLPackage, type, name) => {
  const { Kind, print } = GraphQL;

  const typeName = print(type).replace(/\W+/gi, "").toLocaleLowerCase();

  switch (typeName) {
    case "string":
      return `${name}`;
    case "int":
      return `parseInt(${name})`;
    case "float":
      return `parseFloat(${name})`;
    case "boolean":
      return `${name} === 'true'`;
    default:
      return `${name}`;
  }
};

const asyncFetcherInvocation = (
  GraphQL: typeof GraphQLPackage,
  operationDataList,
  pluckerStyle
) => {
  const { print } = GraphQL;

  const invocations = operationDataList
    .filter((operationData) =>
      ["query", "mutation", "subscription"].includes(operationData.type)
    )
    .map((namedOperationData) => {
      const params = (
        namedOperationData.operationDefinition.variableDefinitions || []
      ).map((def) => def.variable.name.value);

      const invocationParams = params.map(
        (param) => `${param}: ${munge(param)}`
      );

      const pluckers = {
        get:
          namedOperationData?.operationDefinition?.variableDefinitions
            ?.map((def) => {
              const name = def.variable.name.value;
              const withCoercer = coercerFor(
                GraphQL,
                def.type,
                `typeof req.query?.${name} === 'string' ? req.query?.${name} : req.query?.${name}[0]`
              );
              return `const ${munge(name)} = ${withCoercer};`;
            })
            .join("\n  ") || "",
        post:
          namedOperationData?.operationDefinition?.variableDefinitions
            ?.map((def) => {
              const name = def.variable.name.value;
              return `const ${munge(name)} = eventBodyJson?.${name};`;
            })
            .join("\n  ") || "",
      };

      let variableValidation = "";

      let requiredVariableCount = 0;

      if (
        (namedOperationData?.operationDefinition?.variableDefinitions || [])
          .length !== 0 ||
        0
      ) {
        const requiredVariableNames =
          namedOperationData.operationDefinition.variableDefinitions
            .map((def) =>
              print(def.type).endsWith("!") ? def.variable.name.value : null
            )
            .filter(Boolean);

        requiredVariableCount = requiredVariableNames.length;

        // TODO: Filter nullable variables
        const condition = requiredVariableNames
          .map(
            (name) => `${munge(name)} === undefined || ${munge(name)} === null`
          )
          .join(" || ");

        const message = requiredVariableNames
          .map((name) => `\`${name}\``)
          .join(", ");

        variableValidation = `  if (${condition}) {
    return res.status(422).json({
        errors: ["You must supply parameters for: ${message}"],
    });
  }`;
      }

      return `${pluckerStyle === "get" ? pluckers.get : pluckers.post}

${requiredVariableCount > 0 ? variableValidation : ""}

  const { errors, data } = await NetlifyGraph.${operationFunctionName(
    namedOperationData
  )}({ ${invocationParams.join(", ")} }, {accessToken: accessToken}); 

  if (errors) {
    console.error(JSON.stringify(errors, null, 2));
  }

  console.log(JSON.stringify(data, null, 2));`;
    })
    .join("\n\n");

  return invocations;
};

const clientSideInvocations = (
  operationDataList,
  pluckerStyle,
  useClientAuth
) => {
  const invocations = operationDataList
    .filter((operationData) =>
      ["query", "mutation", "subscription"].includes(operationData.type)
    )
    .map((namedOperationData) => {
      const whitespace = 8;

      const params = (
        namedOperationData.operationDefinition.variableDefinitions || []
      ).map((def) => def.variable.name.value);
      let bodyPayload = "";

      if (
        namedOperationData?.operationDefinition?.variableDefinitions?.length ||
        0 > 0
      ) {
        const variableNames =
          namedOperationData.operationDefinition.variableDefinitions.map(
            (def) => def.variable.name.value
          );

        const variables = variableNames
          .map((name) => `"${name}": ${name}`)
          .join(",\n");

        bodyPayload = `
${variables}
`;
      }

      const clientAuth = useClientAuth
        ? `,
    ...netlifyGraphAuth?.authHeaders()`
        : "";

      const headers = `headers: {
      "Content-Type": "application/json"${clientAuth}
    },`;

      return `async function ${operationFunctionName(namedOperationData)}(${
        useClientAuth ? "netlifyGraphAuth, " : ""
      }params) {
  const {${params.join(", ")}} = params || {};
  const resp = await fetch(\`/api/${namedOperationData.name}${
        pluckerStyle === "get"
          ? `?${params.map((param) => `${param}=\${${param}}`).join("&")}`
          : ""
      }\`, {
    method: "${pluckerStyle.toLocaleUpperCase()}"${
        pluckerStyle === "get"
          ? ""
          : `,
    ${headers}
    body: JSON.stringify({${addLeftWhitespace(
      bodyPayload,
      whitespace
    ).trim()}})`
      }
  });

  const text = await resp.text();

  return JSON.parse(text);
}`;
    })
    .join("\n\n");

  return invocations;
};

const ts = (netlifyGraphConfig: NetlifyGraphConfig, string: string) =>
  netlifyGraphConfig.language === "typescript" ? string : "";

const notTs = (netlifyGraphConfig: NetlifyGraphConfig, string: string) =>
  netlifyGraphConfig.language !== "typescript" ? string : "";

const subscriptionHandler = ({
  netlifyGraphConfig,
  operationData,
}: {
  netlifyGraphConfig: NetlifyGraphConfig;
  operationData: OperationData;
}): ExportedFile => {
  return {
    kind: "UnnamedExportedFile",
    language: netlifyGraphConfig.language,
    content: `${ts(
      netlifyGraphConfig,
      'import type { NextApiRequest, NextApiResponse } from "next";\n'
    )}${imp(
      netlifyGraphConfig,
      "NetlifyGraph",
      netlifyGraphConfig.netlifyGraphRequirePath
    )};

${exp(netlifyGraphConfig, "handler")} = async (req${ts(
      netlifyGraphConfig,
      ": NextApiRequest"
    )}, res${ts(netlifyGraphConfig, ": NextApiResponse")}) => {
  const reqBody = await extractBody(req);

  const payload = NetlifyGraph.parseAndVerify${operationData.name}Event({
    headers: {
      "x-netlify-graph-signature": req.headers[
        "x-netlify-graph-signature"
      ]${ts(netlifyGraphConfig, " as string")}
    },
    body: reqBody,
  });

  if (!payload) {
    return res.status(422).json({
      success: false,
      error: 'Unable to verify payload signature',
    });
  }

  const { errors, data } = payload;

  if (errors) {
    console.error(errors);
  }

  console.log(data);

  res.setHeader("Content-Type", "application/json");

  /**
   * If you want to unsubscribe from this webhook
   * in order to stop receiving new events,
   * simply return status 410, e.g.:
   * 
   * return res.status(410).json({});
   */

  return res.status(200).json({
    successfullyProcessedIncomingWebhook: true,
  });
};

${expDefault(netlifyGraphConfig, "handler")};

export const config = {
  api: {
    // We manually parse the body of the request in order to verify
    // that it's signed by Netlify before processing the event.
    bodyParser: false,
  },
};

const extractBody = (req${ts(netlifyGraphConfig, ": NextApiRequest")})${ts(
      netlifyGraphConfig,
      ": Promise<string>"
    )} => {
  let body = [];
  const promise${ts(
    netlifyGraphConfig,
    ": Promise<string>"
  )} = new Promise((resolve, reject) => {
    req
      .on("data", (chunk) => {
        body.push(chunk);
      })
      .on("end", () => {
        const fullBody = Buffer.concat(body).toString();
        resolve(fullBody);
      });
  });

  return promise;
};
`,
  };
};

const imp = (
  netlifyGraphConfig: NetlifyGraphConfig,
  name: string,
  packageName: string[]
) => {
  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `const ${name} = require("${packageName.join("/")}")`;
  }

  return `import ${name} from "${packageName.join("/")}"`;
};

const exp = (netlifyGraphConfig: NetlifyGraphConfig, name: string) => {
  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `exports.${name}`;
  }

  return `export const ${name}`;
};

const expDefault = (netlifyGraphConfig: NetlifyGraphConfig, name: string) => {
  if (netlifyGraphConfig.moduleType === "commonjs") {
    return `exports.default = exports.${name}`;
  }

  return `export default ${name}`;
};

// Snippet generation!
export const nextjsFunctionSnippet: Codegen = {
  name: "Next.js Function",
  generateHandlerOptions: snippetOptions,
  supportedDefinitionTypes: [],
  id: "netlify-graph-codegen/next-js",
  version: "0.0.1",
  generateHandler: async (opts) => {
    const { netlifyGraphConfig, options } = opts;

    const operationDataList = opts.operationDataList.map(
      (operationData, idx) => {
        if (!isOperationNamed(operationData)) {
          return {
            ...operationData,
            name: `unnamed${capitalizeFirstLetter(operationData.type)}${
              idx + 1
            }`.trim(),
            query: `# Consider giving this ${
              operationData.type
            } a unique, descriptive
# name in your application as a best practice
${operationData.type} unnamed${capitalizeFirstLetter(operationData.type)}${
              idx + 1
            } ${operationData.query
              .trim()
              .replace(/^(query|mutation|subscription) /i, "")}`,
          };
        }
        return operationData;
      }
    );

    const firstOperation = operationDataList.find(
      (operation) =>
        operation.operationDefinition.kind === "OperationDefinition"
    );

    if (!firstOperation) {
      return {
        exportedFiles: [
          {
            kind: "UnnamedExportedFile",
            content: "// No operation found",
            language: "javascript",
          },
        ],
      };
    }

    const filename = `${firstOperation.name}.${netlifyGraphConfig.extension}`;

    const isSubscription = firstOperation.type === "subscription";

    if (isSubscription) {
      const result = subscriptionHandler({
        netlifyGraphConfig,
        operationData: firstOperation,
      });

      return {
        language: netlifyGraphConfig.language,
        exportedFiles: [result],
      };
    }

    const fetcherInvocation = asyncFetcherInvocation(
      opts.GraphQL,
      operationDataList,
      options.postHttpMethod === true ? "post" : "get"
    );

    const passThroughResults =
      operationDataList.length === 1
        ? `errors, data`
        : operationDataList
            .filter((operationData) =>
              ["query", "mutation", "subscription"].includes(operationData.type)
            )
            .map(
              (_operationData) => `errors,
data`
            )
            .join(",\n");
    const clientSideCalls = clientSideInvocations(
      operationDataList,
      options.postHttpMethod === true ? "post" : "get",
      options.useClientAuth
    );

    const whitespace = 4;

    const snippet = `${ts(
      netlifyGraphConfig,
      'import type { NextApiRequest, NextApiResponse } from "next";'
    )}
${imp(
  netlifyGraphConfig,
  "NetlifyGraph",
  netlifyGraphConfig.netlifyGraphRequirePath
)};

${exp(netlifyGraphConfig, "handler")} = async (req${ts(
      netlifyGraphConfig,
      ": NextApiRequest"
    )}, res${ts(netlifyGraphConfig, ": NextApiResponse")}) => {
  // By default, all API calls use no authentication
  let accessToken = null;

  //// If you want to use the client's accessToken when making API calls on the user's behalf:
  // accessToken = req.headers["authorization"]?.split(" ")[1];

  //// If you want to use the API with your own access token:
  // accessToken = process.env.NETLIFY_GRAPH_TOKEN;
      
  const eventBodyJson = req.body || {};

  ${fetcherInvocation}

  res.setHeader("Content-Type", "application/json");

  return res.status(200).json({
${addLeftWhitespace(passThroughResults, whitespace)}
  });
};

${expDefault(netlifyGraphConfig, "handler")};

/** 
 * Client-side invocations:
 * Call your Netlify function from the browser with this helper:
 */

/**
${clientSideCalls}
*/`;

    const page: NamedExportedFile = generatePage({
      GraphQL: opts.GraphQL,
      netlifyGraphConfig,
      operationData: firstOperation,
      schema: opts.schema,
      route: `/api/${firstOperation.displayName}`,
    });

    const api: UnnamedExportedFile = {
      kind: "UnnamedExportedFile",
      content: collapseExtraNewlines(snippet),
      language: netlifyGraphConfig.language,
    };

    return {
      language: "javascript",
      exportedFiles: [api, page],
    };
  },
};

export const id = "netlify-builtin:nextjs";
export const version = "0.0.1";
export const generators = [nextjsFunctionSnippet];

export const codegenModule: CodegenHelpers.IncludedCodegenModule = {
  id,
  version,
  generators,
  generateRuntime: generateRuntime,
  sigil: "netlify-builtin:nextjs",
};
