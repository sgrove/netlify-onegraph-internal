import { buildClientSchema } from "graphql";
import fetch from "node-fetch";
import { internalConsole } from "./internalConsole";
import GeneratedClient from "./generatedOneGraphClient";
import type {
  CLISessionQuery,
  CreateNewSchemaMutationInput,
} from "./generatedOneGraphClient";
import type { GraphQLSchema, IntrospectionQuery } from "graphql";

const ONEDASH_APP_ID = "0b066ba6-ed39-4db8-a497-ba0be34d5b2a";

const netlifyGraphHost = "graph.netlify.com";

const netlifyApiRoot = "https://api.netlify.com/api";

export type JwtResult = {
  jwt: string;
  expiration: number;
};

// Caches the jwt so that we don't fetch a new one every graph call
const graphJwtCache: Map<string, Promise<JwtResult> | JwtResult> = new Map();

const EARLY_REFRESH_THRESHOLD_MS = 1000 * 60 * 5; // 5 minutes

function shouldRefresh(cacheResult: Promise<JwtResult> | JwtResult): boolean {
  if (
    "jwt" in cacheResult && // If we're still fulfilling the promise we're good
    cacheResult.expiration - EARLY_REFRESH_THRESHOLD_MS < performance.now()
  ) {
    return true;
  }
  return false;
}

const __netlifyGraphJwt = async ({
  siteId,
  nfToken,
}: {
  siteId: string;
  nfToken: string;
}) => {
  const url = `${netlifyApiRoot}/v1/sites/${siteId}/jwt`;
  const options = {
    headers: {
      "Content-type": "application/json",
      Authorization: `bearer ${nfToken}`,
    },
  };

  const resp = await fetch(url, options);

  if (resp.status === 200) {
    return resp.json();
  } else {
    throw new Error(
      `Non-200 status when exchanging API token for short-lived JWT: ${resp.status}`
    );
  }
};

export function getGraphJwtForSite({
  siteId,
  nfToken,
}: {
  siteId: string;
  nfToken: string;
}) {
  const cacheResult = graphJwtCache.get(siteId);
  if (cacheResult && !shouldRefresh(cacheResult)) {
    return Promise.resolve(cacheResult);
  }
  const result: Promise<JwtResult> = __netlifyGraphJwt({ siteId, nfToken })
    .then(({ jwt }) => {
      const base64Payload = jwt
        .split(".")[1]
        // url-safe -> ordinary base64
        .replace(/_/g, "/")
        .replace(/-/g, "+");
      const payload = JSON.parse(atob(base64Payload));
      const expirationTicks = payload.exp - payload.iat;
      // use performance.now in case the browser's clock is way off
      const expiration = performance.now() + expirationTicks * 1000;
      graphJwtCache.set(siteId, { jwt, expiration });
      return { jwt, expiration };
    })
    .catch((e) => {
      graphJwtCache.delete(siteId);
      throw e;
    });
  graphJwtCache.set(siteId, result);
  return result;
}

/**
 * Fetch a schema (in json form) for an app by its schemaId
 * @param {object} input
 * @param {string} input.appId
 * @param {string} input.schemaId
 * @param {string} input.accessToken
 * @returns {Promise<Record<string, any>>} The schema json
 */
export const fetchOneGraphSchemaByIdJson = async ({
  appId,
  schemaId,
  accessToken,
}: {
  appId: string;
  schemaId: string;
  accessToken: string;
}): Promise<{ data: IntrospectionQuery } | undefined> => {
  const url = `https://${netlifyGraphHost}/schema?app_id=${appId}&schemaId=${schemaId}`;
  const authorizationHeader = accessToken
    ? { authorization: `Bearer ${accessToken}` }
    : {};
  const headers = { ...authorizationHeader };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      body: null,
    });

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    internalConsole.error(
      `Error fetching schema: ${JSON.stringify(error, null, 2)}`
    );
  }
};

/**
 * Fetch a schema and parse it for an app by its schemaId
 * @param {object} input
 * @param {string} input.siteId
 * @param {string} input.schemaId
 * @param {string} input.accessToken
 * @returns {Promise<GraphQLSchema>} The schema for the app
 */
export const fetchOneGraphSchemaById = async ({
  siteId,
  schemaId,
  accessToken,
}: {
  siteId: string;
  schemaId: string;
  accessToken: string;
}): Promise<GraphQLSchema | undefined> => {
  const result = await fetchOneGraphSchemaByIdJson({
    accessToken,
    appId: siteId,
    schemaId,
  });

  if (!result) {
    return;
  }

  const schema = buildClientSchema(result.data);
  return schema;
};

