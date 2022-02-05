import { buildClientSchema } from "graphql";
import fetch = require("node-fetch");
import { internalConsole } from "./internalConsole";

export const internalOperationsDoc = `
mutation CreatePersistedQueryMutation(
  $nfToken: String!
  $appId: String!
  $query: String!
  $tags: [String!]!
  $description: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createPersistedQuery(
      input: {
        query: $query
        appId: $appId
        tags: $tags
        description: $description
      }
    ) {
      persistedQuery {
        id
      }
    }
  }
}

query ListPersistedQueries(
  $appId: String!
  $first: Int!
  $after: String
  $tags: [String!]!
) {
  oneGraph {
    app(id: $appId) {
      id
      persistedQueries(
        first: $first
        after: $after
        tags: $tags
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          query
          fixedVariables
          freeVariables
          allowedOperationNames
          tags
          description
        }
      }
    }
  }
}

subscription ListPersistedQueriesSubscription(
  $appId: String!
  $first: Int!
  $after: String
  $tags: [String!]!
) {
  poll(
    onlyTriggerWhenPayloadChanged: true
    schedule: { every: { minutes: 1 } }
  ) {
    query {
      oneGraph {
        app(id: $appId) {
          id
          persistedQueries(
            first: $first
            after: $after
            tags: $tags
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              query
              fixedVariables
              freeVariables
              allowedOperationNames
              tags
              description
            }
          }
        }
      }
    }
  }
}

query PersistedQueriesQuery(
  $nfToken: String!
  $appId: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    app(id: $appId) {
      persistedQueries {
        nodes {
          id
          query
          allowedOperationNames
          description
          freeVariables
          fixedVariables
          tags
        }
      }
    }
  }
}

query PersistedQueryQuery(
  $nfToken: String!
  $appId: String!
  $id: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    persistedQuery(appId: $appId, id: $id) {
      id
      query
      allowedOperationNames
      description
      freeVariables
      fixedVariables
      tags
    }
  }
}

mutation CreateCLISessionMutation(
  $nfToken: String!
  $appId: String!
  $name: String!
  $metadata: JSON
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createNetlifyCliSession(
      input: { appId: $appId, name: $name, metadata: metadata }
    ) {
      session {
        id
        appId
        netlifyUserId
        name
      }
    }
  }
}

mutation UpdateCLISessionMetadataMutation(
  $nfToken: String!
  $sessionId: String!
  $metadata: JSON!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    updateNetlifyCliSession(
      input: { id: $sessionId, metadata: $metadata }
    ) {
      session {
        id
        name
        metadata
      }
    }
  }
}

mutation CreateCLISessionEventMutation(
  $nfToken: String!
  $sessionId: String!
  $payload: JSON!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createNetlifyCliTestEvent(
      input: {
        data: { payload: $payload }
        sessionId: $sessionId
      }
    ) {
      event {
        id
        createdAt
        sessionId
      }
    }
  }
}
  
query CLISessionEventsQuery(
  $nfToken: String!
  $sessionId: String!
  $first: Int!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    netlifyCliEvents(sessionId: $sessionId, first: $first) {
      __typename
      createdAt
      id
      sessionId
      ... on OneGraphNetlifyCliSessionLogEvent {
        id
        message
        sessionId
        createdAt
      }
      ... on OneGraphNetlifyCliSessionTestEvent {
        id
        createdAt
        payload
        sessionId
      }
    }
  }
}
  
mutation AckCLISessionEventMutation(
  $nfToken: String!
  $sessionId: String!
  $eventIds: [String!]!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    ackNetlifyCliEvents(
      input: { eventIds: $eventIds, sessionId: $sessionId }
    ) {
      events {
        id
      }
    }
  }
}

query AppSchemaQuery(
  $nfToken: String!
  $appId: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    app(id: $appId) {
      graphQLSchema {
        appId
        createdAt
        id
        services {
          friendlyServiceName
          logoUrl
          service
          slug
          supportsCustomRedirectUri
          supportsCustomServiceAuth
          supportsOauthLogin
        }
        updatedAt
      }
    }
  }
}

mutation UpsertAppForSiteMutation(
  $nfToken: String!
  $siteId: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    upsertAppForNetlifySite(
      input: { netlifySiteId: $siteId }
    ) {
      org {
        id
        name
      }
      app {
        id
        name
        corsOrigins
        customCorsOrigins {
          friendlyServiceName
          displayName
          encodedValue
        }
      }
    }
  }
}

mutation CreateNewSchemaMutation(
  $nfToken: String!
  $input: OneGraphCreateGraphQLSchemaInput!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createGraphQLSchema(input: $input) {
      app {
        graphQLSchema {
          id
        }
      }
      graphqlSchema {
        id
        services {
          friendlyServiceName
          logoUrl
          service
          slug
          supportsCustomRedirectUri
          supportsCustomServiceAuth
          supportsOauthLogin
        }
      }
    }
  }
}`;

