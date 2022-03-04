/* eslint-disable */
// @ts-nocheck
// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
const fetch = require('node-fetch')
const internalConsole = require("./internalConsole").internalConsole;

const netlifyGraphHost = process.env.NETLIFY_GRAPH_HOST || "graph.netlify.com"

// Basic LRU cache implementation
const makeLRUCache = (max) => {
  return { max: max, cache: new Map() };
};

const getFromCache = (lru, key) => {
  const item = lru.cache.get(key);
  if (item) {
    lru.cache.delete(key);
    lru.cache.set(key, item);
  }
  return item;
};

const setInCache = (lru, key, value) => {
  if (lru.cache.has(key)) {
    lru.cache.delete(key);
  }
  if (lru.cache.size == lru.max) {
    lru.cache.delete(lru.first());
  }
  lru.cache.set(key, value);
};

// Cache the results of the Netlify Graph API for conditional requests
const cache = makeLRUCache(100);

const calculateCacheKey = (payload) => {
  return JSON.stringify(payload);
};

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

  const url = "https://" + netlifyGraphHost + "/graphql?app_id=" + siteId;

  const resp = await fetch(url, reqOptions);
  return resp;
};

const fetchNetlifyGraph = function fetchNetlifyGraph(input) {
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

  let cachedOrLiveValue = new Promise((resolve) => {
    const cacheKey = calculateCacheKey(payload);

    // Check the cache for a previous result
    const cachedResultPair = getFromCache(cache, cacheKey);

    let conditionalHeaders = {
      "If-None-Match": "",
    };
    let cachedResultValue;

    if (cachedResultPair) {
      const [etag, previousResult] = cachedResultPair;
      conditionalHeaders = {
        "If-None-Match": etag,
      };
      cachedResultValue = previousResult;
    }

    const response = httpFetch(siteId, {
      method: "POST",
      headers: {
        ...conditionalHeaders,
        Authorization: accessToken ? "Bearer " + accessToken : "",
      },
      body: JSON.stringify(payload),
    });

    response.then((result) => {
      // Check response headers for a 304 Not Modified
      if (result.status === 304) {
        // Return the cached result
        resolve(cachedResultValue);
      } else if (result.status === 200) {
        // Update the cache with the new etag and result
        const etag = result.headers.get("etag");
        const resultJson = result.json();
        resultJson.then((json) => {
          if (etag) {
            // Make a not of the new etag for the given payload
            setInCache(cache, cacheKey, [etag, json]);
          }
          resolve(json);
        });
      } else {
        return result.json().then((json) => {
          resolve(json);
        });
      }
    });
  });

  return cachedOrLiveValue;
};

export const verifyRequestSignature = (request, options) => {
  const event = request.event;
  const secret =
    options.webhookSecret || process.env.NETLIFY_GRAPH_WEBHOOK_SECRET;
  const signature = event.headers["x-netlify-graph-signature"];
  const body = event.body;

  if (!secret) {
    console.error(
      "NETLIFY_GRAPH_WEBHOOK_SECRET is not set, cannot verify incoming webhook request"
    );
    return false;
  }

  return verifySignature({ secret, signature, body: body || "" });
};

export const fetchListNetlifyEnabledServicesQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query ListNetlifyEnabledServicesQuery($logoStyle: OneGraphAppLogoStyleEnum = ROUNDED_RECTANGLE, $betaServices: [OneGraphServiceEnumArg!] = []) {
  oneGraph {
    services(
      filter: {or: [{service: {in: $betaServices}}, {supportsNetlifyGraph: true}, {supportsNetlifyApiAuthentication: true}]}
    ) {
      friendlyServiceName
      logoUrl(style: $logoStyle)
      service
      slug
      supportsCustomRedirectUri
      supportsCustomServiceAuth
      supportsOauthLogin
      netlifyGraphEnabled
      netlifyApiAuthenticationEnabled
    }
  }
}`,
    operationName: "ListNetlifyEnabledServicesQuery",
    variables: variables,
    options: options,
    fetchStrategy: "GET",
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

export const executeCreateApiTokenMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreateApiTokenMutation($input: OneGraphCreateApiTokenTokenInput!, $nfToken: String!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    createApiToken(input: $input) {
      accessToken {
        token
        userAuths {
          service
          foreignUserId
          scopes
        }
        appId
        expireDate
        name
        netlifyId
        anchor
      }
    }
  }
}`,
    operationName: "CreateApiTokenMutation",
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

export const executeCreateSharedDocumentMutation = (variables, options) => {
  return fetchNetlifyGraph({
    query: `mutation CreateSharedDocumentMutation($nfToken: String!, $input: OneGraphCreateSharedDocumentInput!) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    createSharedDocument(input: $input) {
      sharedDocument {
        id
        moderationStatus
        operationName
        services {
          friendlyServiceName
        }
        description
      }
    }
  }
}`,
    operationName: "CreateSharedDocumentMutation",
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

export const fetchListSharedDocumentsQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query ListSharedDocumentsQuery($nfToken: String!, $first: Int = 10, $status: OneGraphSharedDocumentModerationStatusEnum, $services: [OneGraphServiceEnumArg!]!, $style: OneGraphAppLogoStyleEnum = ROUNDED_RECTANGLE) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    sharedDocuments(
      first: $first
      filter: {moderationStatus: {equalTo: $status}, services: {in: $services}}
    ) {
      nodes {
        description
        body
        createdAt
        id
        moderationStatus
        operationName
        siteId
        updatedAt
        services {
          friendlyServiceName
          logoUrl(style: $style)
          service
          slug
        }
      }
    }
  }
}`,
    operationName: "ListSharedDocumentsQuery",
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

export const fetchSharedDocumentQuery = (variables, options) => {
  return fetchNetlifyGraph({
    query: `query SharedDocumentQuery($nfToken: String!, $id: String!, $logoStyle: OneGraphAppLogoStyleEnum = ROUNDED_RECTANGLE) {
  oneGraph(auths: {netlifyAuth: {oauthToken: $nfToken}}) {
    sharedDocument(id: $id) {
      body
      createdAt
      description
      id
      moderationStatus
      operationName
      updatedAt
      services {
        logoUrl(style: $logoStyle)
        friendlyServiceName
        service
        slug
      }
    }
  }
}`,
    operationName: "SharedDocumentQuery",
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

/**
 * The generated NetlifyGraph library with your operations
 */
const functions = {
  /**
   * Create a GraphQL Schema by specifying its inputs (services, external GraphQL schemas, etc.)
   */
  executeCreateGraphQLSchemaMutation: executeCreateGraphQLSchemaMutation,
  /**
   * Create a token belonging to a specific siteId to persist operations and create GraphQL schemas later
   */
  executeCreateApiTokenMutation: executeCreateApiTokenMutation,
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
  /**
   * List shared documents given a set of filters
   */
  fetchListSharedDocumentsQuery: fetchListSharedDocumentsQuery,
  /**
   * Create a document with a shared operation for others to import and use
   */
  executeCreateSharedDocumentMutation: executeCreateSharedDocumentMutation,
  /**
   * Find a shared document given its id
   */
  fetchSharedDocumentQuery: fetchSharedDocumentQuery,
  /**
   * Retrieve a list of _all_ supported services from OneGraph
   */
  fetchListNetlifyEnabledServicesQuery: fetchListNetlifyEnabledServicesQuery,
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
