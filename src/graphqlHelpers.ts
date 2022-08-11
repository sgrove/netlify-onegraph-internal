import * as GraphQLPackage from "graphql";
import type {
  GraphQLSchema,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  GraphQLType,
  ArgumentNode,
  ASTVisitFn,
  DocumentNode,
  FragmentSpreadNode,
  GraphQLInputField,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  ObjectFieldNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";

import { OperationData } from "./codegen/codegenHelpers";
import { internalConsole } from "./internalConsole";

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
  isNullable: boolean;
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
  namedFragments: { name: string; typeCondition: string }[];
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

type OutUnion = {
  kind: "union";
  typenameFields: string[];
  description?: Maybe<string>;
  objects: (OutObject & { __typename: string })[];
  namedFragments: { name: string; typeCondition: string }[];
};

type OutInterface = {
  kind: "interface";
  description?: Maybe<string>;
  namedFragments: { name: string; typeCondition: string }[];
  inlineFragments: OutInlineFragment[];
  selections: OutSelection;
};

type OutType =
  | OutEnum
  | OutObject
  | OutArray
  | OutScalar
  | OutUnion
  | OutInterface;

const scalarMap: Record<string, OutType> = {
  ID: { kind: "scalar", type: "string" },
  Int: { kind: "scalar", type: "number" },
  Float: { kind: "scalar", type: "number" },
  String: { kind: "scalar", type: "string" },
  Boolean: { kind: "scalar", type: "boolean" },
  JSON: { kind: "scalar", type: "unknown" },
  JSONObject: { kind: "scalar", type: "Record<string, unknown>" },
  GitHubGitObjectID: { kind: "scalar", type: "string" },
  GitHubURI: { kind: "scalar", type: "string" },
};

export function gatherAllReferencedTypes(
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  query: OperationDefinitionNode
): Array<string> {
  const { getNamedType, TypeInfo, visit, visitWithTypeInfo } = GraphQL;

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

function unwrapOutputType(
  GraphQL: typeof GraphQLPackage,
  outputType: GraphQLType
): GraphQLType {
  const { isWrappingType } = GraphQL;
  let unwrappedType = outputType;
  while (isWrappingType(unwrappedType)) {
    unwrappedType = unwrappedType.ofType;
  }
  return unwrappedType;
}

export function gatherVariableDefinitions(
  GraphQL: typeof GraphQLPackage,
  definition: OperationDefinitionNode
): Array<[string, string]> {
  const { print } = GraphQL;

  const extract = (varDef: VariableDefinitionNode): [string, string] => [
    varDef.variable.name.value,
    print(varDef.type),
  ];

  return (definition?.variableDefinitions?.map(extract) || []).sort(
    ([a], [b]) => a.localeCompare(b)
  );
}

export function typeScriptForGraphQLType(
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  gqlType: GraphQLType
): string {
  const {
    getNamedType,
    isEnumType,
    isInputObjectType,
    isListType,
    isNonNullType,
    isObjectType,
    isWrappingType,
  } = GraphQL;

  let scalarMap = {
    String: "string",
    ID: "string",
    Int: "number",
    Float: "number",
    Boolean: "boolean",
    GitHubURI: "string",
    GitHubTimestamp: "string",
    JSONObject: "Record<string, unknown>",
  };

  if (isListType(gqlType)) {
    let subType = typeScriptForGraphQLType(GraphQL, schema, gqlType.ofType);
    return `Array<${subType}>`;
  } else if (isObjectType(gqlType) || isInputObjectType(gqlType)) {
    let fields = Object.values(gqlType.getFields()).map((field) => {
      let nullable = !isNonNullType(field.type);
      let type = typeScriptForGraphQLType(GraphQL, schema, field.type);
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
      return "Record<string, unknown> /* No fields found */";
    }
  } else if (isWrappingType(gqlType)) {
    return typeScriptForGraphQLType(GraphQL, schema, gqlType.ofType);
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

export const guessVariableDescriptions = (
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode,
  variableNames: string[]
): Record<
  string,
  {
    usageCount: number;
    descriptions?: Set<string>;
  }
> => {
  const {
    getNamedType,
    isInputObjectType,
    Kind,
    TypeInfo,
    visit,
    visitWithTypeInfo,
  } = GraphQL;

  const variableRecords: Record<
    string,
    { usageCount: number; descriptions?: Set<string> }
  > = {};

  for (let variableName of variableNames) {
    variableRecords[variableName] = {
      usageCount: 0,
      descriptions: new Set(),
    };
  }

  const typeInfo = new TypeInfo(schema);

  const argHandler: ASTVisitFn<ArgumentNode> = (node) => {
    if (node.value && node.value.kind === Kind.VARIABLE) {
      const argument = typeInfo.getArgument();
      const existingRecord = variableRecords[node.value.name.value];
      const existingDescription = existingRecord?.descriptions;

      if (existingDescription && argument?.description) {
        existingDescription.add(argument.description);
      }

      if (!existingRecord) {
        internalConsole.warn(
          `Undefined variable $${node.value.name.value} found in operation ${operationDefinition.name?.value}`
        );

        return node;
      }

      variableRecords[node.value.name.value] = {
        ...existingRecord,
        usageCount: existingRecord?.usageCount + 1,
      };
    }
    return node;
  };

  const objectFieldHandler: ASTVisitFn<ObjectFieldNode> = (node) => {
    if (node.value && node.value.kind === Kind.VARIABLE) {
      const parentType = typeInfo.getParentInputType();
      const namedParentType = getNamedType(parentType);

      let field: GraphQLInputField | undefined;

      if (isInputObjectType(namedParentType)) {
        field = namedParentType?.getFields()[node.name.value];

        const existingRecord = variableRecords[node.value.name.value];
        const existingDescription = existingRecord?.descriptions;

        if (existingDescription && field?.description) {
          existingDescription.add(field.description);
        }

        if (!existingRecord) {
          internalConsole.warn(
            `Undefined variable $${node.value.name.value} found in operation ${operationDefinition.name?.value}`
          );

          return node;
        }

        variableRecords[node.value.name.value] = {
          ...existingRecord,
          usageCount: existingRecord.usageCount + 1,
        };
      }

      return node;
    }
  };

  visit(
    operationDefinition,
    visitWithTypeInfo(typeInfo, {
      Argument: argHandler,
      ObjectField: objectFieldHandler,
    })
  );

  return variableRecords;
};

export function typeScriptSignatureForOperationVariables(
  GraphQL: typeof GraphQLPackage,
  variableNames: Array<string>,
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode
) {
  const { print, parseType, typeFromAST, isNonNullType } = GraphQL;

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

  const variableUsageInfo = guessVariableDescriptions(
    GraphQL,
    schema,
    operationDefinition,
    variableNames
  );

  let typesObject: [string, string, boolean][] = variables
    .map(([varName, varDef]) => {
      let printedType = print(varDef.type);
      let parsedType = parseType(printedType);
      let gqlType = typeFromAST(schema, parsedType);

      if (!gqlType) {
        return;
      }

      let isRequired = isNonNullType(gqlType);

      let tsType = typeScriptForGraphQLType(GraphQL, schema, gqlType);

      return [varName, tsType, isRequired];
    })
    .filter(Boolean) as [string, string, boolean][];

  let typeFields = typesObject
    .map(([name, tsType, isRequired]) => {
      const usageCount = variableUsageInfo[name].usageCount;
      const descriptions = variableUsageInfo[name].descriptions;
      let description = "";
      if (usageCount > 0 && descriptions?.size === 1) {
        description = ` /**
 * ${Array.from(descriptions)[0]}
 */
 `;
      }

      const optionalMark = isRequired ? "" : "?";

      return `${description}"${name}"${optionalMark}: ${tsType}`;
    })
    .join(";  \n");

  const formattedTypeFields =
    typeFields.trim() === ""
      ? ""
      : `
 ${typeFields}
`;

  let types = `{${formattedTypeFields}}`;

  return types === "" ? "null" : types;
}

export function listCount(GraphQL: typeof GraphQLPackage, gqlType) {
  const { isListType, isWrappingType } = GraphQL;

  let inspectedType = gqlType;

  let listCount = 0;

  let totalCount = 0;
  while (isWrappingType(inspectedType)) {
    if (isListType(inspectedType)) {
      listCount = listCount + 1;
    }

    totalCount = totalCount + 1;

    if (totalCount > 30) {
      internalConsole.warn("Bailing on potential infinite recursion");
      return -99;
    }

    inspectedType = inspectedType.ofType;
  }

  return listCount;
}

const unknownScalar: OutScalar = { kind: "scalar", type: "unknown" };

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
      isNullable: false,
      type: {
        kind: "scalar",
        type: "Record<string, unknown> /** Unable to find types for operation */",
      },
    },
    errors: {
      kind: "selection_field",
      name: "errors",
      description:
        "Any errors in the function will be returned here [Placeholder]",
      isNullable: true,
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

export function typeScriptDefinitionObjectForOperation(
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode | FragmentDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
): OutObject {
  const {
    getNamedType,
    isEnumType,
    isInterfaceType,
    isUnionType,
    isListType,
    isNonNullType,
    isNullableType,
    isObjectType,
    isScalarType,
    isWrappingType,
    Kind,
    typeFromAST,
  } = GraphQL;

  const unionHelper = (
    type: GraphQLUnionType,
    selectionSet: SelectionSetNode
  ): OutUnion | undefined => {
    let objects: (OutObject & { __typename: string })[] = [];
    let namedFragments: { name: string; typeCondition: string }[] = [];
    let typenameFields: string[] = [];

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push({
            name: fragmentName,
            typeCondition: definedFragment.typeCondition.name.value,
          });
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

        objects.push({
          ...fragmentSelectionAsObject,
          __typename: typeConditionName,
        });
      } else if (selection.kind === Kind.FIELD) {
        let alias = selection.alias?.value;
        let name = selection.name.value;
        let displayedName = alias || name;

        if (name === "__typename") {
          typenameFields.push(displayedName);
        }
      } else {
        internalConsole.warn(
          `unionHelper got a non-field selection: ${selection}`
        );
      }
    });

    const final: OutUnion = {
      kind: "union",
      description: type.description,
      objects: objects,
      namedFragments: namedFragments,
      typenameFields: typenameFields,
    };

    return final;
  };

  const interfaceHelper = (
    type: GraphQLInterfaceType,
    selectionSet: SelectionSetNode
  ): OutInterface | undefined => {
    let inlineFragments: OutInlineFragment[] = [];
    let namedFragments: { name: string; typeCondition: string }[] = [];
    let selections: OutSelection = {};

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push({
            name: fragmentName,
            typeCondition: definedFragment.typeCondition.name.value,
          });
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

        if (name === "__typename") {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: true,
            type: {
              kind: "scalar",
              type: "string",
            },
          };
          return;
        }

        if (name.startsWith("__")) {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: false,
            type: {
              kind: "scalar",
              description: "Internal GraphQL field",
              type: "unknown",
            },
          };
          return;
        }

        if (!field) {
          internalConsole.warn(
            `Could not find field ${name} on ${parentNamedType.name} among ${
              // @ts-ignore
              Object.keys(parentNamedType.getFields())
            }`
          );
          return;
        }

        let gqlType = field.type;
        let namedType = getNamedType(gqlType);
        const isNullable = isNullableType(gqlType);

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
              isNullable,
              description: field.description,
            };
          }
        } else if (isScalarType(namedType)) {
          const scalar = scalarHelper(namedType);
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            type: scalar,
            isNullable,
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
              isNullable,
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
              isNullable,
              description: field.description,
            };
          }
        }
      } else {
        internalConsole.warn(
          `interfaceHelper got a non-field selection ${selection}`
        );
      }
    });

    const final: OutInterface = {
      kind: "interface",
      namedFragments,
      inlineFragments,
      selections,
    };

    return final;
  };

  const objectHelper = (
    type: GraphQLObjectType<any, any> | GraphQLInterfaceType | GraphQLUnionType,
    selectionSet: SelectionSetNode
  ): OutObject | undefined => {
    let inlineFragments: OutInlineFragment[] = [];
    let namedFragments: { name: string; typeCondition: string }[] = [];
    let selections: OutSelection = {};

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push({
            name: fragmentName,
            typeCondition: definedFragment.typeCondition.name.value,
          });
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

        if (name === "__typename") {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: true,
            type: {
              kind: "scalar",
              type: "string",
            },
          };
        }

        if (name.startsWith("__")) {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: false,
            type: {
              kind: "scalar",
              description: "Internal GraphQL field",
              type: "unknown",
            },
          };
        }

        let field =
          (isObjectType(parentNamedType) || isInterfaceType(parentNamedType)) &&
          parentNamedType.getFields()[name];

        if (!field) {
          internalConsole.warn(
            `Could not find field ${name} in ${
              // @ts-ignore
              Object.keys(parentNamedType.getFields())
            }`
          );
          return;
        }

        let gqlType = field.type;
        let namedType = getNamedType(gqlType);
        const isNullable = isNullableType(gqlType);

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
              isNullable,
              type: value,
            };
          }
        } else if (isScalarType(namedType)) {
          const scalar = scalarHelper(namedType);
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            description: field.description,
            isNullable,
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
              isNullable,
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
              isNullable,
              type: value,
            };
          }
        }
      } else {
        internalConsole.warn(
          `objectHelper got a non-field selection ${selection}`
        );
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
      return interfaceHelper(parentGqlType, selectionSet);
    } else if (isUnionType(parentGqlType)) {
      return unionHelper(parentGqlType, selectionSet);
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
      internalConsole.warn(`Unrecognized type in operation ${parentGqlType}`);
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
          isNullable: false,
          type: sub,
        },
        errors: {
          kind: "selection_field",
          name: "errors",
          description: "Any errors from the function will be returned here",
          isNullable: true,
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

      return `${description}${fieldSelection.name}${
        fieldSelection.isNullable ? "?" : ""
      }: ${value};`;
    })
    .join("\n  ");

  let value;

  const modifiedInlineFragments = obj.inlineFragments.map((inlineFragment) => {
    const typenameSelection: OutSelectionFieldValue = {
      kind: "selection_field",
      name: "__typename",
      isNullable: true,
      type: {
        kind: "scalar",
        type: `"${inlineFragment.typeCondition}"`,
      },
      description:
        "Used to tell what type of object was returned for the selection",
    };

    return {
      ...inlineFragment,
      selections: {
        ...inlineFragment.selections,
        __typename: typenameSelection,
      },
    };
  });

  const printedInlineFragmentsBody = modifiedInlineFragments
    .map((inlineFragment) => {
      const fields = Object.values(inlineFragment.selections)
        .map((fieldSelection) => {
          const fields = printOut(fieldSelection.type);
          const value = fields;
          const description = !!fieldSelection.description
            ? `/**
    * ${fieldSelection.description}
    */
  `
            : "";

          return `${description}${fieldSelection.name}${
            fieldSelection.isNullable ? "?" : ""
          }: ${value};`;
        })
        .join("\n  ");

      return `{${fields}}`;
    })
    .join(" | ");

  const printedInlineFragments =
    modifiedInlineFragments.length === 0
      ? ""
      : ` | (${printedInlineFragmentsBody})`;

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
    value = `${obj.namedFragments
      .map(({ name }) => name)
      .join(" & ")} ${printedInlineFragments}`;
  } else {
    const subFields =
      fieldSelectionCount > 0
        ? `& {
  ${fields}
}`
        : "";
    value = `${obj.namedFragments
      .map(({ name }) => name)
      .join(" & ")} ${subFields} ${printedInlineFragments}`;
  }

  return value;
};

