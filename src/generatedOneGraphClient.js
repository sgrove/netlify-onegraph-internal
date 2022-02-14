// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
const fetch = require('node-fetch')
const internalConsole = require("./internalConsole").internalConsole;

const operationsDoc = `mutation CreatePersistedQueryMutation(
  $nfToken: String!
  $appId: String!
  $query: String!
  $tags: [String!]!
  $description: String!
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155001
  """
  doc: """
Create a persisted operations doc to be later retrieved, usually from a GUI
  """
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155002
  """
  doc: """

  """
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

query PersistedQueriesQuery(
  $nfToken: String!
  $appId: String!
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155004
  """
  doc: """

  """
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155005
  """
  doc: """
Fetch a persisted doc belonging to appId by its id
  """
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155006
  """
  doc: """
Register a new CLI session with OneGraph
  """
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createNetlifyCliSession(
      input: {
        appId: $appId
        name: $name
        metadata: $metadata
      }
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155007
  """
  doc: """
Update the CLI session with new metadata (e.g. the latest docId) by its id
  """
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155008
  """
  doc: """

  """
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

query CLISessionQuery(
  $nfToken: String!
  $sessionId: String!
  $first: Int!
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155009
  """
  doc: """

  """
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    __typename
    netlifyCliSession(id: $sessionId) {
      appId
      createdAt
      id
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
}

mutation AckCLISessionEventMutation(
  $nfToken: String!
  $sessionId: String!
  $eventIds: [String!]!
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155010
  """
  doc: """
Acknowledge CLI events that have been processed and delete them from the upstream queue
  """
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

query AppSchemaQuery($nfToken: String!, $appId: String!)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155011
  """
  doc: """
Fetch the schema metadata for a site (enabled services, id, etc.)
  """
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155012
  """
  doc: """
If a site does not exists upstream in OneGraph for the given site, create it
  """
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
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155013
  """
  doc: """
Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
  """
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
}

# Resurrect a session / update heartbeat
mutation MarkCLISessionActiveHeartbeat(
  $nfToken: String!
  $id: String!
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155014
  """
  doc: """
Mark a CLI session as active and update the session's heartbeat
  """
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    updateNetlifyCliSession(
      input: { status: ACTIVE, id: $id }
    ) {
      session {
        id
        status
        createdAt
        updatedAt
      }
    }
  }
}

# Mutation to mark the session as inactive. Can be called when the CLI exits
mutation MarkCLISessionInactive(
  $nfToken: String!
  $id: String!
)
@netlify(
  id: """
  12b5bdea-9bab-4124-a731-5e697b155015
  """
  doc: """
Mark a CLI session as inactive
  """
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    updateNetlifyCliSession(
      input: { status: INACTIVE, id: $id }
    ) {
      session {
        id
        status
        createdAt
        updatedAt
      }
    }
  }
}`;

const httpFetch = (siteId, options) => {
  const reqBody = options.body || null;
  const userHeaders = options.headers || {};
  const headers = {
    ...userHeaders,
    "Content-Type": "application/json",
  };

  const reqOptions = {
    method: "POST",
    headers: headers,
    timeout: 30000,
    body: reqBody,
  };

  const url = `https://serve.onegraph.com/graphql?app_id=${siteId}&show_metrics=false`;

  const httpOkLow = 200;
  const httpOkHigh = 299;

  return fetch(url, reqOptions).then((response) => {
    if (response.status < httpOkLow || response.status > httpOkHigh) {
      internalConsole.debug(`Response: ${JSON.stringify(respBody, null, 2)}`);
      internalConsole.error(
        `Netlify Graph upstream return invalid HTTP status code: ${resp.status}`
      );
    }

    return response.text()
  });
};

const fetchNetlifyGraph = async function fetchNetlifyGraph(input) {
  const query = input.query;
  const operationName = input.operationName;
  const variables = input.variables;

  const options = input.options || {};
  const accessToken = options.accessToken;
  const siteId = options.siteId || process.env.SITE_ID;

  const payload = {
    query: query,
    variables: variables,
    operationName: operationName,
  };
  try {
    const result = await httpFetch(siteId, {
      method: "POST",
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
      },
      body: JSON.stringify(payload),
    });

    if (value.errors) {
      internalConsole.warn(
        `Errors seen fetching Netlify Graph upstream for ${operationName}: ${JSON.stringify(
          value.errors,
          null,
          2
        )}`
      );
    }

    return JSON.parse(result);
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

export const executeCreatePersistedQueryMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "CreatePersistedQueryMutation",
    variables: variables,
    options: options || {},
  });
};

