import * as NextjsCodegenSource from "./nextjsExporter";
import * as RemixCodegenSource from "./remixExporter";
import * as ServerlessCodegenSource from "./genericExporter";
import * as CodegenHelpers from "./codegenHelpers";

export const NextjsCodegen: CodegenHelpers.IncludedCodegenModule =
  NextjsCodegenSource.codegenModule;
export const RemixCodegen: CodegenHelpers.IncludedCodegenModule =
  RemixCodegenSource.codegenModule;
export const ServerlessCodegen: CodegenHelpers.IncludedCodegenModule =
  ServerlessCodegenSource.codegenModule;

export const includedCodegenModules = [
  NextjsCodegen,
  RemixCodegen,
  ServerlessCodegen,
];