const printInterface = (obj: OutInterface): string => {
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

      return `${description}${fieldSelection.name}${
        fieldSelection.isNullable ? "?" : ""
      }: ${value};`;
    })
    .join("\n  ");

  let value;

  const modifiedInlineFragments = obj.inlineFragments.map((inlineFragment) => {
    const typenameSelection: OutSelectionFieldValue = {
      kind: "selection_field",
      name: "__typename",
      isNullable: true,
      type: {
        kind: "scalar",
        type: `"${inlineFragment.typeCondition}"`,
      },
      description:
        "Used to tell what type of object was returned for the selection",
    };

    return {
      ...inlineFragment,
      selections: {
        ...inlineFragment.selections,
        __typename: typenameSelection,
      },
    };
  });

  let unusedNamedFragments = new Set([
    ...obj.namedFragments.map(({ name }) => name),
  ]);

  const printedInlineFragmentsBody = modifiedInlineFragments
    .map((inlineFragment) => {
      const inlineFragmentTypeCondition = inlineFragment.typeCondition;
      const fields = Object.values(inlineFragment.selections)
        .map((fieldSelection) => {
          const fields = printOut(fieldSelection.type);
          const value = fields;
          const description = !!fieldSelection.description
            ? `/**
    * ${fieldSelection.description}
    */
  `
            : "";

          return `${description}${fieldSelection.name}${
            fieldSelection.isNullable ? "?" : ""
          }: ${value};`;
        })
        .join("\n  ");

      const matchingFragmentTypeConditions = obj.namedFragments
        .filter(
          ({ typeCondition }) => typeCondition === inlineFragmentTypeCondition
        )
        .map(({ name }) => name);

      matchingFragmentTypeConditions.forEach((name) =>
        unusedNamedFragments.delete(name)
      );

      const baseObject = `{${fields}}`;

      return matchingFragmentTypeConditions.length === 0
        ? baseObject
        : `${baseObject} & ${matchingFragmentTypeConditions.join(" & ")}`;
    })
    .join(" | ");

  const printedInlineFragments =
    modifiedInlineFragments.length === 0
      ? ""
      : ` & (${printedInlineFragmentsBody})`;

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
    value = `${Array.from(unusedNamedFragments)
      .map((name) => name)
      .join(" & ")} ${printedInlineFragments}`.trim();
  } else {
    const subFields =
      fieldSelectionCount > 0
        ? `& {
  ${fields}
}`
        : "";
    value = `${Array.from(unusedNamedFragments)
      .map((name) => name)
      .join(" & ")} ${subFields} ${printedInlineFragments}`.trim();
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
  } else if (out.kind === "interface") {
    return printInterface(out);
  } else if (out.kind === "union") {
    const modifiedObjects = out.objects.map((object) => {
      const typenameSelections: Record<string, OutSelectionFieldValue> =
        out.typenameFields.reduce(
          (acc, next): Record<string, OutSelectionFieldValue> => {
            const typenameSelection: OutSelectionFieldValue = {
              kind: "selection_field",
              name: next,
              isNullable: true,
              type: {
                kind: "scalar",
                type: `"${object.__typename}"`,
              },
              description:
                "Used to tell what type of object was returned for the selection",
            };

            acc[next] = typenameSelection;
            return acc;
          },
          {} as Record<string, OutSelectionFieldValue>
        );

      return {
        ...object,
        selections: {
          ...object.selections,
          ...typenameSelections,
        },
      };
    });

    const printed = modifiedObjects.map((object) => {
      const baseObject = printObject(object);
      const matchingFragmentTypeConditions = out.namedFragments
        .filter(({ typeCondition }) => {
          return typeCondition === object.__typename;
        })
        .map(({ name }) => name);

      const objectWithMatchingNamedFragments =
        matchingFragmentTypeConditions.length === 0
          ? baseObject
          : `${baseObject} & ${matchingFragmentTypeConditions.join(" & ")}`;

      return objectWithMatchingNamedFragments;
    });

    const unionJoins = printed.join(" | ");
    return `(${unionJoins})`;
  }

  return "whoops";
};

