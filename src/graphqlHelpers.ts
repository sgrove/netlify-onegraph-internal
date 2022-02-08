import {
  DirectiveDefinitionNode,
  getNamedType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  InputValueDefinitionNode,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isWrappingType,
  Kind,
  NamedTypeNode,
  NonNullTypeNode,
  parse,
  parseType,
  print,
  SelectionNode,
  SelectionSetNode,
  typeFromAST,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";
import {
  GraphQLSchema,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  GraphQLType,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";

import { OperationData } from "./codegen/codegenHelpers";

export default function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

type OutEnum = {
  kind: "enum";
  description?: Maybe<string>;
  values: string[];
};

type OutSelection = Record<string, OutSelectionFieldValue>;

type OutSelectionFieldValue = {
  kind: "selection_field";
  name: string;
  type: OutType;
  description?: Maybe<string>;
};

type OutInlineFragment = {
  kind: "inlineFragment";
  typeCondition: string;
  selections: OutSelection;
};

type OutObject = {
  kind: "object";
  description?: Maybe<string>;
  namedFragments: string[];
  inlineFragments: OutInlineFragment[];
  selections: OutSelection;
};

type OutArray = {
  kind: "array";
  description?: Maybe<string>;
  type: OutType;
};

type OutScalar = {
  kind: "scalar";
  description?: Maybe<string>;
  type: string;
};

type OutType = OutEnum | OutObject | OutArray | OutScalar;

const scalarMap: Record<string, OutType> = {
  String: { kind: "scalar", type: "string" },
  ID: { kind: "scalar", type: "string" },
  Int: { kind: "scalar", type: "number" },
  Float: { kind: "scalar", type: "number" },
  Boolean: { kind: "scalar", type: "boolean" },
  GitHubGitObjectID: { kind: "scalar", type: "string" },
  GitHubURI: { kind: "scalar", type: "string" },
  // JSON: "JSON",
};

export function gatherAllReferencedTypes(
  schema: GraphQLSchema,
  query: OperationDefinitionNode
): Array<string> {
  const types = new Set<string>([]);
  const typeInfo = new TypeInfo(schema);
  visit(
    query,
    visitWithTypeInfo(typeInfo, {
      enter: () => {
        const fullType = typeInfo.getType();
        if (!!fullType) {
          const typ = getNamedType(fullType);
          if (typ) types.add(typ.name.toLocaleLowerCase().replace("oneme", ""));
        }
      },
    })
  );

  const result = Array.from(types);
  return result;
}

function unwrapOutputType(outputType: GraphQLType): GraphQLType {
  let unwrappedType = outputType;
  while (isWrappingType(unwrappedType)) {
    unwrappedType = unwrappedType.ofType;
  }
  return unwrappedType;
}

export function gatherVariableDefinitions(
  definition: OperationDefinitionNode
): Array<[string, string]> {
  const extract = (varDef: VariableDefinitionNode): [string, string] => [
    varDef.variable.name.value,
    print(varDef.type),
  ];

  return (definition?.variableDefinitions?.map(extract) || []).sort(
    ([a], [b]) => a.localeCompare(b)
  );
}

export function typeScriptForGraphQLType(
  schema: GraphQLSchema,
  gqlType: GraphQLType
): string {
  let scalarMap = {
    String: "string",
    ID: "string",
    Int: "number",
    Float: "number",
    Boolean: "boolean",
    GitHubURI: "string",
    GitHubTimestamp: "string",
  };

  if (isListType(gqlType)) {
    let subType = typeScriptForGraphQLType(schema, gqlType.ofType);
    return `Array<${subType}>`;
  } else if (isObjectType(gqlType) || isInputObjectType(gqlType)) {
    let fields = Object.values(gqlType.getFields()).map((field) => {
      let nullable = !isNonNullType(field.type);
      let type = typeScriptForGraphQLType(schema, field.type);
      const description = !!field.description
        ? `/**
  * ${field.description}
  */
  `
        : "";

      return `${description}"${field.name}"${nullable ? "?" : ""}: ${type}`;
    });

    if (fields.length > 0) {
      return `{${fields.join("; ")}}`;
    } else {
      return "Record<string, unknown> /* typeScriptForGraphQLType */";
    }
  } else if (isWrappingType(gqlType)) {
    return typeScriptForGraphQLType(schema, gqlType.ofType);
  } else if (isEnumType(gqlType)) {
    let values = gqlType.getValues();

    let enums = values.map((enumValue) => `"${enumValue.value}"`);

    return enums.join(" | ");
  } else {
    let namedType = getNamedType(gqlType);
    let basicType = scalarMap[namedType?.name] || "unknown";

    return basicType;
  }
}

export function typeScriptSignatureForOperationVariables(
  variableNames: Array<string>,
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode
) {
  const helper: (
    variableDefinition: VariableDefinitionNode
  ) => [string, VariableDefinitionNode] = (
    variableDefinition: VariableDefinitionNode
  ) => {
    let variableName = variableDefinition.variable.name.value;

    const result: [string, VariableDefinitionNode] = [
      variableName,
      variableDefinition,
    ];
    return result;
  };

  let variables: Array<[string, VariableDefinitionNode]> = (
    operationDefinition.variableDefinitions || []
  )
    .map(helper)
    .filter(([variableName]) => {
      return variableNames.includes(variableName);
    });

  let typesObject: [string, string][] = variables
    .map(([varName, varDef]) => {
      let printedType = print(varDef.type);
      let parsedType = parseType(printedType);
      let gqlType = typeFromAST(schema, parsedType);

      if (!gqlType) {
        return;
      }

      let tsType = typeScriptForGraphQLType(schema, gqlType);

      return [varName, tsType];
    })
    .filter(Boolean) as [string, string][];

  let typeFields = typesObject
    .map(([name, tsType]) => `"${name}": ${tsType}`)
    .join("; ");

  let types = `{${typeFields}}`;

  return types === "" ? "null" : types;
}

export function listCount(gqlType) {
  let inspectedType = gqlType;

  let listCount = 0;

  let totalCount = 0;
  while (isWrappingType(inspectedType)) {
    if (isListType(inspectedType)) {
      listCount = listCount + 1;
    }

    totalCount = totalCount + 1;

    if (totalCount > 30) {
      console.warn("Bailing on potential infinite recursion");
      return -99;
    }

    inspectedType = inspectedType.ofType;
  }

  return listCount;
}

const unknownScalar: OutScalar = { kind: "scalar", type: "unknown" };

export function typeScriptDefinitionObjectForOperation(
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode | FragmentDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>,
  shouldLog = true
): OutObject {
  const dummyOut: OutObject = {
    kind: "object",
    namedFragments: [],
    inlineFragments: [],
    selections: {
      data: {
        kind: "selection_field",
        name: "data",
        description:
          "Any data retrieved by the function will be returned here [Placeholder]",
        type: {
          kind: "scalar",
          type: "Record<string, unknown>",
        },
      },
      errors: {
        kind: "selection_field",
        name: "errors",
        description:
          "Any errors in the function will be returned here [Placeholder]",
        type: {
          kind: "array",
          type: {
            kind: "scalar",
            type: "GraphQLError",
          },
        },
      },
    },
  };

  const objectHelper = (
    type: GraphQLObjectType<any, any> | GraphQLInterfaceType | GraphQLUnionType,
    selectionSet: SelectionSetNode
  ): OutObject | undefined => {
    let inlineFragments: OutInlineFragment[] = [];
    let namedFragments: string[] = [];
    let selections: OutSelection = {};

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push(fragmentName);
        }
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        const typeCondition = selection.typeCondition;
        if (!typeCondition) {
          return;
        }

        const typeConditionName = typeCondition.name.value;

        const fragmentGqlType = typeFromAST(schema, typeCondition);

        if (!fragmentGqlType || !isObjectType(fragmentGqlType)) {
          return;
        }

        const fragmentSelectionAsObject: OutObject | undefined = objectHelper(
          fragmentGqlType,
          selection.selectionSet
        );

        if (!fragmentSelectionAsObject) {
          return;
        }

        const fragmentSelections = fragmentSelectionAsObject.selections;

        const inlineFragment: OutInlineFragment = {
          kind: "inlineFragment",
          typeCondition: typeConditionName,
          selections: fragmentSelections,
        };

        inlineFragments.push(inlineFragment);
      } else if (selection.kind === Kind.FIELD) {
        let parentNamedType = getNamedType(type);

        let alias = selection.alias?.value;
        let name = selection.name.value;
        let displayedName = alias || name;

        if (name.startsWith("__")) {
          return {
            kind: "object",
            namedFragments: [],
            inlineFragments: [],
            selections: {
              displayedName: {
                kind: "scalar",
                description: "Internal GraphQL field",
                type: "unknown",
              },
            },
          };
        }

        let field =
          (isObjectType(parentNamedType) || isInterfaceType(parentNamedType)) &&
          parentNamedType.getFields()[name];

        if (!field) {
          console.warn(
            "Could not find field",
            name,
            "in",
            // @ts-ignore
            Object.keys(parentNamedType.getFields())
          );
          return;
        }

        let gqlType = field.type;
        let namedType = getNamedType(gqlType);

        const subSelectionSet = selection.selectionSet;

        if (isWrappingType(gqlType)) {
          const value = helper(
            gqlType,
            subSelectionSet || {
              kind: Kind.SELECTION_SET,
              selections: [],
            }
          );
          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              description: field.description,
              type: value,
            };
          }
        } else if (isScalarType(namedType)) {
          const scalar = scalarHelper(namedType);
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            description: field.description,
            type: scalar,
          };
        } else if (isEnumType(namedType)) {
          const dummySelectionSet: SelectionSetNode = {
            kind: Kind.SELECTION_SET,
            selections: [],
          };

          const value = helper(gqlType, dummySelectionSet);
          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              description: field.description,
              type: value,
            };
          }
        } else if (subSelectionSet) {
          const value = helper(gqlType, selection.selectionSet);

          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              description: field.description,
              type: value,
            };
          }
        }
      } else {
        console.warn("objectHelper got a non-field selection", selection);
      }
    });

    const final: OutObject = {
      kind: "object",
      namedFragments,
      inlineFragments,
      selections,
    };

    return final;
  };

  const arrayHelper = (
    type: GraphQLList<any>,
    selectionSet: SelectionSetNode
  ): OutArray | undefined => {
    const parentType = isListType(type) && type.ofType;

    if (!parentType) {
      return;
    }

    const subType = helper(parentType, selectionSet);

    if (!subType) {
      return;
    }

    const final: OutArray = {
      kind: "array",
      type: subType,
    };

    return final;
  };

  const scalarHelper = (parentGqlType: GraphQLScalarType) => {
    let scalarType = parentGqlType;
    let scalarName = scalarType.name;
    let scalar = scalarMap[scalarName];
    if (!scalar) {
      scalar = unknownScalar;
    }

    return scalar;
  };

  let helper = (
    parentGqlType: GraphQLType,
    selectionSet: SelectionSetNode
  ): OutType | undefined => {
    if (isListType(parentGqlType)) {
      return arrayHelper(parentGqlType, selectionSet);
    } else if (isWrappingType(parentGqlType) && isNonNullType(parentGqlType)) {
      return helper(parentGqlType.ofType, selectionSet);
    } else if (isObjectType(parentGqlType)) {
      return objectHelper(parentGqlType, selectionSet);
    } else if (isInterfaceType(parentGqlType)) {
      return objectHelper(parentGqlType, selectionSet);
    } else if (isScalarType(parentGqlType)) {
      return scalarHelper(parentGqlType);
    } else if (isEnumType(parentGqlType)) {
      let values = parentGqlType
        .getValues()
        .map((enumValue) => `"${enumValue.value}"`);

      const outEnum: OutEnum = {
        kind: "enum",
        values: values,
      };

      return outEnum;
    } else {
      console.warn("Unrecognized type in operation", parentGqlType);
    }
  };

  let baseGqlType = (
    operationDefinition.kind === Kind.OPERATION_DEFINITION
      ? operationDefinition.operation === "query"
        ? schema.getQueryType()
        : operationDefinition.operation === "mutation"
        ? schema.getMutationType()
        : operationDefinition.operation === "subscription"
        ? schema.getSubscriptionType()
        : null
      : operationDefinition.kind === Kind.FRAGMENT_DEFINITION
      ? schema.getType(operationDefinition.typeCondition.name.value)
      : null
  ) as GraphQLType | null;

  let selections = operationDefinition.selectionSet;

  let sub: OutType | undefined;

  if (baseGqlType) {
    sub = helper(baseGqlType, selections);
  } else {
    return dummyOut;
  }

  if (sub && sub.kind === "object") {
    const result: OutObject = {
      kind: "object",
      namedFragments: [],
      inlineFragments: [],
      selections: {
        data: {
          kind: "selection_field",
          name: "data",
          description: "Any data from the function will be returned here",
          type: sub,
        },
        errors: {
          kind: "selection_field",
          name: "errors",
          description: "Any errors from the function will be returned here",
          type: {
            kind: "array",
            type: {
              kind: "scalar",
              type: "GraphQLError",
            },
          },
        },
      },
    };

    return result;
  } else {
    return dummyOut;
  }
}

