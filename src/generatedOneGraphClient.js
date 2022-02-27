// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
import buffer from "buffer";
import crypto from "crypto";
import https from "https";
import process from "process";

export const verifySignature = (input) => {
  const secret = input.secret;
  const body = input.body;
  const signature = input.signature;

  if (!signature) {
    console.error("Missing signature");
    return false;
  }

  const sig = {};
  for (const pair of signature.split(",")) {
    const [key, value] = pair.split("=");
    sig[key] = value;
  }

  if (!sig.t || !sig.hmac_sha256) {
    console.error("Invalid signature header");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", secret)
    .update(sig.t)
    .update(".")
    .update(body)
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(sig.hmac_sha256, "hex")
    )
  ) {
    console.error("Invalid signature");
    return false;
  }

  if (parseInt(sig.t, 10) < Date.now() / 1000 - 300 /* 5 minutes */) {
    console.error("Request is too old");
    return false;
  }

  return true;
};

const httpGet = (input) => {
  const userHeaders = input.headers || {};
  const fullHeaders = {
    ...userHeaders,
    "Content-Type": "application/json",
  };
  const timeoutMs = 30_000;
  const reqOptions = {
    method: "GET",
    headers: fullHeaders,
    timeout: timeoutMs,
  };

  if (!input.docId) {
    throw new Error(
      "docId is required for GET requests: " + input.operationName
    );
  }

  const schemaId = input.schemaId || undefined;

  const encodedVariables = encodeURIComponent(input.variables || "null");
  const url =
    "https://serve.onegraph.com/graphql?app_id=" +
    input.siteId +
    "&doc_id=" +
    input.docId +
    (input.operationName ? "&operationName=" + input.operationName : "") +
    (schemaId ? "&schemaId=" + schemaId : "") +
    "&variables=" +
    encodedVariables;

  const respBody = [];

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
        return reject(
          new Error(
            "Netlify Graph return non-OK HTTP status code" + res.statusCode
          )
        );
      }

      res.on("data", (chunk) => respBody.push(chunk));

      res.on("end", () => {
        const resString = buffer.Buffer.concat(respBody).toString();
        resolve(resString);
      });
    });

    req.on("error", (error) => {
      console.error("Error making request to Netlify Graph:", error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request to Netlify Graph timed out"));
    });

    req.end();
  });
};

const httpPost = (input) => {
  const reqBody = input.body || null;
  const userHeaders = input.headers || {};
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
  };

  const schemaId = input.schemaId || undefined;

  const url =
    "https://serve.onegraph.com/graphql?app_id=" +
    input.siteId +
    (schemaId ? "&schemaId=" + schemaId : "");
  const respBody = [];

  return new Promise((resolve, reject) => {
    const req = https.request(url, reqOptions, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
        return reject(
          new Error(
            "Netlify Graph return non-OK HTTP status code" + res.statusCode
          )
        );
      }

      res.on("data", (chunk) => respBody.push(chunk));

      res.on("end", () => {
        const resString = buffer.Buffer.concat(respBody).toString();
        resolve(resString);
      });
    });

    req.on("error", (error) => {
      console.error("Error making request to Netlify Graph:", error);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request to Netlify Graph timed out"));
    });

    req.write(reqBody);
    req.end();
  });
};

const fetchNetlifyGraph = function fetchNetlifyGraph(input) {
  const docId = input.doc_id;
  const operationName = input.operationName;
  const variables = input.variables;

  const options = input.options || {};
  const accessToken = options.accessToken;
  const siteId = options.siteId || process.env.SITE_ID;

  const httpMethod = input.fetchStrategy === "GET" ? httpGet : httpPost;

  const response = httpMethod({
    siteId: siteId,
    docId: docId,
    query: input.query,
    headers: {
      Authorization: accessToken ? "Bearer " + accessToken : "",
    },
    variables: variables,
    operationName: operationName,
  });

  return response.then((result) => JSON.parse(result));
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