export function typeScriptSignatureForOperation(
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  operationDefinition: OperationDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
) {
  let typeMap = typeScriptDefinitionObjectForOperation(
    GraphQL,
    schema,
    operationDefinition,
    fragmentDefinitions
  );

  const typeScript = printObject(typeMap);

  return typeScript;
}

export function typeScriptDefinitionObjectForFragment(
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  fragmentDefinition: FragmentDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
) {
  const {
    getNamedType,
    isEnumType,
    isInterfaceType,
    isListType,
    isNonNullType,
    isNullableType,
    isObjectType,
    isScalarType,
    isUnionType,
    isWrappingType,
    Kind,
    typeFromAST,
  } = GraphQL;

  const dummyOut: OutScalar = {
    kind: "scalar",
    type: "Record<string, unknown> /** Scalar output not found */",
    description: "Fragment data unavailable when generating types",
  };

  const objectHelper = (
    type: GraphQLObjectType<any, any> | GraphQLInterfaceType | GraphQLUnionType,
    selectionSet: SelectionSetNode
  ): OutObject | undefined => {
    let inlineFragments: OutInlineFragment[] = [];
    let namedFragments: { name: string; typeCondition: string }[] = [];
    let selections: OutSelection = {};

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push({
            name: fragmentName,
            typeCondition: definedFragment.typeCondition.name.value,
          });
        } else {
          internalConsole.warn(
            `Could not find fragment ${fragmentName} (referenced in ${
              fragmentDefinition.name.value
            }) among defined fragments: ${Object.values(fragmentDefinitions)
              .map((def) => `"${def.name?.value}"`)
              .join(", ")}`
          );
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

        if (name === "__typename") {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: true,
            type: {
              kind: "scalar",
              type: `"${parentNamedType.name}"`,
            },
          };
          return;
        }

        if (name.startsWith("__")) {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: false,
            type: {
              kind: "scalar",
              description: "Internal GraphQL field",
              type: "unknown",
            },
          };
          return;
        }

        if (!field) {
          internalConsole.warn(
            `Could not find field ${name} on ${parentNamedType.name} among ${
              // @ts-ignore
              Object.keys(parentNamedType.getFields())
            }`
          );
          return;
        }

        let gqlType = field.type;
        let namedType = getNamedType(gqlType);
        const isNullable = isNullableType(gqlType);

        const subSelectionSet = selection.selectionSet;

        if (isWrappingType(gqlType)) {
          const value = helper(
            gqlType,
            selection.selectionSet || {
              kind: Kind.SELECTION_SET,
              selections: [],
            }
          );
          if (value) {
            selections[displayedName] = {
              kind: "selection_field",
              name: displayedName,
              type: value,
              isNullable,
              description: field.description,
            };
          }
        } else if (isScalarType(namedType)) {
          const scalar = scalarHelper(namedType);
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            type: scalar,
            isNullable,
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
              isNullable,
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
              isNullable,
              description: field.description,
            };
          }
        }
      } else {
        internalConsole.warn(
          `objectHelper got a non-field selection ${selection}`
        );
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
    const parentGqlType = isListType(type) && type.ofType;

    if (!parentGqlType) {
      return;
    }

    const subType = helper(parentGqlType, selectionSet);

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

  const interfaceHelper = (
    type: GraphQLInterfaceType,
    selectionSet: SelectionSetNode
  ): OutInterface | undefined => {
    let inlineFragments: OutInlineFragment[] = [];
    let namedFragments: { name: string; typeCondition: string }[] = [];
    let selections: OutSelection = {};

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push({
            name: fragmentName,
            typeCondition: definedFragment.typeCondition.name.value,
          });
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

        if (name === "__typename") {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: true,
            type: {
              kind: "scalar",
              type: "string",
            },
          };
          return;
        }

        if (name.startsWith("__")) {
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            isNullable: false,
            type: {
              kind: "scalar",
              description: "Internal GraphQL field",
              type: "unknown",
            },
          };
          return;
        }

        if (!field) {
          internalConsole.warn(
            `Could not find field ${name} on ${parentNamedType.name} among ${
              // @ts-ignore
              Object.keys(parentNamedType.getFields())
            }`
          );
          return;
        }

        let gqlType = field.type;
        let namedType = getNamedType(gqlType);
        const isNullable = isNullableType(gqlType);

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
              isNullable,
              description: field.description,
            };
          }
        } else if (isScalarType(namedType)) {
          const scalar = scalarHelper(namedType);
          selections[displayedName] = {
            kind: "selection_field",
            name: displayedName,
            type: scalar,
            isNullable,
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
              isNullable,
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
              isNullable,
              description: field.description,
            };
          }
        }
      } else {
        internalConsole.warn(
          `interfaceHelper got a non-field selection ${selection}`
        );
      }
    });

    const final: OutInterface = {
      kind: "interface",
      namedFragments,
      inlineFragments,
      selections,
    };

    return final;
  };

  const unionHelper = (
    type: GraphQLUnionType,
    selectionSet: SelectionSetNode
  ): OutUnion | undefined => {
    let objects: (OutObject & { __typename: string })[] = [];
    let namedFragments: { name: string; typeCondition: string }[] = [];
    let typenameFields: string[] = [];

    selectionSet.selections.forEach((selection) => {
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;
        const definedFragment = fragmentDefinitions[fragmentName];

        if (definedFragment) {
          namedFragments.push({
            name: fragmentName,
            typeCondition: definedFragment.typeCondition.name.value,
          });
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

        objects.push({
          ...fragmentSelectionAsObject,
          __typename: typeConditionName,
        });
      } else if (selection.kind === Kind.FIELD) {
        let alias = selection.alias?.value;
        let name = selection.name.value;
        let displayedName = alias || name;

        if (name === "__typename") {
          typenameFields.push(displayedName);
        }
      } else {
        internalConsole.warn(
          `unionHelper got a non-field selection: ${selection}`
        );
      }
    });

    const final: OutUnion = {
      kind: "union",
      description: type.description,
      objects: objects,
      namedFragments: namedFragments,
      typenameFields: typenameFields,
    };

    return final;
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
      return interfaceHelper(parentGqlType, selectionSet);
    } else if (isUnionType(parentGqlType)) {
      return unionHelper(parentGqlType, selectionSet);
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
      internalConsole.warn(`Unrecognized type in fragment ${parentGqlType}`);
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
  } else if (sub && sub.kind === "union") {
    const result: OutUnion = sub;

    return result;
  } else if (sub && sub.kind === "interface") {
    const result: OutInterface = sub;

    return result;
  } else {
    internalConsole.warn("Unable to determine fragment output type");
    return dummyOut;
  }
}