const printObject = (obj: OutObject): string => {
  const fieldSelections = obj.selections;

  const fieldSelectionCount = Object.keys(obj.selections).length;

  const fields = Object.values(fieldSelections)
    .map((fieldSelection) => {
      const fields = printOut(fieldSelection.type);
      const value = fields;
      const description = !!fieldSelection.description
        ? `/**
  * ${fieldSelection.description}
  */
`
        : "";

      return `${description}${fieldSelection.name}: ${value};`;
    })
    .join("\n  ");

  let value;

  if (
    fieldSelectionCount === 0 &&
    obj.namedFragments.length === 0 &&
    obj.inlineFragments.length === 0
  ) {
    value =
      "/** No fields, named fragments, or inline fragments found */ Record<string, unknown>";
  } else if (
    obj.namedFragments.length === 0 &&
    obj.inlineFragments.length === 0
  ) {
    value = `{
  ${fields}
}`;
  } else if (fieldSelectionCount === 0) {
    value = obj.namedFragments.join(" & ");
  } else {
    const subFields =
      fieldSelectionCount > 0
        ? `& {
  ${fields}
}`
        : "";
    value = `${obj.namedFragments.join(" & ")} ${subFields}`;
  }

  return value;
};

const printArray = (out: OutArray): string => {
  const value = printOut(out.type);
  return `Array<${value}>`;
};

