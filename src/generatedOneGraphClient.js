// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
const fetch = require('node-fetch')
const internalConsole = require("./internalConsole").internalConsole;

const httpFetch = async (siteId, options) => {
  const reqBody = options.body || null;
  const userHeaders = options.headers || {};
  const headers = {
    ...userHeaders,
    "Content-Type": "application/json",
    "Content-Length": reqBody.length,
  };

  const timeoutMs = 30_000;

  const reqOptions = {
    method: "POST",
    headers: headers,
    timeout: timeoutMs,
    body: reqBody
  };

  const url = "https://serve.onegraph.com/graphql?app_id=" + siteId;

  const resp = await fetch(url, reqOptions);
  return resp.text();
};

const fetchNetlifyGraph = async function fetchNetlifyGraph(input) {
  const query = input.query;
  const docId = input.doc_id;
  const operationName = input.operationName;
  const variables = input.variables;

  const options = input.options || {};
  const accessToken = options.accessToken;
  const siteId = options.siteId || process.env.SITE_ID;

  const payload = {
    query: query,
    doc_id: docId,
    variables: variables,
    operationName: operationName,
  };

  const response = httpFetch(siteId, {
    method: "POST",
    headers: {
      Authorization: accessToken ? "Bearer " + accessToken : "",
    },
    body: JSON.stringify(payload),
  });

  return response.then((result) => JSON.parse(result));
};

export const executeCreateGraphQLSchemaMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreateGraphQLSchemaMutation($input: OneGraphCreateGraphQLSchemaInput!) {
  oneGraph {
    createGraphQLSchema(input: $input) {
      graphQLSchema {
        id
        externalGraphQLSchemas {
          nodes {
            id
            endpoint
            service
            createdAt
            updatedAt
          }
        }
        parentGraphQLSchemaId
        salesforceSchema {
          id
          createdAt
          updatedAt
        }
        services {
          slug
        }
        updatedAt
        createdAt
        appId
      }
    }
  }
}`,
    operationName: "CreateGraphQLSchemaMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeCreatePersistedQueryMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreatePersistedQueryMutation($nfToken: String!, $cacheStrategy: OneGraphPersistedQueryCacheStrategyArg, $allowedOperationNames: [String!]!, $fallbackOnError: Boolean!, $freeVariables: [String!]!, $query: String!, $tags: [String!]!, $description: String, $appId: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    createPersistedQuery(
      input: {query: $query, appId: $appId, cacheStrategy: $cacheStrategy, allowedOperationNames: $allowedOperationNames, fallbackOnError: $fallbackOnError, freeVariables: $freeVariables, tags: $tags, description: $description}
    ) {
      persistedQuery {
        id
        allowedOperationNames
        description
        fixedVariables
        freeVariables
        query
        tags
      }
    }
  }
}`,
    operationName: "CreatePersistedQueryMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeCreatePersistQueryTokenMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreatePersistQueryTokenMutation($nfToken: String!, $input: OneGraphPersistedQueryTokenInput!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    createPersitQueryToken(input: $input) {
      accessToken {
        token
        expireDate
        name
        appId
        netlifyId
      }
    }
  }
}`,
    operationName: "CreatePersistQueryTokenMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const fetchListPersistedQueries = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query ListPersistedQueries($appId: String!, $first: Int!, $after: String, $tags: [String!]!) {
  oneGraph {
    app(id: $appId) {
      id
      persistedQueries(first: $first, after: $after, tags: $tags) {
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
}`,
    operationName: "ListPersistedQueries",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const fetchPersistedQueryQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query PersistedQueryQuery($nfToken: String!, $appId: String!, $id: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
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
}`,
    operationName: "PersistedQueryQuery",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeCreateCLISessionMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreateCLISessionMutation($nfToken: String!, $appId: String!, $name: String!, $metadata: JSON) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    createNetlifyCliSession(
      input: {appId: $appId, name: $name, metadata: $metadata}
    ) {
      session {
        id
        appId
        netlifyUserId
        name
        cliHeartbeatIntervalMs
      }
    }
  }
}`,
    operationName: "CreateCLISessionMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeUpdateCLISessionMetadataMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation UpdateCLISessionMetadataMutation($nfToken: String!, $sessionId: String!, $metadata: JSON!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    updateNetlifyCliSession(input: {id: $sessionId, metadata: $metadata}) {
      session {
        id
        name
        metadata
        cliHeartbeatIntervalMs
      }
    }
  }
}`,
    operationName: "UpdateCLISessionMetadataMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeCreateCLISessionEventMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreateCLISessionEventMutation($nfToken: String!, $sessionId: String!, $payload: JSON!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    createNetlifyCliTestEvent(
      input: {data: {payload: $payload}, sessionId: $sessionId}
    ) {
      event {
        id
        createdAt
        sessionId
      }
    }
  }
}`,
    operationName: "CreateCLISessionEventMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const fetchCLISessionQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query CLISessionQuery($nfToken: String!, $sessionId: String!, $first: Int!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    __typename
    netlifyCliSession(id: $sessionId) {
      appId
      createdAt
      id
      cliHeartbeatIntervalMs
      events(first: $first) {
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
      lastEventAt
      metadata
      name
      netlifyUserId
    }
  }
}`,
    operationName: "CLISessionQuery",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeAckCLISessionEventMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation AckCLISessionEventMutation($nfToken: String!, $sessionId: String!, $eventIds: [String!]!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    ackNetlifyCliEvents(input: {eventIds: $eventIds, sessionId: $sessionId}) {
      events {
        id
      }
    }
  }
}`,
    operationName: "AckCLISessionEventMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const fetchAppSchemaQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query AppSchemaQuery($nfToken: String!, $appId: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
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
}`,
    operationName: "AppSchemaQuery",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeUpsertAppForSiteMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation UpsertAppForSiteMutation($nfToken: String!, $siteId: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    upsertAppForNetlifySite(input: {netlifySiteId: $siteId}) {
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
}`,
    operationName: "UpsertAppForSiteMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeCreateNewSchemaMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreateNewSchemaMutation($nfToken: String!, $input: OneGraphCreateGraphQLSchemaInput!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
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
}`,
    operationName: "CreateNewSchemaMutation",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeMarkCLISessionActiveHeartbeat = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation MarkCLISessionActiveHeartbeat($nfToken: String!, $id: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    updateNetlifyCliSession(input: {status: ACTIVE, id: $id}) {
      session {
        id
        status
        createdAt
        updatedAt
        cliHeartbeatIntervalMs
      }
    }
  }
}`,
    operationName: "MarkCLISessionActiveHeartbeat",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

