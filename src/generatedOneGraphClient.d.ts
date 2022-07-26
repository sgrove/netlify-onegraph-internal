/* eslint-disable */
// @ts-nocheck
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

export type CreateGraphQLSchemaMutationInput = {
  input: {
    /**
     * Whether to set this schema as the default for the app. Defaults to false.
     */
    setAsDefaultForApp?: boolean
    /**
     * External GraphQL schemas to add
     */;
    externalGraphQLSchemas?: Array<{
      /**
       * The id of the external GraphQL schema.
       */
      externalGraphQLSchemaId: string;
    }>
    /**
     * Optional id of a Salesforce schema to attach to the GraphQL schema.
     */;
    salesforceSchemaId?: string
    /**
     * The optional id of the GraphQL schema that this was derived from.
     */;
    parentId?: string
    /**
     * The list of services that this schema should use. Leave blank if you want to add support for all supported services.
     */;
    enabledServices?: Array<
      | "ADROLL"
      | "ASANA"
      | "BOX"
      | "CLOUDINARY"
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
      | "SHOPIFY_ADMIN"
      | "SHOPIFY_STOREFRONT"
      | "SLACK"
      | "SPOTIFY"
      | "STRIPE"
      | "TWITCH_TV"
      | "TWILIO"
      | "YNAB"
      | "YOUTUBE"
      | "ZEIT"
      | "ZENDESK"
      | "TRELLO"
      | "TWITTER"
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
    > /**
  * The list of GraphQL fields identifying services that this schema should use.
Leave blank if you want to add support for all supported services. Note that
this field won't be merged with `enabledServices`, which takes an enum and is deprecated.
  */;
    graphQLFieldForEnabledServices?: Array<string>
    /**
     * The id of the app that the schema should belong to.
     */;
    appId: string;
  };
};

export type CreateGraphQLSchemaMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      createGraphQLSchema: {
        graphQLSchema: {
          id: string;
          /**
           * External GraphQL schemas for the schema.
           */
          externalGraphQLSchemas: {
            nodes: Array<{
              /**
               * Id of the external graphql schema
               */
              id: string;
              /**
               * GraphQL endpoint of the external graphql schema
               */
              endpoint: string;
              /**
               * Service information for the external graphql schema
               */
              serviceInfo: {
                /**
                 * GraphQL field identifying the service in the schema
                 */
                graphQLField: string;
              };
              /**
               * The datetime that the schema was added, in rfc3339 format.
               */
              createdAt: string;
              /**
               * The datetime that the schema was last updated, in rfc3339 format.
               */
              updatedAt: string;
            }>;
          };
          parentGraphQLSchemaId?: string;
          salesforceSchema?: {
            /**
             * Id of the salesforce schema
             */
            id: string;
            /**
             * The datetime that the schema was added, in rfc3339 format.
             */
            createdAt: string;
            /**
             * The datetime that the schema was last updated, in rfc3339 format.
             */
            updatedAt: string;
          };
          services: Array<{
            /**
             * GraphQL field identifying the service in the schema
             */
            graphQLField: string;
          }>;
          updatedAt: string;
          createdAt: string;
          appId: string;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Create a GraphQL Schema by specifying its inputs (services, external GraphQL schemas, etc.)
 */
export function executeCreateGraphQLSchemaMutation(
  variables: CreateGraphQLSchemaMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateGraphQLSchemaMutation>;

export type CreateApiTokenMutationInput = {
  input: {
    scopes: Array<"MODIFY_SCHEMA" | "PERSIST_QUERY">
    /**
     * Id for the app that you will be accessible through the token.
     */;
    appId: string;
  };
};

export type CreateApiTokenMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      createApiToken: {
        /**
         * The access token that was created
         */
        accessToken: {
          /**
           * Bearer token
           */
          token: string;
          /**
           * User auths for the access token
           */
          userAuths: Array<{
            /**
             * Service that the auth belongs to.
             */
            serviceInfo: {
              /**
               * GraphQL field identifying the service in the schema
               */
              graphQLField: string;
            };
            /**
             * Unique id for the logged-in entity on the service.
             */
            foreignUserId: string;
            /**
             * Scopes granted for the service.
             */
            scopes?: Array<string>;
          }>;
          /**
           * AppId that the token belongs to
           */
          appId: string;
          /**
           * Time that the the token expires, measured in seconds since the Unix epoch
           */
          expireDate: number;
          /**
           * Token name, if it is a personal access token
           */
          name?: string;
          /**
           * Netlify-specific ID for the token
           */
          netlifyId?: string;
          /**
  * The anchor is like two-factor auth for the token. It ensures that the person
who adds auth to the token is the same as the person who created the token.
  */
          anchor?: "ONEGRAPH_USER" | "NETLIFY_USER" | "NETLIFY_SITE";
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Create a token belonging to a specific siteId to persist operations and create GraphQL schemas later
 */
export function executeCreateApiTokenMutation(
  variables: CreateApiTokenMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateApiTokenMutation>;

export type CreatePersistedQueryMutationInput = {
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
 * If set to true, and there was a successful execution of the query in the last
30 days, then the last successful result will be returned if we encounter any
error when executing the query. If we do not have a previous successful
result, then the response with the error will be returned.

                         Note that the fallback result will be returned even in the case of partial success.

                         This parameter is useful when you expect that your
queries might be rate-limited by the underlying service.

                         The query must provide a cache strategy in order to use `fallbackOnError`.
 */
  fallbackOnError: boolean;
  freeVariables: Array<string>;
  query: string;
  /**
 * List of tags to add to the persisted query. Tags are free-form text that can
be used to categorize persisted queries. Each tag must be under 256 characters
and there can be a maximum of 10 tags on a single persisted query.
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
  * The list of operation names that the caller of the query is allowed to
execute. If the field is null, then all operationNames are allowed.
  */
          allowedOperationNames?: Array<string>;
          /**
           * The user-defined description that was added to the query
           */
          description?: string;
          /**
           * The default variables provided to the query.
           */
          fixedVariables?: unknown;
          /**
           * The list of variables that the caller of the query is allowed to provide.
           */
          freeVariables?: Array<string>;
          /**
           * The persisted query's query string.
           */
          query: string;
          /**
           * The list of user-defined tags that were added to the query
           */
          tags?: Array<string>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Create a persisted operations doc to be later retrieved, usually from a GUI
 */
export function executeCreatePersistedQueryMutation(
  variables: CreatePersistedQueryMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreatePersistedQueryMutation>;

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
            endCursor?: string;
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
            fixedVariables?: unknown;
            /**
             * The list of variables that the caller of the query is allowed to provide.
             */
            freeVariables?: Array<string>;
            /**
  * The list of operation names that the caller of the query is allowed to
execute. If the field is null, then all operationNames are allowed.
  */
            allowedOperationNames?: Array<string>;
            /**
             * The list of user-defined tags that were added to the query
             */
            tags?: Array<string>;
            /**
             * The user-defined description that was added to the query
             */
            description?: string;
          }>;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Fetch a paginated list of persisted queries belonging to an app
 */
export function fetchListPersistedQueries(
  variables: ListPersistedQueriesInput,
  options?: NetlifyGraphFunctionOptions
): Promise<ListPersistedQueries>;

export type PersistedQueryQueryInput = {
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
  * The list of operation names that the caller of the query is allowed to
execute. If the field is null, then all operationNames are allowed.
  */
        allowedOperationNames?: Array<string>;
        /**
         * The user-defined description that was added to the query
         */
        description?: string;
        /**
         * The list of variables that the caller of the query is allowed to provide.
         */
        freeVariables?: Array<string>;
        /**
         * The default variables provided to the query.
         */
        fixedVariables?: unknown;
        /**
         * The list of user-defined tags that were added to the query
         */
        tags?: Array<string>;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Fetch a persisted doc belonging to appId by its id
 */
export function fetchPersistedQueryQuery(
  variables: PersistedQueryQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<PersistedQueryQuery>;

export type CreateCLISessionMutationInput = {
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
          name?: string;
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
  errors?: Array<GraphQLError>;
};

/**
 * Register a new CLI session with OneGraph
 */
export function executeCreateCLISessionMutation(
  variables: CreateCLISessionMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateCLISessionMutation>;

export type UpdateCLISessionMetadataMutationInput = {
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
          name?: string;
          metadata?: Record<string, unknown>;
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
  errors?: Array<GraphQLError>;
};

/**
 * Update the CLI session with new metadata (e.g. the latest docId) by its id
 */
export function executeUpdateCLISessionMetadataMutation(
  variables: UpdateCLISessionMetadataMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<UpdateCLISessionMetadataMutation>;

export type CreateCLISessionEventMutationInput = {
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
  errors?: Array<GraphQLError>;
};

/**
 * Create a new event for a CLI session to consume
 */
export function executeCreateCLISessionEventMutation(
  variables: CreateCLISessionEventMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateCLISessionEventMutation>;

export type CLISessionQueryInput = {
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
        events: Array<
          {
            createdAt: string;
            id: string;
            sessionId: string;
          }
        >;
        lastEventAt?: string;
        metadata?: Record<string, unknown>;
        name?: string;
        netlifyUserId: string;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Fetch a single CLI session by its id
 */
export function fetchCLISessionQuery(
  variables: CLISessionQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CLISessionQuery>;

export type AckCLISessionEventMutationInput = {
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
  errors?: Array<GraphQLError>;
};

/**
 * Acknowledge CLI events that have been processed and delete them from the upstream queue
 */
export function executeAckCLISessionEventMutation(
  variables: AckCLISessionEventMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<AckCLISessionEventMutation>;

export type AppSchemaQueryInput = {
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
        graphQLSchema?: {
          appId: string;
          createdAt: string;
          id: string;
          services: Array<{
            friendlyServiceName: string;
            /**
             * A short-lived svg image url of the logo for the service. May be null.
             */
            logoUrl?: string;
            /**
             * GraphQL field identifying the service in the schema
             */
            graphQLField: string;
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
  errors?: Array<GraphQLError>;
};

/**
 * Fetch the schema metadata for a site (enabled services, id, etc.)
 */
export function fetchAppSchemaQuery(
  variables: AppSchemaQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<AppSchemaQuery>;

export type UpsertAppForSiteMutationInput = {
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
  errors?: Array<GraphQLError>;
};

/**
 * If a site does not exists upstream in OneGraph for the given site, create it
 */
export function executeUpsertAppForSiteMutation(
  variables: UpsertAppForSiteMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<UpsertAppForSiteMutation>;

export type CreateNewSchemaMutationInput = {
  input: {
    /**
     * Whether to set this schema as the default for the app. Defaults to false.
     */
    setAsDefaultForApp?: boolean
    /**
     * External GraphQL schemas to add
     */;
    externalGraphQLSchemas?: Array<{
      /**
       * The id of the external GraphQL schema.
       */
      externalGraphQLSchemaId: string;
    }>
    /**
     * Optional id of a Salesforce schema to attach to the GraphQL schema.
     */;
    salesforceSchemaId?: string
    /**
     * The optional id of the GraphQL schema that this was derived from.
     */;
    parentId?: string
    /**
     * The list of services that this schema should use. Leave blank if you want to add support for all supported services.
     */;
    enabledServices?: Array<
      | "ADROLL"
      | "ASANA"
      | "BOX"
      | "CLOUDINARY"
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
      | "SHOPIFY_ADMIN"
      | "SHOPIFY_STOREFRONT"
      | "SLACK"
      | "SPOTIFY"
      | "STRIPE"
      | "TWITCH_TV"
      | "TWILIO"
      | "YNAB"
      | "YOUTUBE"
      | "ZEIT"
      | "ZENDESK"
      | "TRELLO"
      | "TWITTER"
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
    > /**
  * The list of GraphQL fields identifying services that this schema should use.
Leave blank if you want to add support for all supported services. Note that
this field won't be merged with `enabledServices`, which takes an enum and is deprecated.
  */;
    graphQLFieldForEnabledServices?: Array<string>
    /**
     * The id of the app that the schema should belong to.
     */;
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
          graphQLSchema?: {
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
            logoUrl?: string;
            /**
             * GraphQL field identifying the service in the schema
             */
            graphQLField: string;
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
  errors?: Array<GraphQLError>;
};

/**
 * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
 */
export function executeCreateNewSchemaMutation(
  variables: CreateNewSchemaMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateNewSchemaMutation>;

export type MarkCLISessionActiveHeartbeatInput = {
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
          status: "ACTIVE" | "INACTIVE" | "UNCLAIMED" | "TERMINATED";
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
  errors?: Array<GraphQLError>;
};

/**
 * Mark a CLI session as active and update the session's heartbeat
 */
export function executeMarkCLISessionActiveHeartbeat(
  variables: MarkCLISessionActiveHeartbeatInput,
  options?: NetlifyGraphFunctionOptions
): Promise<MarkCLISessionActiveHeartbeat>;

export type MarkCLISessionInactiveInput = {
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
          status: "ACTIVE" | "INACTIVE" | "UNCLAIMED" | "TERMINATED";
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
  errors?: Array<GraphQLError>;
};

/**
 * Mark a CLI session as inactive
 */
export function executeMarkCLISessionInactive(
  variables: MarkCLISessionInactiveInput,
  options?: NetlifyGraphFunctionOptions
): Promise<MarkCLISessionInactive>;

export type ListSharedDocumentsQueryInput = {
  /**
   * The number of shared documents to fetch. Defaults to 10, maximum of 100.
   */
  first?: number;
  status?: "PUBLISHED" | "UNPUBLISHED";
  services: Array<
    | "ADROLL"
    | "ASANA"
    | "BOX"
    | "CLOUDINARY"
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
    | "SHOPIFY_ADMIN"
    | "SHOPIFY_STOREFRONT"
    | "SLACK"
    | "SPOTIFY"
    | "STRIPE"
    | "TWITCH_TV"
    | "TWILIO"
    | "YNAB"
    | "YOUTUBE"
    | "ZEIT"
    | "ZENDESK"
    | "TRELLO"
    | "TWITTER"
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
  style?: "DEFAULT" | "ROUNDED_RECTANGLE";
};

export type ListSharedDocumentsQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Get sharedDocument
       */
      sharedDocuments: {
        nodes: Array<{
          /**
           * Document description
           */
          description?: string;
          /**
           * The text of the GraphQL document
           */
          body: string;
          /**
           * Timestamp the document was created, in rfc3339 format.
           */
          createdAt: string;
          /**
           * The id of the shared document
           */
          id: string;
          /**
           * Current moderation status of the query
           */
          moderationStatus: "PUBLISHED" | "UNPUBLISHED";
          /**
           * Operation name
           */
          operationName?: string;
          /**
           * The siteId that the shared document originated from
           */
          siteId?: string;
          /**
           * Timestamp the document was last updated, in rfc3339 format.
           */
          updatedAt: string;
          /**
           * Services that appear in the query
           */
          services: Array<{
            friendlyServiceName: string;
            /**
             * A short-lived svg image url of the logo for the service. May be null.
             */
            logoUrl?: string;
            /**
             * GraphQL field identifying the service in the schema
             */
            graphQLField: string;
            /**
             * Service string that can be provided in the URL when going through the oauth flow.
             */
            slug: string;
          }>;
        }>;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * List shared documents given a set of filters
 */
export function fetchListSharedDocumentsQuery(
  variables: ListSharedDocumentsQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<ListSharedDocumentsQuery>;

export type CreateSharedDocumentMutationInput = {
  input: {
    /**
     * Optional example variables to include with the document.
     */
    exampleVariables?: unknown
    /**
     * A short title for the operation. Maximum length is 256 characters.
     */;
    title?: string
    /**
     * A description for the operation. Maximum length is 2096 characters.
     */;
    description?: string /**
  * The Netlify siteId that this operation should be associated with. The
currently-authenticated user must have access to this site in Netlify.
  */;
    siteId?: string
    /**
     * The shared operation text. Maximum length is 1mb.
     */;
    body: string;
  };
};

export type CreateSharedDocumentMutation = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Create a shared document
       */
      createSharedDocument: {
        /**
         * The shared document that was created.
         */
        sharedDocument: {
          /**
           * The id of the shared document
           */
          id: string;
          /**
           * Current moderation status of the query
           */
          moderationStatus: "PUBLISHED" | "UNPUBLISHED";
          /**
           * Operation name
           */
          operationName?: string;
          /**
           * Services that appear in the query
           */
          services: Array<{
            friendlyServiceName: string;
          }>;
          /**
           * Document description
           */
          description?: string;
        };
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Create a document with a shared operation for others to import and use
 */
export function executeCreateSharedDocumentMutation(
  variables: CreateSharedDocumentMutationInput,
  options?: NetlifyGraphFunctionOptions
): Promise<CreateSharedDocumentMutation>;

export type SharedDocumentQueryInput = {
  id: string;
  logoStyle?: "DEFAULT" | "ROUNDED_RECTANGLE";
};

export type SharedDocumentQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Get a sharedDocument by its id
       */
      sharedDocument: {
        /**
         * The text of the GraphQL document
         */
        body: string;
        /**
         * Timestamp the document was created, in rfc3339 format.
         */
        createdAt: string;
        /**
         * Document description
         */
        description?: string;
        /**
         * The id of the shared document
         */
        id: string;
        /**
         * Current moderation status of the query
         */
        moderationStatus: "PUBLISHED" | "UNPUBLISHED";
        /**
         * Operation name
         */
        operationName?: string;
        /**
         * Timestamp the document was last updated, in rfc3339 format.
         */
        updatedAt: string;
        /**
         * Services that appear in the query
         */
        services: Array<{
          /**
           * A short-lived svg image url of the logo for the service. May be null.
           */
          logoUrl?: string;
          friendlyServiceName: string;
          /**
           * GraphQL field identifying the service in the schema
           */
          graphQLField: string;
          /**
           * Service string that can be provided in the URL when going through the oauth flow.
           */
          slug: string;
        }>;
      };
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Find a shared document given its id
 */
export function fetchSharedDocumentQuery(
  variables: SharedDocumentQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<SharedDocumentQuery>;

export type ListNetlifyEnabledServicesQueryInput = {
  logoStyle?: "DEFAULT" | "ROUNDED_RECTANGLE";
  /**
   * Filter for services that are in the list of services
   */
  betaServices?: Array<
    | "ADROLL"
    | "ASANA"
    | "BOX"
    | "CLOUDINARY"
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
    | "SHOPIFY_ADMIN"
    | "SHOPIFY_STOREFRONT"
    | "SLACK"
    | "SPOTIFY"
    | "STRIPE"
    | "TWITCH_TV"
    | "TWILIO"
    | "YNAB"
    | "YOUTUBE"
    | "ZEIT"
    | "ZENDESK"
    | "TRELLO"
    | "TWITTER"
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
};

export type ListNetlifyEnabledServicesQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      services: Array<{
        friendlyServiceName: string;
        /**
         * A short-lived svg image url of the logo for the service. May be null.
         */
        logoUrl?: string;
        /**
         * GraphQL field identifying the service in the schema
         */
        graphQLField: string;
        /**
         * Service string that can be provided in the URL when going through the oauth flow.
         */
        slug: string;
        supportsCustomRedirectUri: boolean;
        supportsCustomServiceAuth: boolean;
        supportsOauthLogin: boolean;
        /**
         * Whether Netlify Graph is enabled for this service
         */
        netlifyGraphEnabled: boolean;
        /**
         * Whether Netlify API Authentication is enabled for this service
         */
        netlifyApiAuthenticationEnabled: boolean;
      }>;
    };
  };
  /**
   * Any errors from the function will be returned here
   */
  errors?: Array<GraphQLError>;
};

/**
 * Retrieve a list of _all_ supported services from OneGraph
 */
export function fetchListNetlifyEnabledServicesQuery(
  variables: ListNetlifyEnabledServicesQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<ListNetlifyEnabledServicesQuery>;

export type FetchNetlifySessionSchemaQueryInput = {
  sessionId: string;
};

export type FetchNetlifySessionSchemaQuery = {
  /**
   * Any data from the function will be returned here
   */
  data: {
    oneGraph: {
      /**
       * Get a Netlify CLI session by its id.
       */
      netlifyCliSession: {
        graphQLSchema?: {
          appId: string;
          createdAt: string;
          id: string;
          services: Array<{
            friendlyServiceName: string;
            /**
             * A short-lived svg image url of the logo for the service. May be null.
             */
            logoUrl?: string;
            /**
             * GraphQL field identifying the service in the schema
             */
            graphQLField: string;
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
  errors?: Array<GraphQLError>;
};

/**
 * Create a document with a shared operation for others to import and use
 */
export function fetchFetchNetlifySessionSchemaQuery(
  variables: FetchNetlifySessionSchemaQueryInput,
  options?: NetlifyGraphFunctionOptions
): Promise<FetchNetlifySessionSchemaQuery>;

export interface Functions {
  /**
   * Create a GraphQL Schema by specifying its inputs (services, external GraphQL schemas, etc.)
   */
  executeCreateGraphQLSchemaMutation: typeof executeCreateGraphQLSchemaMutation;
  /**
   * Create a token belonging to a specific siteId to persist operations and create GraphQL schemas later
   */
  executeCreateApiTokenMutation: typeof executeCreateApiTokenMutation;
  /**
   * Create a persisted operations doc to be later retrieved, usually from a GUI
   */
  executeCreatePersistedQueryMutation: typeof executeCreatePersistedQueryMutation;
  /**
   * Fetch a paginated list of persisted queries belonging to an app
   */
  fetchListPersistedQueries: typeof fetchListPersistedQueries;
  /**
   * Fetch a persisted doc belonging to appId by its id
   */
  fetchPersistedQueryQuery: typeof fetchPersistedQueryQuery;
  /**
   * Register a new CLI session with OneGraph
   */
  executeCreateCLISessionMutation: typeof executeCreateCLISessionMutation;
  /**
   * Update the CLI session with new metadata (e.g. the latest docId) by its id
   */
  executeUpdateCLISessionMetadataMutation: typeof executeUpdateCLISessionMetadataMutation;
  /**
   * Create a new event for a CLI session to consume
   */
  executeCreateCLISessionEventMutation: typeof executeCreateCLISessionEventMutation;
  /**
   * Fetch a single CLI session by its id
   */
  fetchCLISessionQuery: typeof fetchCLISessionQuery;
  /**
   * Acknowledge CLI events that have been processed and delete them from the upstream queue
   */
  executeAckCLISessionEventMutation: typeof executeAckCLISessionEventMutation;
  /**
   * Fetch the schema metadata for a site (enabled services, id, etc.)
   */
  fetchAppSchemaQuery: typeof fetchAppSchemaQuery;
  /**
   * If a site does not exists upstream in OneGraph for the given site, create it
   */
  executeUpsertAppForSiteMutation: typeof executeUpsertAppForSiteMutation;
  /**
   * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
   */
  executeCreateNewSchemaMutation: typeof executeCreateNewSchemaMutation;
  /**
   * Mark a CLI session as active and update the session's heartbeat
   */
  executeMarkCLISessionActiveHeartbeat: typeof executeMarkCLISessionActiveHeartbeat;
  /**
   * Mark a CLI session as inactive
   */
  executeMarkCLISessionInactive: typeof executeMarkCLISessionInactive;
  /**
   * List shared documents given a set of filters
   */
  fetchListSharedDocumentsQuery: typeof fetchListSharedDocumentsQuery;
  /**
   * Create a document with a shared operation for others to import and use
   */
  executeCreateSharedDocumentMutation: typeof executeCreateSharedDocumentMutation;
  /**
   * Find a shared document given its id
   */
  fetchSharedDocumentQuery: typeof fetchSharedDocumentQuery;
  /**
   * Retrieve a list of _all_ supported services from OneGraph
   */
  fetchListNetlifyEnabledServicesQuery: typeof fetchListNetlifyEnabledServicesQuery;
  /**
   * Create a document with a shared operation for others to import and use
   */
  fetchFetchNetlifySessionSchemaQuery: typeof fetchFetchNetlifySessionSchemaQuery;
}

export const functions: Functions;

export default functions;