const printOut = (out: OutType): string => {
  if (out.kind === "scalar") {
    return out.type;
  } else if (out.kind === "object") {
    return printObject(out);
  } else if (out.kind === "array") {
    return printArray(out);
  } else if (out.kind === "enum") {
    return out.values.join(" | ");
  }

  return "whoops";
};

export function typeScriptSignatureForOperation(
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
) {
  let typeMap = typeScriptDefinitionObjectForOperation(
    schema,
    operationDefinition,
    fragmentDefinitions
  );

  const typeScript = printObject(typeMap);

  return typeScript;
}

export function typeScriptDefinitionObjectForFragment(
  schema: GraphQLSchema,
  fragmentDefinition: FragmentDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>,
  shouldLog = true
) {
  const dummyOut: OutScalar = {
    kind: "scalar",
    type: "Record<string, unknown>",
    description: "Fragment data unavailable when generating types",
  };

  const objectHelper = (
    type: GraphQLObjectType<any, any> | GraphQLInterfaceType | GraphQLUnionType,
    selectionSet: SelectionSetNode
  ): OutObject | undefined => {
    let inlineFragments: OutInlineFragment[] = [];
    let namedFragments: string[] = [];
    let selections: OutSelection = {};

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push(fragmentName);
        }
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        const typeCondition = selection.typeCondition;
        if (!typeCondition) {
          return;
        }

        const typeConditionName = typeCondition.name.value;

        const fragmentGqlType = typeFromAST(schema, typeCondition);

        if (!fragmentGqlType || !isObjectType(fragmentGqlType)) {
          return;
        }

        const fragmentSelectionAsObject: OutObject | undefined = objectHelper(
          fragmentGqlType,
          selection.selectionSet
        );

        if (!fragmentSelectionAsObject) {
          return;
        }

        const fragmentSelections = fragmentSelectionAsObject.selections;

        const inlineFragment: OutInlineFragment = {
          kind: "inlineFragment",
          typeCondition: typeConditionName,
          selections: fragmentSelections,
        };

        inlineFragments.push(inlineFragment);
      } else if (selection.kind === Kind.FIELD) {
        let parentNamedType = getNamedType(type);

        let alias = selection.alias?.value;
        let name = selection.name.value;
        let displayedName = alias || name;

        let field =
          (isObjectType(parentNamedType) || isInterfaceType(parentNamedType)) &&
          parentNamedType.getFields()[name];

        if (!field) {
          console.warn(
            "Could not find field",
            name,
            "on",
            parentNamedType.name,
            "among",
            // @ts-ignore
            Object.keys(parentNamedType.getFields())
          );
          return;
        }

        if (name.startsWith("__")) {
          return {
            kind: "object",
            namedFragments: [],
            inlineFragments: [],
            selections: {
              displayedName: {
                kind: "scalar",
                description: "Internal GraphQL field",
                type: "unknown",
              },
            },
          };
        }

        let gqlType = field.type;
        let namedType = getNamedType(gqlType);

        const subSelectionSet = selection.selectionSet;

        if (isWrappingType(gqlType)) {
          const value = helper(
            gqlType,
            subSelectionSet || {
              kind: Kind.SELECTION_SET,
              selections: [],
            }
          );
          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              type: value,
              description: field.description,
            };
          }
        } else if (isScalarType(namedType)) {
          const scalar = scalarHelper(namedType);
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            type: scalar,
            description: field.description,
          };
        } else if (isEnumType(namedType)) {
          const dummySelectionSet: SelectionSetNode = {
            kind: Kind.SELECTION_SET,
            selections: [],
          };

          const value = helper(gqlType, dummySelectionSet);
          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              type: value,
              description: field.description,
            };
          }
        } else if (subSelectionSet) {
          const value = helper(gqlType, selection.selectionSet);

          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              type: value,
              description: field.description,
            };
          }
        }
      } else {
        console.warn("objectHelper got a non-field selection", selection);
      }
    });

    const final: OutObject = {
      kind: "object",
      namedFragments,
      inlineFragments,
      selections,
    };

    return final;
  };

  const arrayHelper = (
    type: GraphQLList<any>,
    selectionSet: SelectionSetNode
  ): OutArray | undefined => {
    const parentType = isListType(type) && type.ofType;

    if (!parentType) {
      return;
    }

    const subType = helper(parentType, selectionSet);

    if (!subType) {
      return;
    }

    const final: OutArray = {
      kind: "array",
      type: subType,
    };

    return final;
  };

  const scalarHelper = (parentGqlType: GraphQLScalarType) => {
    let scalarType = parentGqlType;
    let scalarName = scalarType.name;
    let scalar = scalarMap[scalarName];
    if (!scalar) {
      scalar = unknownScalar;
    }

    return scalar;
  };

  let helper = (
    parentGqlType: GraphQLType,
    selectionSet: SelectionSetNode
  ): OutType | undefined => {
    if (isListType(parentGqlType)) {
      return arrayHelper(parentGqlType, selectionSet);
    } else if (isWrappingType(parentGqlType) && isNonNullType(parentGqlType)) {
      return helper(parentGqlType.ofType, selectionSet);
    } else if (isObjectType(parentGqlType)) {
      return objectHelper(parentGqlType, selectionSet);
    } else if (isInterfaceType(parentGqlType)) {
      return objectHelper(parentGqlType, selectionSet);
    } else if (isScalarType(parentGqlType)) {
      return scalarHelper(parentGqlType);
    } else if (isEnumType(parentGqlType)) {
      let values = parentGqlType
        .getValues()
        .map((enumValue) => `"${enumValue.value}"`);

      const outEnum: OutEnum = {
        kind: "enum",
        values: values,
      };

      return outEnum;
    } else {
      console.warn("Unrecognized type in fragment", parentGqlType);
    }
  };

  let baseGqlType = schema.getType(fragmentDefinition.typeCondition.name.value);

  let selections = fragmentDefinition.selectionSet;

  let sub: OutType | undefined;

  if (baseGqlType) {
    sub = helper(baseGqlType, selections);
  } else {
    return dummyOut;
  }

  if (sub && sub.kind === "object") {
    const result: OutObject = sub;

    return result;
  } else {
    return dummyOut;
  }
}