const ONEDASH_APP_ID = "0b066ba6-ed39-4db8-a497-ba0be34d5b2a";

const httpOkLow = 200;
const httpOkHigh = 299;
const basicPostTimeoutMilliseconds = 30_000;

/**
 * The basic http function used to communicate with OneGraph.
 * The least opinionated function that can be used to communicate with OneGraph.
 * @param {string} url
 * @param {object} options
 * @returns {Promise<object>} The response from OneGraph
 */
const basicPost = async (
  url: string,
  options: {
    method: "GET" | "POST";
    headers?: object;
    body?: string | null;
  }
) => {
  const reqBody = options.body || "";
  const userHeaders = options.headers || {};

  const headers = {
    ...userHeaders,
    "Content-Type": "application/json",
    "Content-Length": reqBody.length,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    timeout: basicPostTimeoutMilliseconds,
    compress: true,
    body: reqBody,
  });

  const respBody = await resp.text();

  if (resp.status < httpOkLow || resp.status > httpOkHigh) {
    internalConsole.debug("Response:", respBody);
    internalConsole.error(
      `Netlify Graph upstream return invalid HTTP status code: ${resp.status}`
    );
    return respBody;
  }

  return respBody;
};

/**
 * Given an appId and desired services, fetch the schema (in json form) for that app
 * @param {string} appId
 * @param {string[]} enabledServices
 * @returns {Promise<object>} The schema for the app
 */
export const fetchOneGraphSchemaJson = async (
  appId: string,
  enabledServices: string[]
) => {
  const url = `https://serve.onegraph.com/schema?app_id=${appId}&services=${enabledServices.join(
    ","
  )}`;
  const headers = {};

  try {
    const response = await basicPost(url, {
      method: "GET",
      headers,
      body: null,
    });

    return JSON.parse(response);
  } catch (error) {
    internalConsole.error("Error fetching schema:", error);
  }
};

/**
 * Given an appId and desired services, fetch the schema json for an app and parse it into a GraphQL Schema
 * @param {string} appId
 * @param {string[]} enabledServices
 * @returns {Promise<GraphQLSchema>} The schema for the app
 */
export const fetchOneGraphSchema = async (
  appId: string,
  enabledServices: string[]
) => {
  const result = await fetchOneGraphSchemaJson(appId, enabledServices);
  const schema = buildClientSchema(result.data);
  return schema;
};

/**
 * Fetch data from OneGraph
 * @param {object} config
 * @param {string|null} config.accessToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} config.appId The app to query against, typically the siteId
 * @param {string} config.query The full GraphQL operation doc
 * @param {string} config.operationName The operation to execute inside of the GraphQL operation doc
 * @param {object} config.variables The variables to pass to the GraphQL operation
 * @returns {Promise<object>} The response from OneGraph
 */
const fetchOneGraph = async (config: {
  accessToken: string | null;
  appId: string;
  query: string;
  operationName: string;
  variables: Record<string, any>;
}) => {
  const { accessToken, appId, operationName, query, variables } = config;

  const payload = {
    query,
    variables,
    operationName,
  };

  const body = JSON.stringify(payload);
  const url = `https://serve.onegraph.com/graphql?app_id=${appId}&show_metrics=false`;

  try {
    const result = await basicPost(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
      },
      body,
    });

    // @ts-ignore
    const value = JSON.parse(result);
    if (value.errors) {
      internalConsole.warn(
        `Errors seen fetching Netlify Graph upstream`,
        operationName,
        JSON.stringify(value, null, 2)
      );
    }
    return value;
  } catch (networkError) {
    internalConsole.warn(
      `Network error fetching Netlify Graph upstream: ${JSON.stringify(
        networkError,
        null,
        2
      )}`
    );
    return {};
  }
};

/**
 * Fetch data from OneGraph using a previously persisted query
 * @param {object} config
 * @param {string|null} config.accessToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} config.appId The app to query against, typically the siteId
 * @param {string} config.docId The id of the previously persisted GraphQL operation doc
 * @param {string} config.operationName The operation to execute inside of the GraphQL operation doc
 * @param {object} config.variables The variables to pass to the GraphQL operation
 * @returns {Promise<object>} The response from OneGraph
 */