export function typeScriptSignatureForFragment(
  GraphQL: typeof GraphQLPackage,
  schema: GraphQLSchema,
  fragmentDefinition: FragmentDefinitionNode,
  fragmentDefinitions: Record<string, FragmentDefinitionNode>
) {
  let typeMap = typeScriptDefinitionObjectForFragment(
    GraphQL,
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
  GraphQL,
  schema,
  definition,
}: {
  GraphQL: typeof GraphQLPackage;
  schema: GraphQLSchema;
  definition: OperationDefinitionNode;
}): OperationDefinitionNode {
  const { Kind } = GraphQL;

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
  GraphQL,
  schema,
  definition,
}: {
  GraphQL: typeof GraphQLPackage;
  schema: GraphQLSchema;
  definition: OperationDefinitionNode;
}): OperationDefinitionNode {
  const { Kind } = GraphQL;

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

export const formInput = (
  GraphQL: typeof GraphQLPackage,
  schema,
  def,
  path = []
) => {
  const {
    getNamedType,
    isEnumType,
    isInputObjectType,
    isListType,
    isScalarType,
    typeFromAST,
  } = GraphQL;

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
    internalConsole.warn(`\tCould not hydrate type for ${def.type}`);
    return null;
  }
  // const required = isNonNullType(hydratedType);

  const formEl = helper([name], hydratedType, undefined);

  return `${formEl}`;
};