export function typeScriptSignatureForFragment(
  schema: GraphQLSchema,
  fragmentDefinition: FragmentDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
) {
  let typeMap = typeScriptDefinitionObjectForFragment(
    schema,
    fragmentDefinition,
    fragmentDefinitions
  );

  const typeScript = printOut(typeMap);

  return typeScript;
}

export function typeScriptTypeNameForOperation(name: string) {
  return `${capitalizeFirstLetter(name)}Payload`;
}

/**
 * Doesn't patch e.g. fragments
 */
export function patchSubscriptionWebhookField({
  schema,
  definition,
}: {
  schema: GraphQLSchema;
  definition: OperationDefinitionNode;
}): OperationDefinitionNode {
  if (definition.operation !== "subscription") {
    return definition;
  }

  const subscriptionType = schema.getSubscriptionType();

  if (!subscriptionType) {
    return definition;
  }

  const newSelections: SelectionNode[] = definition.selectionSet.selections.map(
    (selection) => {
      if (selection.kind !== "Field") return selection;

      const field = subscriptionType.getFields()[selection.name.value];
      if (!field) {
        return selection;
      }
      const fieldHasWebhookUrlArg = field.args.some(
        (arg) => arg.name === "webhookUrl"
      );
      const selectionHasWebhookUrlArg = selection.arguments?.some(
        (arg) => arg.name.value === "webhookUrl"
      );

      if (fieldHasWebhookUrlArg && !selectionHasWebhookUrlArg) {
        return {
          ...selection,
          arguments: [
            ...(selection.arguments || []),
            {
              kind: Kind.ARGUMENT,
              name: {
                kind: Kind.NAME,
                value: "webhookUrl",
              },
              value: {
                kind: Kind.VARIABLE,
                name: {
                  kind: Kind.NAME,
                  value: "netlifyGraphWebhookUrl",
                },
              },
            },
          ],
        };
      }

      return selection;
    }
  );

  const hasWebhookVariableDefinition = definition.variableDefinitions?.find(
    (varDef) => varDef.variable.name.value === "netlifyGraphWebhookUrl"
  );

  const netlifyGraphWebhookUrlVariable: VariableDefinitionNode = {
    kind: Kind.VARIABLE_DEFINITION,
    type: {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "String",
        },
      },
    },
    variable: {
      kind: Kind.VARIABLE,
      name: {
        kind: Kind.NAME,
        value: "netlifyGraphWebhookUrl",
      },
    },
  };

  const variableDefinitions = !!hasWebhookVariableDefinition
    ? definition.variableDefinitions
    : [
        ...(definition.variableDefinitions || []),
        netlifyGraphWebhookUrlVariable,
      ];

  return {
    ...definition,
    variableDefinitions,
    selectionSet: { ...definition.selectionSet, selections: newSelections },
  };
}