const fetchOneGraphPersisted = async (config: {
  accessToken: string | null;
  appId: string;
  docId: string;
  operationName: string;
  variables: Record<string, any>;
}) => {
  const { accessToken, appId, docId, operationName, variables } = config;

  const payload = {
    doc_id: docId,
    variables,
    operationName,
  };
  try {
    const result = await basicPost(
      `https://serve.onegraph.com/graphql?app_id=${appId}`,
      {
        method: "POST",
        headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        body: JSON.stringify(payload),
      }
    );

    return JSON.parse(result);
  } catch (networkError) {
    internalConsole.warn(
      "Network error fetching Netlify Graph upstream",
      networkError
    );
    return {};
  }
};

export type PersistedQuery = {
  id: string;
  query: string;
  description: string | null;
  allowedOperationNames: string[];
  tags: string[];
};

/**
 * Fetch a persisted doc belonging to appId by its id
 * @param {string} authToken
 * @param {string} appId
 * @param {string} docId
 * @returns {string|undefined} The persisted operations doc
 */
export const fetchPersistedQuery = async (
  authToken: string,
  appId: string,
  docId: string
): Promise<PersistedQuery | undefined> => {
  const response = await fetchOneGraph({
    accessToken: authToken,
    appId: ONEDASH_APP_ID,
    query: internalOperationsDoc,
    operationName: "PersistedQueryQuery",
    variables: {
      nfToken: authToken,
      appId,
      id: docId,
    },
  });

  const persistedQuery =
    response.data &&
    response.data.oneGraph &&
    response.data.oneGraph.persistedQuery;

  return persistedQuery;
};

/**
 *
 * @param {object} options
 * @param {string} options.appId The app to query against, typically the siteId
 * @param {string} options.authToken The (typically netlify) access token that is used for authentication
 * @param {string} options.sessionId The session id to fetch CLI events for
 * @returns {Promise<OneGraphCliEvent[]|undefined>} The unhandled events for the cli session to process
 */
export const fetchCliSessionEvents = async (options: {
  appId: string;
  authToken: string;
  sessionId: string;
}): Promise<{ events?: OneGraphCliEvent[]; errors?: any[] } | undefined> => {
  const { appId, authToken, sessionId } = options;

  // Grab the first 1000 events so we can chew through as many at a time as possible
  const desiredEventCount = 1000;
  const next = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: "CLISessionEventsQuery",
    variables: {
      nfToken: authToken,
      sessionId,
      first: desiredEventCount,
    },
  });

  if (next.errors) {
    return next;
  }

  const events =
    (next.data && next.data.oneGraph && next.data.oneGraph.netlifyCliEvents) ||
    [];

  return { events };
};

type OneGraphCliEvent = Record<string, any>;

/**
 * Register a new CLI session with OneGraph
 * @param {string} netlifyToken The netlify token to use for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} name The name of the CLI session, will be visible in the UI and CLI ouputs
 * @param {object} metadata Any additional metadata to attach to the session
 * @returns {Promise<object|undefined>} The CLI session object
 */
export const createCLISession = async (
  netlifyToken: string,
  appId: string,
  name: string,
  metadata: Record<string, any>
) => {
  const payload = {
    nfToken: netlifyToken,
    appId,
    name,
    metadata,
  };

  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: "CreateCLISessionMutation",
    variables: payload,
  });

  const session =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createNetlifyCliSession &&
    result.data.oneGraph.createNetlifyCliSession.session;

  return session;
};

/**
 * Update the CLI session with new metadata (e.g. the latest docId) by its id
 * @param {string} netlifyToken The netlify token to use for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to update
 * @param {object} metadata The new metadata to set on the session
 * @returns {Promise<object|undefined>} The updated session object
 */
export const updateCLISessionMetadata = async (
  netlifyToken: string,
  appId: string,
  sessionId: string,
  metadata: Record<string, any>
) => {
  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: "UpdateCLISessionMetadataMutation",
    variables: {
      nfToken: netlifyToken,
      sessionId,
      metadata,
    },
  });

  const session =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.updateNetlifyCliSession &&
    result.data.oneGraph.updateNetlifyCliSession.session;

  return session;
};

/**
 * Acknoledge CLI events that have been processed and delete them from the upstream queue
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.sessionId The session id the events belong to
 * @param {string[]} input.eventIds The event ids to ack (and delete) from the session queue, having been processed
 * @returns
 */