export const remixFormInput = (
  GraphQL: typeof GraphQLPackage,
  schema,
  def,
  path = []
) => {
  const {
    getNamedType,
    isEnumType,
    isInputObjectType,
    isListType,
    isScalarType,
    typeFromAST,
  } = GraphQL;

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
    internalConsole.warn(`\tCould not hydrate type for ${def.type}`);
    return null;
  }
  // const required = isNonNullType(hydratedType);

  const formEl = helper([name], hydratedType, undefined);

  return `${formEl}`;
};

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
      const genInput = formInput(GraphQL, schema, def, []);

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

export const normalizeOperationsDoc = (
  GraphQL: typeof GraphQLPackage,
  operationsDoc: string
) => {
  const { Kind, parse, print, visit } = GraphQL;

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

  const fragmentStrings = fragments.map((fragment) => {
    return print(fragment);
  });

  const operationStrings = operations.map((operation) => {
    return print(operation);
  });

  const fullDoc = [...fragmentStrings, ...operationStrings].join("\n\n") + "\n";

  return fullDoc;
};

export const gatherHardcodedValues = (
  GraphQL: typeof GraphQLPackage,
  query: string
) => {
  const { Kind, parse, visit } = GraphQL;

  let parsedQuery;
  try {
    parsedQuery = parse(query);
    // [fieldName, value]
    const hardCodedValues: [string, string | number][] = [];

    const isHardcodedValueNode = (node: ArgumentNode | ObjectFieldNode) => {
      const isHardcodedValue =
        node.value &&
        (node.value.kind === Kind.STRING ||
          node.value.kind === Kind.INT ||
          node.value.kind === Kind.FLOAT);

      return isHardcodedValue;
    };

    const hardCodedValueExtractor: ASTVisitFn<
      ArgumentNode | ObjectFieldNode
    > = (node) => {
      const isHardcodedValue = isHardcodedValueNode(node);

      if (isHardcodedValue) {
        const nodeName = node.name.value;
        let nodeValue: number | string | null = null;
        if (node.value.kind === Kind.STRING) {
          nodeValue = node.value.value;
        } else if (node.value.kind === Kind.INT) {
          nodeValue = node.value.value;
        } else if (node.value.kind === Kind.FLOAT) {
          nodeValue = node.value.value;
        }

        if (nodeValue) {
          hardCodedValues.push([nodeName, nodeValue]);
        }
      }
      return node;
    };

    visit(parsedQuery, {
      Argument: hardCodedValueExtractor,
      ObjectField: hardCodedValueExtractor,
    });

    return hardCodedValues;
  } catch (e) {
    internalConsole.warn(`Error parsing query: ${e}`);
    return [];
  }
};