export function patchSubscriptionWebhookSecretField({
  schema,
  definition,
}: {
  schema: GraphQLSchema;
  definition: OperationDefinitionNode;
}): OperationDefinitionNode {
  if (definition.operation !== "subscription") {
    return definition;
  }

  const subscriptionType = schema.getSubscriptionType();

  if (!subscriptionType) {
    return definition;
  }

  const newSelections: SelectionNode[] = definition.selectionSet.selections.map(
    (selection) => {
      if (selection.kind !== "Field") return selection;

      const field = subscriptionType.getFields()[selection.name.value];
      if (!field) {
        return selection;
      }

      const fieldHasWebhookSecretArg = field.args.some(
        (arg) => arg.name === "secret"
      );
      const selectionHasWebhookSecretArg = selection.arguments?.some(
        (arg) => arg.name.value === "secret"
      );

      if (fieldHasWebhookSecretArg && !selectionHasWebhookSecretArg) {
        return {
          ...selection,
          arguments: [
            ...(selection.arguments || []),
            {
              kind: Kind.ARGUMENT,
              name: {
                kind: Kind.NAME,
                value: "secret",
              },
              value: {
                kind: Kind.VARIABLE,
                name: {
                  kind: Kind.NAME,
                  value: "netlifyGraphWebhookSecret",
                },
              },
            },
          ],
        };
      }

      return selection;
    }
  );

  const hasWebhookVariableDefinition = definition.variableDefinitions?.find(
    (varDef) => varDef.variable.name.value === "netlifyGraphWebhookSecret"
  );

  const netlifyGraphWebhookUrlVariable: VariableDefinitionNode = {
    kind: Kind.VARIABLE_DEFINITION,
    type: {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: "OneGraphSubscriptionSecretInput",
        },
      },
    },
    variable: {
      kind: Kind.VARIABLE,
      name: {
        kind: Kind.NAME,
        value: "netlifyGraphWebhookSecret",
      },
    },
  };

  const variableDefinitions = !!hasWebhookVariableDefinition
    ? definition.variableDefinitions
    : [
        ...(definition.variableDefinitions || []),
        netlifyGraphWebhookUrlVariable,
      ];

  return {
    ...definition,
    variableDefinitions,
    selectionSet: { ...definition.selectionSet, selections: newSelections },
  };
}

