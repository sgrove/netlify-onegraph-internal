import * as GraphQLPackage from "graphql";
import type {
  GraphQLSchema,
  OperationDefinitionNode,
  FragmentDefinitionNode,
} from "graphql";
import { NetlifyGraphConfig } from "../netlifyGraph";

import {
  ExportedFile,
  munge,
  NamedExportedFile,
  OperationData,
  OperationDataList,
  Codegen,
} from "./codegenHelpers";
import { internalConsole } from "../internalConsole";
import { remixFormInput } from "../graphqlHelpers";
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

export const formElComponent = ({
  GraphQL,
  operationData,
  schema,
  callFn,
}: {
  GraphQL: typeof GraphQLPackage;

  operationData: OperationData;
  schema: GraphQLSchema;
  callFn: string;
}): {
  formHelpers: string;
  formEl: string;
} => {
  if (!schema) {
    return {
      formHelpers:
        "const [formVariables, setFormVariables] = React.useState({});",
      formEl:
        "<pre>You must pass in a schema to generate forms for your GraphQL operation</pre>",
    };
  }

  const els = (operationData.operationDefinition.variableDefinitions || []).map(
    (def) => {
      const genInput = remixFormInput(GraphQL, schema, def, []);

      const input =
        genInput || `UNABLE_TO_GENERATE_FORM_INPUT_FOR_GRAPHQL_TYPE(${def})`;
      return `<p>${input}</p>`;
    }
  );

  return {
    formHelpers: `const [formVariables, setFormVariables] = React.useState({});`,
    formEl: `${addLeftWhitespace(els.join("\n"), 2)}
  <p>
    <button type="submit">
      {transition.submission
        ? "Submitting..."
        : "Run ${operationData.displayName}"}
    </button>
  </p>
`,
  };
};

