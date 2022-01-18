/**
 * Silently discard all console log output.
 * @param data
 * @returns
 */
const silentDefaultLog = function log(...data: any[]): void {
  return;
};

/**
 * Silently discard all console warn output.
 * @param data
 * @returns
 */
const silentDefaultWarn = function warn(...data: any[]): void {
  return;
};

/**
 * Silently discard all console error output.
 * @param data
 * @returns
 */
const silentDefaultError = function error(...data: any[]): void {
  return;
};

/**
 * Silently discard all console debug output.
 * @param data
 * @returns
 */
const silentDefaultDebug = function error(...data: any[]): void {
  return;
};

/**
 * The default console log function, used when no console is provided.
 * Silently discards all console log output.
 */
const silentConsole = {
  log: silentDefaultLog,
  warn: silentDefaultWarn,
  error: silentDefaultError,
  debug: silentDefaultDebug,
};

type InternalConsole = typeof silentConsole;

/**
 * The set of console log functions actually used internally.
 */
export let internalConsole: InternalConsole = {
  ...silentConsole,
};

/**
 * Registers a set of functions to be used as the console. By default, the console is silent.
 * @param {InternalConsole} newConsole The set of console functions to use
 */
export function registerConsole(newConsole: InternalConsole): void {
  internalConsole = newConsole;
}