const addLeftWhitespace = (string, padding) => {
  const paddingString = " ".repeat(padding);

  return string
    .split("\n")
    .map((line) => paddingString + line)
    .join("\n");
};

export const formInput = (schema, def, path = []) => {
  const name = def.variable.name.value;

  function helper(path, type, subfield) {
    const isList = isListType(type);

    const namedType = getNamedType(type);
    const isEnum = isEnumType(namedType);
    const isObject = isInputObjectType(namedType);
    const isScalar = isScalarType(namedType);

    const subfieldName = subfield && subfield.name;
    let subDataEl;

    if (isList) {
      return helper([...path, 0], namedType, undefined);
    } else if (isObject) {
      // $FlowFixMe: we check this with `isObject` already
      const subFields = namedType.getFields();

      if (!subFields) {
        return "MISSING_SUBFIELDS";
      }

      const subFieldEls = Object.keys(subFields)
        .map((fieldName) => {
          const currentField = subFields[fieldName];

          const subPath = [...path, fieldName];
          const currentFieldInput = helper(
            subPath,
            currentField.type,
            currentField
          );

          return currentFieldInput;
        })
        .join("\n");

      return `<label>${def.variable.name.value}</label>
  <fieldset>
  ${addLeftWhitespace(subFieldEls, 2)}
  </fieldset>`;
    } else if (isScalar) {
      let coerceFn;
      let inputAttrs;

      // $FlowFixMe: we check this with `isScalar` already
      switch (namedType.name) {
        case "String":
          coerceFn = "(value) => value";
          inputAttrs = [["type", "text"]];
          break;
        case "Float":
          coerceFn =
            "(value) => try {return parseFloat(value)} catch (e) { return 0.0 }";
          inputAttrs = [
            ["type", "number"],
            ["step", "0.1"],
          ];
          break;
        case "Int":
          coerceFn =
            "(value) => {try {return parseInt(value, 10)} catch (e) { return 0 }}";
          inputAttrs = [["type", "number"]];
          break;
        case "Boolean":
          coerceFn = '(value) => value === "true"';
          inputAttrs = [["type", "text"]];
          break;
        default:
          coerceFn = "(value) => value";
          inputAttrs = [["type", "text"]];
          break;
      }

      const updateFunction = `updateFormVariables(setFormVariables, ${JSON.stringify(
        path
      )}, ${coerceFn})`;
      subDataEl = `<label htmlFor="${path.join("-")}">${
        subfieldName || def.variable.name.value
      }</label><input id="${path.join("-")}" ${inputAttrs
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ")} onChange={${updateFunction}} />`;
    } else if (isEnum) {
      const updateFunction = `updateFormVariables(setFormVariables, ${JSON.stringify(
        path
      )}, (value) => value)`;

      const selectOptions = namedType
        // $FlowFixMe: we check this with `isEnum` already
        .getValues()
        .map((gqlEnum) => {
          const enumValue = gqlEnum.value;
          const enumDescription = !!gqlEnum.description
            ? `: ${gqlEnum.description}`
            : "";
          return `<option value="${enumValue}">${gqlEnum.name}${enumDescription}</option>`;
        })
        .join(" ");

      subDataEl = `<label htmlFor="${path.join("-")}">${
        def.variable.name.value
      }</label><select id="${path.join(
        "-"
      )}" onChange={${updateFunction}}> ${selectOptions} </select>`;
    } else {
      return "UNKNOWN_GRAPHQL_TYPE_FOR_INPUT";
    }

    return subDataEl;
  }

  const hydratedType = typeFromAST(schema, def.type);
  if (!hydratedType) {
    console.warn("\tCould not hydrate type for ", def.type);
    return null;
  }
  // const required = isNonNullType(hydratedType);

  const formEl = helper([name], hydratedType, undefined);

  return `${formEl}`;
};

