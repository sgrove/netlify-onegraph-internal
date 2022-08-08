import { CodegenModuleMeta } from "./codegen/codegenHelpers";

export const OneGraphNetlifyCliSessionTestEventSdl = `type OneGraphNetlifyCliSessionTestEvent {
  id: String!
  sessionId: String!
  createdAt: String!
  payload: JSON!
}`;

export type OneGraphNetlifyCliSessionTestEvent = {
  __typename: "OneGraphNetlifyCliSessionTestEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export const OneGraphNetlifyCliSessionGenerateHandlerEventSdl = `type OneGraphNetlifyCliSessionGenerateHandlerEvent {
  id: String!
  sessionId: String!
  createdAt: String!
  payload: {
    cliSessionId: String!
    operationId: String
    codegenId: String!
    options: JSON
  }
}`;

export type OneGraphNetlifyCliSessionGenerateHandlerEvent = {
  __typename: "OneGraphNetlifyCliSessionGenerateHandlerEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    cliSessionId: string;
    operationId: string;
    codegenId: string;
    options?: Record<string, unknown> | null;
  };
};

export const OneGraphNetlifyCliSessionOpenFileEventSdl = `type OneGraphNetlifyCliSessionOpenFileEvent {
  id: String!
  sessionId: String!
  createdAt: String!
  payload: {
    filePath: String!
  }
}`;

export type OneGraphNetlifyCliSessionOpenFileEvent = {
  __typename: "OneGraphNetlifyCliSessionOpenFileEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    filePath: string;
  };
};

export const OneGraphNetlifyCliSessionPersistedLibraryUpdatedEventSdl = `type OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent {
    id: String!
    sessionId: String!
    createdAt: String!
    payload: {
      docId: String!
      schemaId: String!
    }
  }`;

export type OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent = {
  __typename: "OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    docId: string;
    schemaId: string;
  };
};

export const OneGraphNetlifyCliSessionFileWrittenEventSdl = `type OneGraphNetlifyCliSessionFileWrittenEvent {
    id: String!
    sessionId: String!
    createdAt: String!
    payload: {
      editor: String
      filePath: String!
    }
    audience: String!
}`;

export type OneGraphNetlifyCliSessionFileWrittenEvent = {
  __typename: "OneGraphNetlifyCliSessionFileWrittenEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    editor: string | null;
    filePath: string;
  };
  audience: "UI" | "CLI";
};

export const OneGraphNetlifyCliSessionCodegenHandlerFunctionOptionsSdl = `type OneGraphNetlifyCliSessionCodegenHandlerFunctionOptions {
    schemaSdl: String!
    inputTypename: String!
    defaultValue: JSON
}`;

export const OneGraphNetlifyCliSessionCodegenSupportedDefinitionTypesEnumSdl = `enum OneGraphNetlifyCliSessionCodegenSupportedDefinitionTypesEnum {
    QUERY
    MUTATION
    SUBSCRIPTION
    FRAGMENT
}`;

export const OneGraphNetlifyCliSessionCodegenMetadataSdl = `type OneGraphNetlifyCliSessionCodegenMetadata {
    id: String!
    name: String!
    operations: OneGraphNetlifyCliSessionCodegenHandlerFunctionOptions
    supportedDefinitionTypes: [OneGraphNetlifyCliSessionCodegenSupportedDefinitionTypesEnum!]!
}`;

export const OneGraphNetlifyCliSessionCodegenModuleMetadataSdl = `type OneGraphNetlifyCliSessionCodegenModuleMetadata {
    id: String!
    version: String!
    generators: [OneGraphNetlifyCliSessionCodegenMetadata!]!
}`;

export const OneGraphNetlifyCliSessionMetadataPublishEventSdl = `type OneGraphNetlifyCliSessionMetadataPublishEvent {
    id: String!
    sessionId: String!
    createdAt: String!
    payload: {
      editor: String
      siteRoot: String
      siteRootFriendly: String
      schemaId: String!
      persistedDocId: String!
      codegenModule: OneGraphNetlifyCliSessionCodegenModuleMetadata
    }
    audience: String!
}`;

export type OneGraphNetlifyCliSessionMetadataPublishEvent = {
  __typename: "OneGraphNetlifyCliSessionMetadataPublishEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    cliVersion: string;
    editor: string | null;
    siteRoot: string | null;
    siteRootFriendly: string | null;
    schemaId: string;
    persistedDocId: string;
    codegenModule: CodegenModuleMeta | null;
  };
  audience: "UI";
};

export const OneGraphNetlifyCliSessionMetadataRequestEventSdl = `type OneGraphNetlifyCliSessionMetadataRequestEvent {
    id: String!
    sessionId: String!
    createdAt: String!
    payload: {
        minimumCliVersionExpected: String!
        expectedAudience: String!
    }
    audience: String!
}`;

export type OneGraphNetlifyCliSessionMetadataRequestEvent = {
  __typename: "OneGraphNetlifyCliSessionMetadataRequestEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    minimumCliVersionExpected: string;
    expectedAudience: "UI";
  };
  audience: "CLI";
};

export type CliEvent =
  | OneGraphNetlifyCliSessionTestEvent
  | OneGraphNetlifyCliSessionGenerateHandlerEvent
  | OneGraphNetlifyCliSessionOpenFileEvent
  | OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent
  | OneGraphNetlifyCliSessionFileWrittenEvent
  | OneGraphNetlifyCliSessionMetadataPublishEvent
  | OneGraphNetlifyCliSessionMetadataRequestEvent;

export type DetectedLocalCLISessionMetadata = {
  gitBranch: string | null;
  hostname: string | null;
  username: string | null;
  siteRoot: string | null;
  cliVersion: string;
  editor: string | null;
  codegen: CodegenModuleMeta | null;
};