/**
 * Given an appId and desired services, fetch the schema (in json form) for that app
 * @param {string} appId
 * @param {string[]} enabledServices
 * @returns {Promise<Record<string, unknown>>} The schema for the app
 */
export const fetchOneGraphSchemaForServicesJson = async (
  appId: string,
  enabledServices: string[]
): Promise<{ data: IntrospectionQuery } | undefined> => {
  const url = `https://${netlifyGraphHost}/schema?app_id=${appId}&services=${enabledServices.join(
    ","
  )}`;
  const headers = {};

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      body: null,
    });

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    internalConsole.error(
      `Error fetching schema: ${JSON.stringify(error, null, 2)}`
    );
    return;
  }
};

/**
 * Given an appId and desired services, fetch the schema json for an app and parse it into a GraphQL Schema
 * @param {string} appId
 * @param {string[]} enabledServices
 * @returns {Promise<GraphQLSchema>} The schema for the app
 */
export const fetchOneGraphSchemaForServices = async (
  appId: string,
  enabledServices: string[]
): Promise<GraphQLSchema | undefined> => {
  const result = await fetchOneGraphSchemaForServicesJson(
    appId,
    enabledServices
  );

  if (!result) {
    return;
  }

  const schema = buildClientSchema(result.data);
  return schema;
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
 * @param {string} jwt
 * @param {string} appId
 * @param {string} docId
 * @returns {string|undefined} The persisted operations doc
 */
export const fetchPersistedQuery = async (
  jwt: string,
  appId: string,
  docId: string
): Promise<PersistedQuery | undefined> => {
  const response = await GeneratedClient.fetchPersistedQueryQuery(
    {
      appId,
      id: docId,
    },
    {
      siteId: ONEDASH_APP_ID,
      accessToken: jwt,
    }
  );

  const persistedQuery = response.data?.oneGraph?.persistedQuery;

  return persistedQuery;
};

type OneGraphCliEvent = Record<string, any>;

/**
 *
 * @param {object} options
 * @param {string} options.appId The app to query against, typically the siteId
 * @param {string} options.jwt The netlify jwt that is used for authentication
 * @param {string} options.sessionId The session id to fetch CLI events for
 * @returns {Promise<{session: CLISessionQuery["data"]["oneGraph"]["netlifyCliSession"] , errors: any[]}>} The unhandled events for the cli session to process
 */
export const fetchCliSession = async (options: {
  appId: string;
  jwt: string;
  sessionId: string;
  desiredEventCount?: number;
}): Promise<{
  session: CLISessionQuery["data"]["oneGraph"]["netlifyCliSession"];
  errors: any[];
}> => {
  const { appId, jwt, sessionId } = options;

  const desiredEventCount = options.desiredEventCount || 1;

  const sessionResult = await GeneratedClient.fetchCLISessionQuery(
    {
      sessionId,
      first: desiredEventCount || 1000,
    },
    {
      siteId: appId,
      accessToken: jwt,
    }
  );

  const session = sessionResult.data?.oneGraph?.netlifyCliSession || [];

  return { session: session, errors: sessionResult.errors };
};

/**
 *
 * @param {object} options
 * @param {string} options.appId The app to query against, typically the siteId
 * @param {string} options.jwt The netlify jwt that is used for authentication
 * @param {string} options.sessionId The session id to fetch CLI events for
 * @returns {Promise<OneGraphCliEvent[]|undefined>} The unhandled events for the cli session to process
 */
export const fetchCliSessionEvents = async (options: {
  appId: string;
  jwt: string;
  sessionId: string;
}): Promise<{ events?: OneGraphCliEvent[]; errors?: any[] } | undefined> => {
  const { appId, jwt, sessionId } = options;

  // Grab the first 1000 events so we can chew through as many at a time as possible
  const desiredEventCount = 1000;

  const next = await fetchCliSession({
    appId,
    jwt,
    sessionId,
    desiredEventCount,
  });

  const events = next.session?.events || [];

  return { errors: next.errors, events };
};

/**
 * Register a new CLI session with OneGraph
 * @param {string} jwt The netlify jwt to use for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} name The name of the CLI session, will be visible in the UI and CLI ouputs
 * @param {object} metadata Any additional metadata to attach to the session
 * @returns {Promise<object|undefined>} The CLI session object
 */
export const createCLISession = async (
  jwt: string,
  appId: string,
  name: string,
  metadata: Record<string, any>
): Promise<object | undefined> => {
  const payload = {
    appId,
    name,
    metadata,
  };

  const result = await GeneratedClient.executeCreateCLISessionMutation(
    payload,
    {
      siteId: appId,
      accessToken: jwt,
    }
  );

  const session = result.data?.oneGraph?.createNetlifyCliSession?.session;

  return session;
};

/**
 * Update the CLI session with new metadata (e.g. the latest docId) by its id
 * @param {string} jwt The netlify jwt to use for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to update
 * @param {object} metadata The new metadata to set on the session
 * @returns {Promise<object|undefined>} The updated session object
 */
export const updateCLISessionMetadata = async (
  jwt: string,
  appId: string,
  sessionId: string,
  metadata: Record<string, any>
): Promise<object | undefined> => {
  const result = await GeneratedClient.executeUpdateCLISessionMetadataMutation(
    {
      sessionId,
      metadata,
    },
    {
      siteId: appId,
      accessToken: jwt,
    }
  );

  const session = result.data?.oneGraph?.updateNetlifyCliSession?.session;

  return session;
};

/**
 * Acknoledge CLI events that have been processed and delete them from the upstream queue
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.jwt The netlify jwt that is used for authentication, if any
 * @param {string} input.sessionId The session id the events belong to
 * @param {string[]} input.eventIds The event ids to ack (and delete) from the session queue, having been processed
 * @returns
 */
export const ackCLISessionEvents = async (input: {
  appId: string;
  jwt: string;
  sessionId: string;
  eventIds: string[];
}) => {
  const { appId, jwt, eventIds, sessionId } = input;
  const result = await GeneratedClient.executeAckCLISessionEventMutation(
    {
      sessionId,
      eventIds,
    },
    {
      accessToken: jwt,
      siteId: appId,
    }
  );

  const events = result.data?.oneGraph?.ackNetlifyCliEvents;

  return events;
};

export const executeCreatePersistedQueryMutation =
  GeneratedClient.executeCreatePersistedQueryMutation;

/**
 *
 * @param {OneGraphCliEvent} event
 * @returns {string} a human-friendly description of the event
 */
export const friendlyEventName = (event: OneGraphCliEvent): string => {
  const { __typename, payload } = event;
  switch (__typename) {
    case "OneGraphNetlifyCliSessionTestEvent":
      return friendlyEventName(payload);
    case "OneGraphNetlifyCliSessionGenerateHandlerEvent":
      return "Generate handler as Netlify function ";
    case "OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent":
      return `Sync Netlify Graph operations library`;
    case "OneGraphNetlifyCliSessionOpenFileEvent":
      return `Open file ${payload.filePath}`;
    default: {
      return `Unrecognized event (${__typename})`;
    }
  }
};

export type OneGraphCliEventAudience = "ui" | "cli";
/**
 *
 * @param {OneGraphCliEvent} event
 * @returns {'ui' | 'cli'} Which audience the event is intended for
 */
export const eventAudience = (
  event: OneGraphCliEvent
): OneGraphCliEventAudience => {
  const { __typename, payload } = event;
  switch (__typename) {
    case "OneGraphNetlifyCliSessionTestEvent":
      return eventAudience(payload);
    case "OneGraphNetlifyCliSessionFileWrittenEvent":
      return "ui";
    default: {
      return "cli";
    }
  }
};

/**
 * Fetch the schema metadata for a site (enabled services, id, etc.)
 */
export const fetchAppSchemaQuery: typeof GeneratedClient.fetchAppSchemaQuery =
  GeneratedClient.fetchAppSchemaQuery;

/**
 * If a site does not exists upstream in OneGraph for the given site, create it
 * @param {string} jwt The netlify jwt that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
export const upsertAppForSite = async (jwt: string, siteId: string) => {
  const result = await GeneratedClient.executeUpsertAppForSiteMutation(
    {
      siteId,
    },
    {
      siteId: ONEDASH_APP_ID,
      accessToken: jwt,
    }
  );

  return result.data?.oneGraph?.upsertAppForNetlifySite?.app;
};

/**
 * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
 * @param {string} jwt The netlify jwt that is used for authentication, if any
 * @param {object} input The details of the schema to create
 * @returns {Promise<object>} The schema metadata for the site
 */
export const createNewAppSchema = async (
  jwt: string,
  input: CreateNewSchemaMutationInput["input"]
): Promise<object> => {
  const result = await GeneratedClient.executeCreateNewSchemaMutation(
    {
      input: input,
    },
    {
      siteId: input.appId,
      accessToken: jwt,
    }
  );

  return result.data?.oneGraph?.createGraphQLSchema?.graphqlSchema;
};

/**
 * Ensure that an app exists upstream in OneGraph for the given site
 * @param {string} jwt The netlify jwt that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
export const ensureAppForSite = async (jwt: string, siteId: string) => {
  const upsertResult = await GeneratedClient.executeUpsertAppForSiteMutation(
    {
      siteId: siteId,
    },
    {
      siteId: ONEDASH_APP_ID,
      accessToken: jwt,
    }
  );

  const appId = upsertResult.data?.oneGraph?.upsertAppForNetlifySite?.app?.id;

  const schema = await GeneratedClient.fetchAppSchemaQuery(
    {
      appId,
    },
    {
      siteId: appId,
      accessToken: jwt,
    }
  );

  if (!schema) {
    internalConsole.log(
      `Creating new empty default GraphQL schema for site....`
    );
    await GeneratedClient.executeCreateNewSchemaMutation(
      {
        input: {
          appId: siteId,
          enabledServices: ["ONEGRAPH"],
          setAsDefaultForApp: true,
        },
      },
      {
        siteId: appId,
        accessToken: jwt,
      }
    );
  }
};

/**
 * Fetch a list of what services are enabled for the given site
 * @param {string} jwt The netlify jwt that is used for authentication, if any
 * @param {string} appId The app id to query against
 * @returns
 */
export const fetchEnabledServices = async (jwt: string, appId: string) => {
  const appSchemaResult = await GeneratedClient.fetchAppSchemaQuery(
    {
      appId,
    },
    {
      siteId: appId,
      accessToken: jwt,
    }
  );
  return appSchemaResult.data?.oneGraph?.app?.graphQLSchema?.services;
};

export type MiniSession = {
  id: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

/**
 * Mark a CLI session as active and update the session's heartbeat
 * @param {string} jwt The netlify jwt that is used for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to mark as active / update heartbeat
 * @returns {Promise<{ errors: any[]; data: MiniSession }>}
 */
export const executeMarkCliSessionActiveHeartbeat = async (
  jwt: string,
  appId: string,
  sessionId: string
): Promise<{ errors: any[]; data: MiniSession }> => {
  const result = await GeneratedClient.executeMarkCLISessionActiveHeartbeat(
    {
      id: sessionId,
    },
    {
      siteId: appId,
      accessToken: jwt,
    }
  );

  const session = result.data?.oneGraph?.updateNetlifyCliSession?.session;

  return { errors: result.errors, data: session };
};

/**
 * Mark a CLI session as inactive
 * @param {string} jwt The netlify jwt that is used for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to mark as inactive
 * @returns {Promise<{ errors: any[]; data: MiniSession }>}
 */
export const executeMarkCliSessionInactive = async (
  jwt: string,
  appId: string,
  sessionId: string
): Promise<{ errors: any[]; data: MiniSession }> => {
  const result = await GeneratedClient.executeMarkCLISessionInactive(
    {
      id: sessionId,
    },
    {
      siteId: appId,
      accessToken: jwt,
    }
  );

  const session = result.data?.oneGraph?.updateNetlifyCliSession?.session;

  return { errors: result.errors, data: session };
};

export const executeCreateApiTokenMutation: typeof GeneratedClient.executeCreateApiTokenMutation =
  GeneratedClient.executeCreateApiTokenMutation;

export const executeCreateGraphQLSchemaMutation: typeof GeneratedClient.executeCreateGraphQLSchemaMutation =
  GeneratedClient.executeCreateGraphQLSchemaMutation;

/**
 * List shared documents given a set of filters
 */
export const fetchListSharedDocumentsQuery: typeof GeneratedClient.fetchListSharedDocumentsQuery =
  GeneratedClient.fetchListSharedDocumentsQuery;
/**
 * Create a document with a shared operation for others to import and use
 */
export const executeCreateSharedDocumentMutation: typeof GeneratedClient.executeCreateSharedDocumentMutation =
  GeneratedClient.executeCreateSharedDocumentMutation;
/**
 * Find a shared document given its id
 */
export const fetchSharedDocumentQuery: typeof GeneratedClient.fetchSharedDocumentQuery =
  GeneratedClient.fetchSharedDocumentQuery;

/**
 * Find a shared document given its id
 */
export const fetchListNetlifyEnabledServicesQuery: typeof GeneratedClient.fetchListNetlifyEnabledServicesQuery =
  GeneratedClient.fetchListNetlifyEnabledServicesQuery;

/**
 * Create a new event for a CLI session to consume
 */
export const executeCreateCLISessionEventMutation: typeof GeneratedClient.executeCreateCLISessionEventMutation =
  GeneratedClient.executeCreateCLISessionEventMutation;