export const remixFormInput = (schema, def, path = []) => {
  const name = def.variable.name.value;

  function helper(path, type, subfield) {
    const isList = isListType(type);

    const namedType = getNamedType(type);
    const isEnum = isEnumType(namedType);
    const isObject = isInputObjectType(namedType);
    const isScalar = isScalarType(namedType);

    const subfieldName = subfield && subfield.name;
    let subDataEl;

    if (isList) {
      return helper([...path, 0], namedType, undefined);
    } else if (isObject) {
      // $FlowFixMe: we check this with `isObject` already
      const subFields = namedType.getFields();

      if (!subFields) {
        return "MISSING_SUBFIELDS";
      }

      const subFieldEls = Object.keys(subFields)
        .map((fieldName) => {
          const currentField = subFields[fieldName];

          const subPath = [...path, fieldName];
          const currentFieldInput = helper(
            subPath,
            currentField.type,
            currentField
          );

          return currentFieldInput;
        })
        .join("\n");

      return `<label>${def.variable.name.value}</label>
  <fieldset>
  ${addLeftWhitespace(subFieldEls, 2)}
  </fieldset>`;
    } else if (isScalar) {
      let coerceFn;
      let inputAttrs;

      switch (namedType.name) {
        case "String":
          coerceFn = "(value) => value";
          inputAttrs = [["type", "text"]];
          break;
        case "Float":
          coerceFn =
            "(value) => try {return parseFloat(value)} catch (e) { return 0.0 }";
          inputAttrs = [
            ["type", "number"],
            ["step", "0.1"],
          ];
          break;
        case "Int":
          coerceFn =
            "(value) => {try {return parseInt(value, 10)} catch (e) { return 0 }}";
          inputAttrs = [["type", "number"]];
          break;
        case "Boolean":
          coerceFn = '(value) => value === "true"';
          inputAttrs = [["type", "text"]];
          break;
        default:
          coerceFn = "(value) => value";
          inputAttrs = [["type", "text"]];
          break;
      }
      subDataEl = `<label htmlFor="${path.join("-")}">${
        subfieldName || def.variable.name.value
      }</label><input id="${path.join("-")}" name="${path.join(
        "-"
      )}" ${inputAttrs
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ")} />`;
    } else if (isEnum) {
      const selectOptions = namedType
        .getValues()
        .map((gqlEnum) => {
          const enumValue = gqlEnum.value;
          const enumDescription = !!gqlEnum.description
            ? `: ${gqlEnum.description}`
            : "";
          return `<option value="${enumValue}">${gqlEnum.name}${enumDescription}</option>`;
        })
        .join(" ");

      subDataEl = `<label htmlFor="${path.join("-")}">${
        def.variable.name.value
      }</label><select id="${path.join("-")}" name="${path.join(
        "-"
      )}"> ${selectOptions} </select>`;
    } else {
      return "UNKNOWN_GRAPHQL_TYPE_FOR_INPUT";
    }

    return subDataEl;
  }

  const hydratedType = typeFromAST(schema, def.type);
  if (!hydratedType) {
    console.warn("\tCould not hydrate type for ", def.type);
    return null;
  }
  // const required = isNonNullType(hydratedType);

  const formEl = helper([name], hydratedType, undefined);

  return `${formEl}`;
};

