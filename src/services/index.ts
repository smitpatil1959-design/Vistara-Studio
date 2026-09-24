/**
 * Service layer barrel — one typed module per resource.
 * UI code must never call fetch() directly against /api routes.
 */
export * from './http';
export * from './projects';
export * from './slides';
export * from './chat';
export * from './ai';
export * from './activity';
export * from './specs';
export * from './assets';