export const ackCLISessionEvents = async (input: {
  appId: string;
  authToken: string;
  sessionId: string;
  eventIds: string[];
}) => {
  const { appId, authToken, eventIds, sessionId } = input;
  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: "AckCLISessionEventMutation",
    variables: {
      nfToken: authToken,
      sessionId,
      eventIds,
    },
  });

  const events =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.ackNetlifyCliEvents;

  return events;
};

/**
 * Create a persisted operations doc to be later retrieved, usually from a GUI
 * @param {string} netlifyToken The netlify token to use for authentication
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.document The GraphQL operations document to persist
 * @param {string} input.description A description of the operations doc
 * @param {string[]} input.tags A list of tags to attach to the operations doc
 * @returns
 */
export const createPersistedQuery = async (
  netlifyToken: string,
  {
    appId,
    description,
    document,
    tags,
  }: { appId: string; description: string; document: string; tags: string[] }
) => {
  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: "CreatePersistedQueryMutation",
    variables: {
      nfToken: netlifyToken,
      appId,
      query: document,
      tags,
      description,
    },
  });

  const persistedQuery =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createPersistedQuery &&
    result.data.oneGraph.createPersistedQuery.persistedQuery;

  return persistedQuery;
};

/**
 *
 * @param {OneGraphCliEvent} event
 * @returns {string} a human-friendly description of the event
 */
export const friendlyEventName = (event: OneGraphCliEvent) => {
  const { __typename, payload } = event;
  switch (__typename) {
    case "OneGraphNetlifyCliSessionTestEvent":
      return friendlyEventName(payload);
    case "OneGraphNetlifyCliSessionGenerateHandlerEvent":
      return "Generate handler as Netlify function ";
    case "OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent":
      return `Sync Netlify Graph operations library`;
    default: {
      return `Unrecognized event (${__typename})`;
    }
  }
};

/**
 * Fetch the schema metadata for a site (enabled services, id, etc.)
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to query against
 * @returns {Promise<object|undefined>} The schema metadata for the site
 */
export const fetchAppSchema = async (authToken: string, siteId: string) => {
  const result = await fetchOneGraph({
    accessToken: authToken,
    appId: siteId,
    query: internalOperationsDoc,
    operationName: "AppSchemaQuery",
    variables: {
      nfToken: authToken,
      appId: siteId,
    },
  });

  return (
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.app &&
    result.data.oneGraph.app.graphQLSchema
  );
};

/**
 * If a site does not exists upstream in OneGraph for the given site, create it
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
export const upsertAppForSite = async (authToken: string, siteId: string) => {
  const result = await fetchOneGraph({
    accessToken: authToken,
    appId: ONEDASH_APP_ID,
    query: internalOperationsDoc,
    operationName: "UpsertAppForSiteMutation",
    variables: {
      nfToken: authToken,
      siteId,
    },
  });

  return (
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.upsertAppForNetlifySite &&
    result.data.oneGraph.upsertAppForNetlifySite.app
  );
};

/**
 * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {object} input The details of the schema to create
 * @returns {Promise<object>} The schema metadata for the site
 */
export const createNewAppSchema = async (
  nfToken: string,
  input: {
    appId: string;
    enabledServices?: string[];
    setAsDefaultForApp?: boolean;
  }
) => {
  const result = await fetchOneGraph({
    accessToken: null,
    appId: input.appId,
    query: internalOperationsDoc,
    operationName: "CreateNewSchemaMutation",
    variables: {
      nfToken,
      input,
    },
  });

  return (
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createGraphQLSchema &&
    result.data.oneGraph.createGraphQLSchema.graphqlSchema
  );
};

/**
 * Ensure that an app exists upstream in OneGraph for the given site
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
export const ensureAppForSite = async (authToken: string, siteId: string) => {
  const app = await upsertAppForSite(authToken, siteId);
  const schema = await fetchAppSchema(authToken, app.id);
  if (!schema) {
    internalConsole.log(
      `Creating new empty default GraphQL schema for site....`
    );
    await createNewAppSchema(authToken, {
      appId: siteId,
      enabledServices: ["ONEGRAPH"],
      setAsDefaultForApp: true,
    });
  }
};

/**
 * Fetch a list of what services are enabled for the given site
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} appId The app id to query against
 * @returns
 */
export const fetchEnabledServices = async (
  authToken: string,
  appId: string
) => {
  const appSchema = await fetchAppSchema(authToken, appId);
  return appSchema && appSchema.services;
};
