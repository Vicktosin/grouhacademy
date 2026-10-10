/**
 * The request's path, set by the proxy on every request it handles (route
 * handlers and server components can't otherwise see it). Overwritten
 * there, so a client can't supply its own.
 */
export const PATH_HEADER = "x-grouh-pathname";
