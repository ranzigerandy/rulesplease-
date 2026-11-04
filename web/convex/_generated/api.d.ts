/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as chat from "../chat.js";
import type * as chatInternal from "../chatInternal.js";
import type * as compliance from "../compliance.js";
import type * as contentSafety from "../contentSafety.js";
import type * as feedback from "../feedback.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as library from "../library.js";
import type * as migrations from "../migrations.js";
import type * as notificationActions from "../notificationActions.js";
import type * as notifications from "../notifications.js";
import type * as repairs from "../repairs.js";
import type * as rulesAgent from "../rulesAgent.js";
import type * as teaching from "../teaching.js";
import type * as teachingAccess from "../teachingAccess.js";
import type * as teachingCoverage from "../teachingCoverage.js";
import type * as teachingGeneration from "../teachingGeneration.js";
import type * as teachingInternal from "../teachingInternal.js";
import type * as teachingPdfs from "../teachingPdfs.js";
import type * as teachingPedagogy from "../teachingPedagogy.js";
import type * as teachingQuestions from "../teachingQuestions.js";
import type * as teachingValidators from "../teachingValidators.js";
import type * as workers from "../workers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  chat: typeof chat;
  chatInternal: typeof chatInternal;
  compliance: typeof compliance;
  contentSafety: typeof contentSafety;
  feedback: typeof feedback;
  helpers: typeof helpers;
  http: typeof http;
  library: typeof library;
  migrations: typeof migrations;
  notificationActions: typeof notificationActions;
  notifications: typeof notifications;
  repairs: typeof repairs;
  rulesAgent: typeof rulesAgent;
  teaching: typeof teaching;
  teachingAccess: typeof teachingAccess;
  teachingCoverage: typeof teachingCoverage;
  teachingGeneration: typeof teachingGeneration;
  teachingInternal: typeof teachingInternal;
  teachingPdfs: typeof teachingPdfs;
  teachingPedagogy: typeof teachingPedagogy;
  teachingQuestions: typeof teachingQuestions;
  teachingValidators: typeof teachingValidators;
  workers: typeof workers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