export const formElComponent = ({
  operationData,
  schema,
  callFn,
}: {
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
      const genInput = formInput(schema, def, []);

      const input =
        genInput || `UNABLE_TO_GENERATE_FORM_INPUT_FOR_GRAPHQL_TYPE(${def})`;
      return `${input}`;
    }
  );

  return {
    formHelpers: `const [formVariables, setFormVariables] = React.useState({});`,
    formEl: `<form onSubmit={event => { event.preventDefault(); ${callFn} }}>
  ${addLeftWhitespace(els.join("\n"), 2)}
    <input type="submit" />
  </form>`,
  };
};

const makeInputValueDefinitionNode = ({
  name,
  baseKind,
  optional,
  description,
}: {
  name: string;
  baseKind: string;
  optional: boolean;
  description: string;
}): InputValueDefinitionNode => {
  const baseType: NamedTypeNode = {
    kind: Kind.NAMED_TYPE,
    name: {
      kind: Kind.NAME,
      value: baseKind,
    },
  };
  const type: NamedTypeNode | NonNullTypeNode = optional
    ? baseType
    : { kind: Kind.NON_NULL_TYPE, type: baseType };

  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    name: {
      kind: Kind.NAME,
      value: name,
    },
    type: type,
    directives: [],
    description: {
      kind: Kind.STRING,
      block: true,
      value: description,
    },
  };
};

const netlifyDirective: DirectiveDefinitionNode = {
  kind: Kind.DIRECTIVE_DEFINITION,
  description: {
    kind: Kind.STRING,
    value: "An internal directive used by Netlify Graph",
    block: true,
  },
  name: {
    kind: Kind.NAME,
    value: "netlify",
  },
  arguments: [
    makeInputValueDefinitionNode({
      name: "id",
      baseKind: "String",
      optional: false,
      description: "The uuid of the operation (normally auto-generated)",
    }),
    makeInputValueDefinitionNode({
      name: "doc",
      baseKind: "String",
      optional: true,
      description: "The docstring for this operation",
    }),
  ],
  repeatable: false,
  locations: [
    {
      kind: Kind.NAME,
      value: "QUERY",
    },
    {
      kind: Kind.NAME,
      value: "MUTATION",
    },
    {
      kind: Kind.NAME,
      value: "SUBSCRIPTION",
    },
    {
      kind: Kind.NAME,
      value: "FRAGMENT_DEFINITION",
    },
  ],
};

export const normalizeOperationsDoc = (operationsDoc: string) => {
  const parsedOperations = parse(operationsDoc);

  const fragments: FragmentDefinitionNode[] = [];
  const operations: OperationDefinitionNode[] = [];

  const sortedDefinitions = [...parsedOperations.definitions].sort((a, b) => {
    const aName: string =
      (a.kind === Kind.OPERATION_DEFINITION
        ? a.name?.value
        : a.kind === Kind.FRAGMENT_DEFINITION
        ? a.name.value
        : null) || "__unknownDefinition";
    const bName: string =
      (b.kind === Kind.OPERATION_DEFINITION
        ? b.name?.value
        : b.kind === Kind.FRAGMENT_DEFINITION
        ? b.name.value
        : null) || "__unknownDefinition";

    return aName.localeCompare(bName);
  });

  for (const definition of sortedDefinitions) {
    const definitionWithNormalizedStrings = visit(definition, {
      StringValue: {
        enter(node) {
          const hasNewlines = node.value.match(/\n/);
          return {
            ...node,
            block: hasNewlines ? true : node.block,
          };
        },
      },
    });

    if (definitionWithNormalizedStrings.kind === Kind.OPERATION_DEFINITION) {
      operations.push(definitionWithNormalizedStrings);
    } else if (
      definitionWithNormalizedStrings.kind === Kind.FRAGMENT_DEFINITION
    ) {
      fragments.push(definitionWithNormalizedStrings);
    }
  }

  const netlifyDirectiveString = print(netlifyDirective);

  const fragmentStrings = fragments.map((fragment) => {
    return print(fragment);
  });

  const operationStrings = operations.map((operation) => {
    return print(operation);
  });

  const fullDoc =
    [netlifyDirectiveString, ...fragmentStrings, ...operationStrings].join(
      "\n\n"
    ) + "\n";

  return fullDoc;
};
