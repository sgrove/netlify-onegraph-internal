// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!

export type NetlifyGraphFunctionOptions = {
  /**
   * The accessToken to use for the request
   */
  accessToken?: string;
  /**
   * The siteId to use for the request
   * @default process.env.SITE_ID
   */
  siteId?: string;
};

export type WebhookEvent = {
  body: string;
  headers: Record<string, string | null | undefined>;
};

export type GraphQLError = {
  path: Array<string | number>;
  message: string;
  extensions: Record<string, unknown>;
};

export type AckCLISessionEventMutationInput = {
  nfToken: string;
  sessionId: string;
  eventIds: Array<string>;
};

export type AckCLISessionEventMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Acknowledge a set of netlify CLI events for a session. All events must be for the same session.
       */
      ackNetlifyCliEvents: {
        /**
         * The list of events that were acknowledged
         */
        events: Array<{
          id: string;
        }>;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Acknowledge CLI events that have been processed and delete them from the upstream queue
 */
export function executeAckCLISessionEventMutation(
  variables: AckCLISessionEventMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<AckCLISessionEventMutation>;

export type CreateCLISessionEventMutationInput = {
  nfToken: string;
  sessionId: string;
  payload: unknown;
};

export type CreateCLISessionEventMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      createNetlifyCliTestEvent: {
        event: {
          id: string;
          createdAt: string;
          sessionId: string;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 *
 */
export function executeCreateCLISessionEventMutation(
  variables: CreateCLISessionEventMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateCLISessionEventMutation>;

export type CreateCLISessionMutationInput = {
  nfToken: string;
  appId: string;
  /**
   * An optional name for the session
   */
  name: string;
  /**
   * Optional metadata for the session
   */
  metadata?: unknown;
};

export type CreateCLISessionMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Create a new CLI session.
       */
      createNetlifyCliSession: {
        /**
         * The session that was created.
         */
        session: {
          id: string;
          appId: string;
          netlifyUserId: string;
          name: string;
          /**
           * Number of milliseconds to wait between heartbeats
           */
          cliHeartbeatIntervalMs: number;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Register a new CLI session with OneGraph
 */
export function executeCreateCLISessionMutation(
  variables: CreateCLISessionMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateCLISessionMutation>;

export type CreateNewSchemaMutationInput = {
  nfToken: string;
  input: {
    /**
     * Whether to set this schema as the default for the app. Defaults to false.
     */
    setAsDefaultForApp?: boolean;
    /**
     * External GraphQL schemas to add
     */
    externalGraphQLSchemas?: Array<{
      /**
       * The id of the external GraphQL schema.
       */
      externalGraphQLSchemaId: string;
    }>;
    /**
     * Optional id of a Salesforce schema to attach to the app.
     */
    salesforceSchemaId?: string;
    /**
     * The optional id of the GraphQL schema that this was derived from.
     */
    parentId?: string;
    /**
     * The list of services that this schema should use. Leave blank if you want to add support for all supported services.
     */
    enabledServices?: Array<
      | "ADROLL"
      | "ASANA"
      | "BOX"
      | "CONTENTFUL"
      | "DEV_TO"
      | "DOCUSIGN"
      | "DRIBBBLE"
      | "DROPBOX"
      | "EGGHEADIO"
      | "EVENTIL"
      | "FACEBOOK"
      | "FIREBASE"
      | "GITHUB"
      | "GMAIL"
      | "GONG"
      | "GOOGLE"
      | "GOOGLE_ADS"
      | "GOOGLE_ANALYTICS"
      | "GOOGLE_CALENDAR"
      | "GOOGLE_COMPUTE"
      | "GOOGLE_DOCS"
      | "GOOGLE_SEARCH_CONSOLE"
      | "GOOGLE_TRANSLATE"
      | "HUBSPOT"
      | "INTERCOM"
      | "MAILCHIMP"
      | "MEETUP"
      | "NETLIFY"
      | "NOTION"
      | "OUTREACH"
      | "PRODUCT_HUNT"
      | "QUICKBOOKS"
      | "SALESFORCE"
      | "SANITY"
      | "SLACK"
      | "SPOTIFY"
      | "STRIPE"
      | "TRELLO"
      | "TWILIO"
      | "TWITTER"
      | "TWITCH_TV"
      | "YNAB"
      | "YOUTUBE"
      | "ZEIT"
      | "ZENDESK"
      | "AIRTABLE"
      | "APOLLO"
      | "BREX"
      | "BUNDLEPHOBIA"
      | "CHARGEBEE"
      | "CLEARBIT"
      | "CLOUDFLARE"
      | "CRUNCHBASE"
      | "DESCURI"
      | "FEDEX"
      | "GOOGLE_MAPS"
      | "GRAPHCMS"
      | "IMMIGRATION_GRAPH"
      | "LOGDNA"
      | "MIXPANEL"
      | "MUX"
      | "NPM"
      | "ONEGRAPH"
      | "ORBIT"
      | "OPEN_COLLECTIVE"
      | "RSS"
      | "UPS"
      | "USPS"
      | "WORDPRESS"
    >;
    /**
     * The id of the app that the schema should belong to.
     */
    appId: string;
  };
};

export type CreateNewSchemaMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      createGraphQLSchema: {
        app: {
          /**
           * Customizations to the default GraphQL schema
           */
          graphQLSchema: {
            id: string;
          };
        };
        graphqlSchema: {
          id: string;
          services: Array<{
            friendlyServiceName: string;
            /**
             * A short-lived svg image url of the logo for the service. May be null.
             */
            logoUrl: string;
            service:
              | "ADROLL"
              | "ASANA"
              | "BOX"
              | "CONTENTFUL"
              | "DEV_TO"
              | "DOCUSIGN"
              | "DRIBBBLE"
              | "DROPBOX"
              | "EGGHEADIO"
              | "EVENTIL"
              | "FACEBOOK"
              | "FIREBASE"
              | "GITHUB"
              | "GMAIL"
              | "GONG"
              | "GOOGLE"
              | "GOOGLE_ADS"
              | "GOOGLE_ANALYTICS"
              | "GOOGLE_CALENDAR"
              | "GOOGLE_COMPUTE"
              | "GOOGLE_DOCS"
              | "GOOGLE_SEARCH_CONSOLE"
              | "GOOGLE_TRANSLATE"
              | "HUBSPOT"
              | "INTERCOM"
              | "MAILCHIMP"
              | "MEETUP"
              | "NETLIFY"
              | "NOTION"
              | "OUTREACH"
              | "PRODUCT_HUNT"
              | "QUICKBOOKS"
              | "SALESFORCE"
              | "SANITY"
              | "SLACK"
              | "SPOTIFY"
              | "STRIPE"
              | "TRELLO"
              | "TWILIO"
              | "TWITTER"
              | "TWITCH_TV"
              | "YNAB"
              | "YOUTUBE"
              | "ZEIT"
              | "ZENDESK"
              | "AIRTABLE"
              | "APOLLO"
              | "BREX"
              | "BUNDLEPHOBIA"
              | "CHARGEBEE"
              | "CLEARBIT"
              | "CLOUDFLARE"
              | "CRUNCHBASE"
              | "DESCURI"
              | "FEDEX"
              | "GOOGLE_MAPS"
              | "GRAPHCMS"
              | "IMMIGRATION_GRAPH"
              | "LOGDNA"
              | "MIXPANEL"
              | "MUX"
              | "NPM"
              | "ONEGRAPH"
              | "ORBIT"
              | "OPEN_COLLECTIVE"
              | "RSS"
              | "UPS"
              | "USPS"
              | "WORDPRESS";
            /**
             * Service string that can be provided in the URL when going through the oauth flow.
             */
            slug: string;
            supportsCustomRedirectUri: boolean;
            supportsCustomServiceAuth: boolean;
            supportsOauthLogin: boolean;
          }>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
 */
export function executeCreateNewSchemaMutation(
  variables: CreateNewSchemaMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateNewSchemaMutation>;

export type CreatePersistedQueryMutationInput = {
  nfToken: string;
  cacheStrategy?: {
    /**
     * Number of seconds to cache the query result for.
     */
    timeToLiveSeconds: number;
  };
  /**
   * Operation names to allow. If not provided, then all operations in the document are allowed.
   */
  allowedOperationNames: Array<string>;
  /**
 * If set to true, and there was a successful execution of the query in the last 30 days, then the last successful result will be returned if we encounter any error when executing the query. If we do not have a previous successful result, then the response with the error will be returned.

Note that the fallback result will be returned even in the case of partial success.

This parameter is useful when you expect that your queries might be rate-limited by the underlying service.

The query must provide a cache strategy in order to use `fallbackOnError`.
 */
  fallbackOnError: boolean;
  freeVariables: Array<string>;
  query: string;
  /**
   * List of tags to add to the persisted query. Tags are free-form text that can be used to categorize persisted queries. Each tag must be under 256 characters and there can be a maximum of 10 tags on a single persisted query.
   */
  tags: Array<string>;
  /**
   * A description for the persisted query. Maximum length is 2096 characters.
   */
  description?: string;
  appId: string;
};

export type CreatePersistedQueryMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      createPersistedQuery: {
        persistedQuery: {
          /**
           * The persisted query's id.
           */
          id: string;
          /**
           * The list of operation names that the caller of the query is allowed to execute. If the field is null, then all operationNames are allowed.
           */
          allowedOperationNames: Array<string>;
          /**
           * The user-defined description that was added to the query
           */
          description: string;
          /**
           * The default variables provided to the query.
           */
          fixedVariables: unknown;
          /**
           * The list of variables that the caller of the query is allowed to provide.
           */
          freeVariables: Array<string>;
          /**
           * The persisted query's query string.
           */
          query: string;
          /**
           * The list of user-defined tags that were added to the query
           */
          tags: Array<string>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Create a persisted operations doc to be later retrieved, usually from a GUI
 */
export function executeCreatePersistedQueryMutation(
  variables: CreatePersistedQueryMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreatePersistedQueryMutation>;

export type MarkCLISessionActiveHeartbeatInput = {
  nfToken: string;
  /**
   * The id of the session
   */
  id: string;
};

export type MarkCLISessionActiveHeartbeat = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Update a CLI session.
       */
      updateNetlifyCliSession: {
        /**
         * The session that was updated.
         */
        session: {
          id: string;
          status: "ACTIVE" | "INACTIVE";
          createdAt: string;
          updatedAt: string;
          /**
           * Number of milliseconds to wait between heartbeats
           */
          cliHeartbeatIntervalMs: number;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Mark a CLI session as active and update the session's heartbeat
 */
export function executeMarkCLISessionActiveHeartbeat(
  variables: MarkCLISessionActiveHeartbeatInput,
  options?: NetlifyGraphFunctionOptions
): Promise<MarkCLISessionActiveHeartbeat>;

export type MarkCLISessionInactiveInput = {
  nfToken: string;
  /**
   * The id of the session
   */
  id: string;
};

export type MarkCLISessionInactive = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Update a CLI session.
       */
      updateNetlifyCliSession: {
        /**
         * The session that was updated.
         */
        session: {
          id: string;
          status: "ACTIVE" | "INACTIVE";
          createdAt: string;
          updatedAt: string;
          /**
           * Number of milliseconds to wait between heartbeats
           */
          cliHeartbeatIntervalMs: number;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Mark a CLI session as inactive
 */
export function executeMarkCLISessionInactive(
  variables: MarkCLISessionInactiveInput,
  options?: NetlifyGraphFunctionOptions
): Promise<MarkCLISessionInactive>;

export type UpdateCLISessionMetadataMutationInput = {
  nfToken: string;
  /**
   * The id of the session
   */
  sessionId: string;
  /**
   * Optional metadata for the session
   */
  metadata: unknown;
};

export type UpdateCLISessionMetadataMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Update a CLI session.
       */
      updateNetlifyCliSession: {
        /**
         * The session that was updated.
         */
        session: {
          id: string;
          name: string;
          metadata: unknown;
          /**
           * Number of milliseconds to wait between heartbeats
           */
          cliHeartbeatIntervalMs: number;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Update the CLI session with new metadata (e.g. the latest docId) by its id
 */
export function executeUpdateCLISessionMetadataMutation(
  variables: UpdateCLISessionMetadataMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<UpdateCLISessionMetadataMutation>;

export type UpsertAppForSiteMutationInput = {
  nfToken: string;
  siteId: string;
};

export type UpsertAppForSiteMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      upsertAppForNetlifySite: {
        /**
         * The app that is associated with the Netlify account.
         */
        org: {
          /**
           * The id of the OneGraph Org
           */
          id: string;
          /**
           * The name of the OneGraph Org
           */
          name: string;
        };
        /**
         * The app that is associated with the Netlify site.
         */
        app: {
          /**
           * The id of the OneGraph App
           */
          id: string;
          /**
           * The name of the OneGraph App
           */
          name: string;
          /**
           * The origins allowed for this OneGraph App from CORS requests
           */
          corsOrigins: Array<string>;
          /**
           * Custom cors origins
           */
          customCorsOrigins: Array<{
            /**
             * The friendly service name for the cors origin
             */
            friendlyServiceName: string;
            /**
             * The name of the origin that should be displayed, e.g. oneblog for oneblog.netlify.app.
             */
            displayName: string;
            /**
             * The encoded value as a string, used to remove the custom cors origin.
             */
            encodedValue: string;
          }>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * If a site does not exists upstream in OneGraph for the given site, create it
 */
export function executeUpsertAppForSiteMutation(
  variables: UpsertAppForSiteMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<UpsertAppForSiteMutation>;

export type AppSchemaQueryInput = {
  nfToken: string;
  /**
   * App id
   */
  appId: string;
};

export type AppSchemaQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      app: {
        /**
         * Customizations to the default GraphQL schema
         */
        graphQLSchema: {
          appId: string;
          createdAt: string;
          id: string;
          services: Array<{
            friendlyServiceName: string;
            /**
             * A short-lived svg image url of the logo for the service. May be null.
             */
            logoUrl: string;
            service:
              | "ADROLL"
              | "ASANA"
              | "BOX"
              | "CONTENTFUL"
              | "DEV_TO"
              | "DOCUSIGN"
              | "DRIBBBLE"
              | "DROPBOX"
              | "EGGHEADIO"
              | "EVENTIL"
              | "FACEBOOK"
              | "FIREBASE"
              | "GITHUB"
              | "GMAIL"
              | "GONG"
              | "GOOGLE"
              | "GOOGLE_ADS"
              | "GOOGLE_ANALYTICS"
              | "GOOGLE_CALENDAR"
              | "GOOGLE_COMPUTE"
              | "GOOGLE_DOCS"
              | "GOOGLE_SEARCH_CONSOLE"
              | "GOOGLE_TRANSLATE"
              | "HUBSPOT"
              | "INTERCOM"
              | "MAILCHIMP"
              | "MEETUP"
              | "NETLIFY"
              | "NOTION"
              | "OUTREACH"
              | "PRODUCT_HUNT"
              | "QUICKBOOKS"
              | "SALESFORCE"
              | "SANITY"
              | "SLACK"
              | "SPOTIFY"
              | "STRIPE"
              | "TRELLO"
              | "TWILIO"
              | "TWITTER"
              | "TWITCH_TV"
              | "YNAB"
              | "YOUTUBE"
              | "ZEIT"
              | "ZENDESK"
              | "AIRTABLE"
              | "APOLLO"
              | "BREX"
              | "BUNDLEPHOBIA"
              | "CHARGEBEE"
              | "CLEARBIT"
              | "CLOUDFLARE"
              | "CRUNCHBASE"
              | "DESCURI"
              | "FEDEX"
              | "GOOGLE_MAPS"
              | "GRAPHCMS"
              | "IMMIGRATION_GRAPH"
              | "LOGDNA"
              | "MIXPANEL"
              | "MUX"
              | "NPM"
              | "ONEGRAPH"
              | "ORBIT"
              | "OPEN_COLLECTIVE"
              | "RSS"
              | "UPS"
              | "USPS"
              | "WORDPRESS";
            /**
             * Service string that can be provided in the URL when going through the oauth flow.
             */
            slug: string;
            supportsCustomRedirectUri: boolean;
            supportsCustomServiceAuth: boolean;
            supportsOauthLogin: boolean;
          }>;
          updatedAt: string;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Fetch the schema metadata for a site (enabled services, id, etc.)
 */
export function fetchAppSchemaQuery(
  variables: AppSchemaQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<AppSchemaQuery>;

export type CLISessionQueryInput = {
  nfToken: string;
  sessionId: string;
  /**
   * The number of events to fetch, maximum of 1000.
   */
  first: number;
};

export type CLISessionQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Get a Netlify CLI session by its id.
       */
      netlifyCliSession: {
        appId: string;
        createdAt: string;
        id: string;
        /**
         * Number of milliseconds to wait between heartbeats
         */
        cliHeartbeatIntervalMs: number;
        events: Array<{
          createdAt: string;
          id: string;
          sessionId: string;
        }>;
        lastEventAt: string;
        metadata: unknown;
        name: string;
        netlifyUserId: string;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 *
 */
export function fetchCLISessionQuery(
  variables: CLISessionQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CLISessionQuery>;

export type ListPersistedQueriesInput = {
  /**
   * App id
   */
  appId: string;
  /**
   * How many persisted queries to return. Defaults to 10, max 100.
   */
  first: number;
  /**
   * Returns results after the provided cursor.
   */
  after?: string;
  /**
   * Only return persisted queries that have all of the provided tags.
   */
  tags: Array<string>;
};

export type ListPersistedQueries = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      app: {
        /**
         * The id of the OneGraph App
         */
        id: string;
        /**
         * List of persisted queries for this app
         */
        persistedQueries: {
          /**
           * Pagination information
           */
          pageInfo: {
            /**
             * When paginating forwards, are there more items?
             */
            hasNextPage: boolean;
            /**
             * When paginating forwards, the cursor to continue.
             */
            endCursor: string;
          };
          /**
           * List of persisted queries.
           */
          nodes: Array<{
            /**
             * The persisted query's id.
             */
            id: string;
            /**
             * The persisted query's query string.
             */
            query: string;
            /**
             * The default variables provided to the query.
             */
            fixedVariables: unknown;
            /**
             * The list of variables that the caller of the query is allowed to provide.
             */
            freeVariables: Array<string>;
            /**
             * The list of operation names that the caller of the query is allowed to execute. If the field is null, then all operationNames are allowed.
             */
            allowedOperationNames: Array<string>;
            /**
             * The list of user-defined tags that were added to the query
             */
            tags: Array<string>;
            /**
             * The user-defined description that was added to the query
             */
            description: string;
          }>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 *
 */
export function fetchListPersistedQueries(
  variables: ListPersistedQueriesInput,
  options?: NetlifyGraphFunctionOptions
): Promise<ListPersistedQueries>;

export type PersistedQueriesQueryInput = {
  nfToken: string;
  /**
   * App id
   */
  appId: string;
};

export type PersistedQueriesQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      app: {
        /**
         * List of persisted queries for this app
         */
        persistedQueries: {
          /**
           * List of persisted queries.
           */
          nodes: Array<{
            /**
             * The persisted query's id.
             */
            id: string;
            /**
             * The persisted query's query string.
             */
            query: string;
            /**
             * The list of operation names that the caller of the query is allowed to execute. If the field is null, then all operationNames are allowed.
             */
            allowedOperationNames: Array<string>;
            /**
             * The user-defined description that was added to the query
             */
            description: string;
            /**
             * The list of variables that the caller of the query is allowed to provide.
             */
            freeVariables: Array<string>;
            /**
             * The default variables provided to the query.
             */
            fixedVariables: unknown;
            /**
             * The list of user-defined tags that were added to the query
             */
            tags: Array<string>;
          }>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 *
 */
export function fetchPersistedQueriesQuery(
  variables: PersistedQueriesQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<PersistedQueriesQuery>;

export type PersistedQueryQueryInput = {
  nfToken: string;
  /**
   * The id of the app that the persisted query belongs to.
   */
  appId: string;
  /**
   * The id of the persisted query.
   */
  id: string;
};

export type PersistedQueryQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Fetch a single persisted query by its id.
       */
      persistedQuery: {
        /**
         * The persisted query's id.
         */
        id: string;
        /**
         * The persisted query's query string.
         */
        query: string;
        /**
         * The list of operation names that the caller of the query is allowed to execute. If the field is null, then all operationNames are allowed.
         */
        allowedOperationNames: Array<string>;
        /**
         * The user-defined description that was added to the query
         */
        description: string;
        /**
         * The list of variables that the caller of the query is allowed to provide.
         */
        freeVariables: Array<string>;
        /**
         * The default variables provided to the query.
         */
        fixedVariables: unknown;
        /**
         * The list of user-defined tags that were added to the query
         */
        tags: Array<string>;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors: Array<GraphQLError>;
};

/**
 * Fetch a persisted doc belonging to appId by its id
 */
export function fetchPersistedQueryQuery(
  variables: PersistedQueryQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<PersistedQueryQuery>;

export interface Functions {
  /**
   * Acknowledge CLI events that have been processed and delete them from the upstream queue
   */
  executeAckCLISessionEventMutation: typeof executeAckCLISessionEventMutation;
  /**
   *
   */
  executeCreateCLISessionEventMutation: typeof executeCreateCLISessionEventMutation;
  /**
   * Register a new CLI session with OneGraph
   */
  executeCreateCLISessionMutation: typeof executeCreateCLISessionMutation;
  /**
   * Create a new schema in OneGraph for the given site with the specified metadata (enabled services; etc.)
   */
  executeCreateNewSchemaMutation: typeof executeCreateNewSchemaMutation;
  /**
   * Create a persisted operations doc to be later retrieved; usually from a GUI
   */
  executeCreatePersistedQueryMutation: typeof executeCreatePersistedQueryMutation;
  /**
   * Mark a CLI session as active and update the session's heartbeat
   */
  executeMarkCLISessionActiveHeartbeat: typeof executeMarkCLISessionActiveHeartbeat;
  /**
   * Mark a CLI session as inactive
   */
  executeMarkCLISessionInactive: typeof executeMarkCLISessionInactive;
  /**
   * Update the CLI session with new metadata (e.g. the latest docId) by its id
   */
  executeUpdateCLISessionMetadataMutation: typeof executeUpdateCLISessionMetadataMutation;
  /**
   * If a site does not exists upstream in OneGraph for the given site; create it
   */
  executeUpsertAppForSiteMutation: typeof executeUpsertAppForSiteMutation;
  /**
   * Fetch the schema metadata for a site (enabled services; id; etc.)
   */
  fetchAppSchemaQuery: typeof fetchAppSchemaQuery;
  /**
   *
   */
  fetchCLISessionQuery: typeof fetchCLISessionQuery;
  /**
   *
   */
  fetchListPersistedQueries: typeof fetchListPersistedQueries;
  /**
   *
   */
  fetchPersistedQueriesQuery: typeof fetchPersistedQueriesQuery;
  /**
   * Fetch a persisted doc belonging to appId by its id
   */
  fetchPersistedQueryQuery: typeof fetchPersistedQueryQuery;
}

export const functions: Functions;

export default functions;
