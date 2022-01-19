import {
  FragmentDefinitionNode,
  GraphQLSchema,
  OperationDefinitionNode,
} from "graphql";
import { NetlifyGraphConfig } from "../netlifyGraph";

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
};

export type UnnamedExportedFile = {
  kind: "UnnamedExportedFile";
  content: string;
};

export type ExportedFile = NamedExportedFile | UnnamedExportedFile;

export type ExporterResult = {
  exportedFiles: ExportedFile[];
  language: string;
};

export type FrameworkGenerator = (opts: {
  operationDataList: OperationData[];
  netlifyGraphConfig: NetlifyGraphConfig;
  options: Record<string, boolean>;
  schema: GraphQLSchema;
}) => ExporterResult;

export type SnippetOption = {
  id: string;
  label: string;
  initial: boolean;
};

export type SnippetGeneratorWithMeta = {
  language: string;
  codeMirrorMode: string;
  name: string;
  options: SnippetOption[];
  generate: FrameworkGenerator;
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