export const extractPersistableOperation = (
  GraphQL: typeof GraphQLPackage,
  doc: DocumentNode,
  operationDefinition: OperationDefinitionNode
): {
  fragmentDependencies: FragmentDefinitionNode[];
  persistableOperationString: string;
} | null => {
  const { Kind, print, visit } = GraphQL;

  // Visit the operationDefinition and find all fragments referenced, and include them all in a single printed document
  const fragments = new Set<FragmentDefinitionNode>();
  const visitedFragmentNames = new Set<string>();

  const fragmentExtractor: ASTVisitFn<FragmentSpreadNode> = (node) => {
    const fragmentName = node.name.value;
    // Find the fragment definition in the document
    const fragmentDefinition = doc.definitions.find(
      (def) =>
        def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === fragmentName
    ) as FragmentDefinitionNode | undefined;

    if (fragmentDefinition) {
      fragments.add(fragmentDefinition);

      visit(fragmentDefinition, {
        FragmentSpread: { enter: fragmentExtractor },
      });
    } else {
      internalConsole.warn(
        `Could not find fragment definition for referenced fragment: ${fragmentName}`
      );
    }

    return node;
  };

  const newOperation = visit(operationDefinition, {
    FragmentSpread: { enter: fragmentExtractor },
    Directive: {
      enter: (node) => {
        if (["netlify", "netlifyCacheControl"].includes(node.name.value)) {
          return null;
        }
      },
    },
  });

  const fragmentStrings = Array.from(fragments)
    .sort((a, b) => {
      return a.name.value.localeCompare(b.name.value);
    })
    .map((fragment) => {
      return print(fragment);
    });

  // Put the operation in the top to help a human looking at the doc identify the purpose quickly
  const fullDoc = [print(newOperation), ...fragmentStrings].join("\n\n");

  return {
    fragmentDependencies: Array.from(fragments),
    persistableOperationString: fullDoc,
  };
};
