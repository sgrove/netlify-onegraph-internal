import * as GraphQL from "graphql";
import type {
  FragmentDefinitionNode,
  GraphQLSchema,
  OperationDefinitionNode,
} from "graphql";
import {
  NetlifyGraphConfig,
  ParsedFragment,
  ParsedFunction,
} from "../netlifyGraph";

/**
 * Keywords in both Javascript and TypeScript
 */
const reservedKewords = new Set([
  "abstract",
  "any",
  "as",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "is",
  "let",
  "module",
  "namespace",
  "new",
  "null",
  "number",
  "of",
  "package",
  "private",
  "protected",
  "public",
  "require",
  "return",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const isReservedKeyword = (keyword) => reservedKewords.has(keyword);

export const munge = (name) => {
  if (isReservedKeyword(name)) {
    return `_${name}`;
  }
  return name;
};

export type NamedExportedFile = {
  kind: "NamedExportedFile";
  name: string[];
  content: string;
  language: string;
  codeMirrorMode?: string;
};

export type UnnamedExportedFile = {
  kind: "UnnamedExportedFile";
  content: string;
  language: string;
  codeMirrorMode?: string;
};

export type ExportedFile = NamedExportedFile | UnnamedExportedFile;

export type ExporterResult = {
  exportedFiles: ExportedFile[];
};

export type GenerateHandlerFunction = (opts: {
  GraphQL: typeof GraphQL;
  operationDataList: OperationData[];
  netlifyGraphConfig: NetlifyGraphConfig;
  options: Record<string, boolean>;
  schema: GraphQLSchema;
}) => ExporterResult;

export type GenerateHandlerPreviewFunction = (opts: {
  GraphQL: typeof GraphQL;
  operationDataList: OperationData[];
  netlifyGraphConfig: NetlifyGraphConfig;
  options: Record<string, boolean>;
  schema: GraphQLSchema;
}) => ExportedFile;

export type SnippetOption = {
  id: string;
  label: string;
  initial: boolean;
};

export type OperationDataList = {
  operationDefinitions: (OperationDefinitionNode | FragmentDefinitionNode)[];
  fragmentDefinitions: FragmentDefinitionNode[];
  operationDataList: OperationData[];
  rawOperationDataList: OperationData[];
};

export type OperationData = {
  query: string;
  name: string;
  displayName: string;
  type: string;
  variables: { [key: string]: string };
  operationDefinition: OperationDefinitionNode | FragmentDefinitionNode;
  fragmentDependencies: FragmentDefinitionNode[];
};

export type GenerateRuntimeFunction = (opts: {
  GraphQL: typeof GraphQL;
  operationDataList: OperationData[];
  netlifyGraphConfig: NetlifyGraphConfig;
  options: Record<string, boolean>;
  schema: GraphQLSchema;
  schemaId: string;
  functionDefinitions: ParsedFunction[];
  fragments: ParsedFragment[];
}) => NamedExportedFile[];

type CodegenSupportableDefinitionType =
  | "query"
  | "mutation"
  | "subscription"
  | "fragment";

export type GenerateHandlerFunctionOptions = {
  schemaSdl: string;
  inputTypename: string;
  defaultValue?: Record<string, unknown>;
};

export type GenerateHandlerFunctionOptionsDeserialized = {
  schema: GraphQL.GraphQLSchema;
  inputTypename: string;
  defaultValue?: Record<string, unknown>;
};

export type Codegen = {
  generatePreview?: GenerateHandlerPreviewFunction;
  generateHandler: GenerateHandlerFunction;
  generateHandlerOptions?: GenerateHandlerFunctionOptions;
  supportedDefinitionTypes: CodegenSupportableDefinitionType[];
  name: string;
  id: string;
  version: string;
};

export type CodegenMeta = {
  id: string;
  name: string;
  options: GenerateHandlerFunctionOptions | null;
  supportedDefinitionTypes: CodegenSupportableDefinitionType[];
};

export type CodegenModuleMeta = {
  id: string;
  version: string;
  generators: CodegenMeta[];
};

export type CodegenModule = {
  id: string;
  version: string;
  generateRuntime: GenerateRuntimeFunction;
  generators: Codegen[];
};
