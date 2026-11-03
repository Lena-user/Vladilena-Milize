'use strict';
// Compatibility shim for legacy session lookups during V2 migration.
const closeStale = async (_staff?: any) => {};
const closeStaleFor = async (_people?: any) => {};
const closeStaleIn = async (_month?: any, _names?: any) => {};
const sessionsFor = async (_filter?: any): Promise<any[]> => [];

export = { closeStale, closeStaleFor, closeStaleIn, sessionsFor };
