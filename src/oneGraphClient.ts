import { buildClientSchema } from "graphql";
import fetch = require("node-fetch");
import { internalConsole } from "./internalConsole";
import GeneratedClient from "./generatedOneGraphClient";
// import type { CreateNewSchemaMutationInput } from "./generatedOneGraphClient";

const ONEDASH_APP_ID = "0b066ba6-ed39-4db8-a497-ba0be34d5b2a";

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
  const response = await GeneratedClient.fetchPersistedQueryQuery(
    {
      nfToken: authToken,
      appId,
      id: docId,
    },
    {
      siteId: ONEDASH_APP_ID,
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
 * @param {string} options.authToken The (typically netlify) access token that is used for authentication
 * @param {string} options.sessionId The session id to fetch CLI events for
 * @returns {Promise<{session: OneGraphCliSession , errors: any[]}>} The unhandled events for the cli session to process
 */
export const fetchCliSession = async (options: {
  appId: string;
  authToken: string;
  sessionId: string;
  desiredEventCount?: number;
}) => {
  const { appId, authToken, sessionId } = options;

  const desiredEventCount = options.desiredEventCount || 1;

  const sessionResult = await GeneratedClient.fetchCLISessionQuery(
    {
      nfToken: authToken,
      sessionId,
      first: desiredEventCount || 1000,
    },
    {
      siteId: appId,
    }
  );

  const session = sessionResult.data?.oneGraph?.netlifyCliSession || [];

  return { session: session, errors: sessionResult.errors };
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

  const next = await fetchCliSession({
    appId,
    authToken,
    sessionId,
    desiredEventCount,
  });

  const events = next.session?.events || [];

  return { errors: next.errors, events };
};

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

  const result = await GeneratedClient.executeCreateCLISessionMutation(
    payload,
    {
      siteId: appId,
    }
  );

  const session = result.data?.oneGraph?.createNetlifyCliSession?.session;

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
  const result = await GeneratedClient.executeUpdateCLISessionMetadataMutation(
    {
      nfToken: netlifyToken,
      sessionId,
      metadata,
    },
    {
      siteId: appId,
    }
  );

  const session = result.data?.oneGraph?.updateNetlifyCliSession?.session;

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
  const result = await GeneratedClient.executeAckCLISessionEventMutation(
    {
      nfToken: authToken,
      sessionId,
      eventIds,
    },
    {
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
  const result = await GeneratedClient.fetchAppSchemaQuery(
    {
      nfToken: authToken,
      appId: siteId,
    },
    {
      siteId: siteId,
    }
  );

  return result.data?.oneGraph?.app?.graphQLSchema;
};

/**
 * If a site does not exists upstream in OneGraph for the given site, create it
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
export const upsertAppForSite = async (authToken: string, siteId: string) => {
  const result = await GeneratedClient.executeUpsertAppForSiteMutation(
    {
      nfToken: authToken,
      siteId,
    },
    {
      siteId: ONEDASH_APP_ID,
    }
  );

  return result.data?.oneGraph?.upsertAppForNetlifySite?.app;
};

/**
 * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {object} input The details of the schema to create
 * @returns {Promise<object>} The schema metadata for the site
 */
export const createNewAppSchema = async (
  nfToken: string,
  input //: CreateNewSchemaMutationInput["input"]
) => {
  const result = await GeneratedClient.executeCreateNewSchemaMutation(
    {
      nfToken,
      input: input,
    },
    {
      siteId: input.appId,
    }
  );

  return result.data?.oneGraph?.createGraphQLSchema?.graphqlSchema;
};

/**
 * Ensure that an app exists upstream in OneGraph for the given site
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
export const ensureAppForSite = async (authToken: string, siteId: string) => {
  const upsertResult = await GeneratedClient.executeUpsertAppForSiteMutation(
    {
      nfToken: authToken,
      siteId: siteId,
    },
    {
      siteId: ONEDASH_APP_ID,
    }
  );

  const appId = upsertResult.data?.oneGraph?.upsertAppForNetlifySite?.app?.id;

  const schema = await GeneratedClient.fetchAppSchemaQuery(
    {
      nfToken: authToken,
      appId,
    },
    {
      siteId: appId,
    }
  );

  if (!schema) {
    internalConsole.log(
      `Creating new empty default GraphQL schema for site....`
    );
    await GeneratedClient.executeCreateNewSchemaMutation(
      {
        nfToken: authToken,
        input: {
          appId: siteId,
          enabledServices: ["ONEGRAPH"],
          setAsDefaultForApp: true,
        },
      },
      {
        siteId: appId,
      }
    );
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
  const appSchemaResult = await GeneratedClient.fetchAppSchemaQuery(
    {
      nfToken: authToken,
      appId,
    },
    {
      siteId: appId,
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
 * @param {string} authToken The (typically netlify) access token that is used for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to mark as active / update heartbeat
 * @returns {errors: any[], data: MiniSession}
 */
export const executeMarkCliSessionActiveHeartbeat = async (
  authToken: string,
  appId: string,
  sessionId: string
) => {
  const result = await GeneratedClient.executeMarkCLISessionActiveHeartbeat(
    {
      nfToken: authToken,
      id: sessionId,
    },
    {
      siteId: appId,
    }
  );

  const session = result.data?.oneGraph?.updateNetlifyCliSession?.session;

  return { errors: result.errors, data: session };
};

/**
 * Mark a CLI session as inactive
 * @param {string} authToken The (typically netlify) access token that is used for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to mark as inactive
 * @returns {errors: any[], data: MiniSession}
 */
export const executeMarkCliSessionInactive = async (
  authToken: string,
  appId: string,
  sessionId: string
) => {
  const result = await GeneratedClient.executeMarkCLISessionInactive(
    {
      nfToken: authToken,
      id: sessionId,
    },
    {
      siteId: appId,
    }
  );

  const session = result.data?.oneGraph?.updateNetlifyCliSession?.session;

  return { errors: result.errors, data: session };
};

export const executeCreatePersistQueryTokenMutation =
  GeneratedClient.executeCreatePersistQueryTokenMutation;

export const executeCreateGraphQLSchemaMutation =
  GeneratedClient.executeCreateGraphQLSchemaMutation;