const generateRoute = (opts: {
  GraphQL: typeof GraphQLPackage;
  netlifyGraphConfig: NetlifyGraphConfig;
  operationData: OperationData;
  schema: GraphQLSchema;
  route: string;
}): NamedExportedFile => {
  const form = formElComponent({
    GraphQL: opts.GraphQL,
    operationData: opts.operationData,
    schema: opts.schema,
    callFn: "submitForm()",
  });

  const { netlifyGraphConfig } = opts;

  const fetcherInvocation = asyncFetcherInvocation(
    GraphQL,
    opts.netlifyGraphConfig,
    [opts.operationData],
    "get"
  );

  return {
    kind: "NamedExportedFile",
    language: opts.netlifyGraphConfig.language,
    name: [
      "app",
      "routes",
      `${opts.operationData.displayName}.${
        opts.netlifyGraphConfig.language === "typescript" ? "tsx" : "js"
      }`,
    ],
    content: `import { ${ts(
      netlifyGraphConfig,
      "ActionFunction, "
    )}json, Form, useActionData, useTransition } from "remix";
import NetlifyGraph from "${netlifyGraphConfig.netlifyGraphRequirePath}";${ts(
      netlifyGraphConfig,
      `
import invariant from "tiny-invariant";`
    )}

${exp(netlifyGraphConfig, "action")}${ts(
      netlifyGraphConfig,
      ": ActionFunction"
    )} = async ({ context, request }) => {
  const formData = await request.formData();

  // By default, all API calls use no authentication
  let accessToken;

  //// If you want to use the API with your own access token:
  // accessToken = context.netlifyGraphToken;

  ${fetcherInvocation}

  return json({ data, errors });
};

export default function handler() {
  const results = useActionData();
  const transition = useTransition();

  const errors = results?.errors;
  const data${ts(
    netlifyGraphConfig,
    `: NetlifyGraph.${capitalizeFirstLetter(opts.operationData.name)}["data"]`
  )} = results?.data;


  return (
    <Form method="post">
     ${form.formEl}
     {errors ? (<pre className="error">{JSON.stringify(errors, null, 2)}</pre>) : null}
     {data ? (<pre>{JSON.stringify(data, null, 2)}</pre>) : null}
    </Form>
  );
}
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
  query,
  variables,
}: {
  GraphQL: typeof GraphQLPackage;
  query: string;
  variables: Record<string, unknown>;
}): OperationDataList => {
  const { Kind, print } = GraphQL;

  const operationDefinitions = getOperationNodes(GraphQL, query);

  const fragmentDefinitions: FragmentDefinitionNode[] = [];

  operationDefinitions.forEach((operationDefinition) => {
    if (operationDefinition.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentDefinitions.push(operationDefinition);
    }
  });

  const rawOperationDataList: OperationData[] = operationDefinitions.map(
    (operationDefinition) => ({
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
    })
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
  const { print } = GraphQL;

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
  netlifyGraphConfig: NetlifyGraphConfig,
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
                `${munge(name)}FormValue`
              );
              return `const ${munge(
                name
              )}FormValue = formData.get("${name}");${ts(
                netlifyGraphConfig,
                `
invariant(typeof ${munge(name)}FormValue === "string");`
              )}
const ${munge(name)} = ${withCoercer};
`;
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
    return json(
      {
        errors: ["You must supply parameters for: ${message}"],
      },
      { status: 422 }
    );
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
  const resp = await fetch(\`/${namedOperationData.name}${
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

const subscriptionHandler = ({
  netlifyGraphConfig,
  operationData,
}: {
  netlifyGraphConfig: NetlifyGraphConfig;
  operationData: OperationData;
}): ExportedFile => {
  return {
    kind: "NamedExportedFile",
    language: netlifyGraphConfig.language,
    name: [
      "app",
      "routes",
      "webhooks",
      `${operationData.displayName}.${
        netlifyGraphConfig.language === "typescript" ? "tsx" : "js"
      }`,
    ],
    content: `import { ${ts(
      netlifyGraphConfig,
      "ActionFunction, "
    )}json } from "remix";
import NetlifyGraph from "../${netlifyGraphConfig.netlifyGraphRequirePath}";

${exp(netlifyGraphConfig, "action")}${ts(
      netlifyGraphConfig,
      ": ActionFunction"
    )} = async ({ context, request }) => {
  const reqBody = await request.text();

  const payload = NetlifyGraph.parseAndVerify${operationData.name}Event({
    body: reqBody,
    headers: {
      'x-netlify-graph-signature': context.netlifyGraphSignature
    },
  });

  if (!payload) {
    return json({
      success: false,
      error: 'Unable to verify payload signature',
    }, { status: 422 });
  }

  const { errors, data } = payload;

  if (errors) {
    console.error(errors);
  }

  console.log(data);

  /**
   * If you want to unsubscribe from this webhook
   * in order to stop receiving new events,
   * simply return status 410, e.g.:
   *
   * return json({}, { status: 410 });
   */

  return json({
    successfullyProcessedIncomingWebhook: true,
  });
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
    return `exports.default = ${name}`;
  }

  return `export default ${name}`;
};

// Snippet generation!
export const remixFunctionSnippet: Codegen = {
  name: "Remix Function",
  generateHandlerOptions: snippetOptions,
  supportedDefinitionTypes: [],
  id: "netlify-graph-codegen/remix",
  version: "0.0.1",
  generateHandler: (opts) => {
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
        exportedFiles: [result],
      };
    }

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

/**
 * Client-side invocations:
 * Call your Netlify function from the browser with this helper:
 */

/**
${clientSideCalls}
*/`;

    const route: NamedExportedFile = generateRoute({
      GraphQL: opts.GraphQL,
      netlifyGraphConfig: netlifyGraphConfig,
      operationData: firstOperation,
      schema: opts.schema,
      route: `/${firstOperation.displayName}`,
    });

    return {
      language: "javascript",
      exportedFiles: [route],
    };
  },
};

export const id = "netlify-builtin:remix";
export const version = "0.0.1";
export const generators = [remixFunctionSnippet];

export const codegenModule: CodegenHelpers.IncludedCodegenModule = {
  id,
  version,
  generators,
  generateRuntime: generateRuntime,
  sigil: "netlify-builtin:remix",
};
