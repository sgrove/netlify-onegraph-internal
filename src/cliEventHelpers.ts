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
    codeGeneratorId: String!
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
    codeGeneratorId: string;
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
    }
  }`;

export type OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent = {
  __typename: "OneGraphNetlifyCliSessionOpenFileEvent";
  id: string;
  sessionId: string;
  createdAt: string;
  payload: {
    docId: string;
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