export const executeMarkCLISessionInactive = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation MarkCLISessionInactive($nfToken: String!, $id: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    updateNetlifyCliSession(input: {status: INACTIVE, id: $id}) {
      session {
        id
        status
        createdAt
        updatedAt
        cliHeartbeatIntervalMs
      }
    }
  }
}`,
    operationName: "MarkCLISessionInactive",
    variables: variables,
    options: options,
    fetchStrategy: "POST",
  });
};

/**
 * The generated NetlifyGraph library with your operations
 */
const functions = {
  /**
   * Create a GraphQL Schema by specifying its inputs (services, external GraphQL schemas, etc.)
   */
  executeCreateGraphQLSchemaMutation: executeCreateGraphQLSchemaMutation,
  /**
   * Create a token belonging to a specific siteId to persist operations later
   */
  executeCreatePersistQueryTokenMutation:
    executeCreatePersistQueryTokenMutation,
  /**
   * Create a persisted operations doc to be later retrieved, usually from a GUI
   */
  executeCreatePersistedQueryMutation: executeCreatePersistedQueryMutation,
  /**
   * Fetch a paginated list of persisted queries belonging to an app
   */
  fetchListPersistedQueries: fetchListPersistedQueries,
  /**
   * Fetch a persisted doc belonging to appId by its id
   */
  fetchPersistedQueryQuery: fetchPersistedQueryQuery,
  /**
   * Register a new CLI session with OneGraph
   */
  executeCreateCLISessionMutation: executeCreateCLISessionMutation,
  /**
   * Update the CLI session with new metadata (e.g. the latest docId) by its id
   */
  executeUpdateCLISessionMetadataMutation:
    executeUpdateCLISessionMetadataMutation,
  /**
   * Create a new event for a CLI session to consume
   */
  executeCreateCLISessionEventMutation: executeCreateCLISessionEventMutation,
  /**
   * Fetch a single CLI session by its id
   */
  fetchCLISessionQuery: fetchCLISessionQuery,
  /**
   * Acknowledge CLI events that have been processed and delete them from the upstream queue
   */
  executeAckCLISessionEventMutation: executeAckCLISessionEventMutation,
  /**
   * Fetch the schema metadata for a site (enabled services, id, etc.)
   */
  fetchAppSchemaQuery: fetchAppSchemaQuery,
  /**
   * If a site does not exists upstream in OneGraph for the given site, create it
   */
  executeUpsertAppForSiteMutation: executeUpsertAppForSiteMutation,
  /**
   * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
   */
  executeCreateNewSchemaMutation: executeCreateNewSchemaMutation,
  /**
   * Mark a CLI session as active and update the session's heartbeat
   */
  executeMarkCLISessionActiveHeartbeat: executeMarkCLISessionActiveHeartbeat,
  /**
   * Mark a CLI session as inactive
   */
  executeMarkCLISessionInactive: executeMarkCLISessionInactive,
};

export default functions;

export const handler = () => {
  // return a 401 json response
  return {
    statusCode: 401,
    body: JSON.stringify({
      message: "Unauthorized",
    }),
  };
};