export const fetchListPersistedQueries = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "ListPersistedQueries",
    variables: variables,
    options: options || {},
  });
};

export const fetchPersistedQueriesQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "PersistedQueriesQuery",
    variables: variables,
    options: options || {},
  });
};

export const fetchPersistedQueryQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "PersistedQueryQuery",
    variables: variables,
    options: options || {},
  });
};

export const executeCreateCLISessionMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "CreateCLISessionMutation",
    variables: variables,
    options: options || {},
  });
};

export const executeUpdateCLISessionMetadataMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "UpdateCLISessionMetadataMutation",
    variables: variables,
    options: options || {},
  });
};

export const executeCreateCLISessionEventMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "CreateCLISessionEventMutation",
    variables: variables,
    options: options || {},
  });
};

export const fetchCLISessionQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "CLISessionQuery",
    variables: variables,
    options: options || {},
  });
};

export const executeAckCLISessionEventMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "AckCLISessionEventMutation",
    variables: variables,
    options: options || {},
  });
};

export const fetchAppSchemaQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "AppSchemaQuery",
    variables: variables,
    options: options || {},
  });
};

export const executeUpsertAppForSiteMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "UpsertAppForSiteMutation",
    variables: variables,
    options: options || {},
  });
};

export const executeCreateNewSchemaMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "CreateNewSchemaMutation",
    variables: variables,
    options: options || {},
  });
};

export const executeMarkCLISessionActiveHeartbeat = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "MarkCLISessionActiveHeartbeat",
    variables: variables,
    options: options || {},
  });
};

export const executeMarkCLISessionInactive = (variables, options) => {
  return fetchNetlifyGraph({
    query: operationsDoc,
    operationName: "MarkCLISessionInactive",
    variables: variables,
    options: options || {},
  });
};

/**
 * The generated NetlifyGraph library with your operations
 */
const functions = {
  /**
   * Acknowledge CLI events that have been processed and delete them from the upstream queue
   */
  executeAckCLISessionEventMutation: executeAckCLISessionEventMutation,
  /**
   *
   */
  executeCreateCLISessionEventMutation: executeCreateCLISessionEventMutation,
  /**
   * Register a new CLI session with OneGraph
   */
  executeCreateCLISessionMutation: executeCreateCLISessionMutation,
  /**
   * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
   */
  executeCreateNewSchemaMutation: executeCreateNewSchemaMutation,
  /**
   * Create a persisted operations doc to be later retrieved, usually from a GUI
   */
  executeCreatePersistedQueryMutation: executeCreatePersistedQueryMutation,
  /**
   * Mark a CLI session as active and update the session's heartbeat
   */
  executeMarkCLISessionActiveHeartbeat: executeMarkCLISessionActiveHeartbeat,
  /**
   * Mark a CLI session as inactive
   */
  executeMarkCLISessionInactive: executeMarkCLISessionInactive,
  /**
   * Update the CLI session with new metadata (e.g. the latest docId) by its id
   */
  executeUpdateCLISessionMetadataMutation:
    executeUpdateCLISessionMetadataMutation,
  /**
   * If a site does not exists upstream in OneGraph for the given site, create it
   */
  executeUpsertAppForSiteMutation: executeUpsertAppForSiteMutation,
  /**
   * Fetch the schema metadata for a site (enabled services, id, etc.)
   */
  fetchAppSchemaQuery: fetchAppSchemaQuery,
  /**
   *
   */
  fetchCLISessionQuery: fetchCLISessionQuery,
  /**
   *
   */
  fetchListPersistedQueries: fetchListPersistedQueries,
  /**
   *
   */
  fetchPersistedQueriesQuery: fetchPersistedQueriesQuery,
  /**
   * Fetch a persisted doc belonging to appId by its id
   */
  fetchPersistedQueryQuery: fetchPersistedQueryQuery,
};

export default functions;
