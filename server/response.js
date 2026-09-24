/**
 * Standardized API Response Contract
 *
 * All API responses follow this pattern:
 *
 * Success (200-299):
 * {
 *   "ok": true,
 *   "data": { ... }
 * }
 *
 * Error (4xx-5xx):
 * {
 *   "ok": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "User-friendly message"
 *   }
 * }
 *
 * This ensures consistent client-side error handling.
 */

/**
 * Send a success response
 * @param {Object} res - Express/Vercel response object
 * @param {*} data - Response payload
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    ok: true,
    data
  });
}

/**
 * Send a client error (400-499)
 * @param {Object} res - Express/Vercel response object
 * @param {string} message - User-friendly error message
 * @param {string} code - Error code (e.g., 'VALIDATION_ERROR')
 * @param {number} statusCode - HTTP status code (default: 400)
 */
export function clientError(res, message, code = 'CLIENT_ERROR', statusCode = 400) {
  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message
    }
  });
}

/**
 * Send a server error (500-599)
 * @param {Object} res - Express/Vercel response object
 * @param {string} message - User-friendly error message
 * @param {string} code - Error code (e.g., 'DATABASE_ERROR')
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Error|null} err - Optional error object for logging (never returned to client)
 */
export function serverError(res, message, code = 'SERVER_ERROR', statusCode = 500, err = null) {
  if (err && err instanceof Error) {
    console.error(`[API Error ${code}]`, err.message, err.stack);
  }
  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message
    }
  });
}

/**
 * Handle Supabase query errors with appropriate HTTP status
 * @param {Object} res - Express/Vercel response object
 * @param {Error} error - Supabase error object
 * @param {string} operation - Description of operation (e.g., 'load projects')
 */
export function handleSupabaseError(res, error, operation = 'database operation') {
  console.error(`[Supabase ${operation}]`, error);

  // Schema not found - database not initialized
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return serverError(
      res,
      'Database schema is not initialized. Run the latest Supabase migrations.',
      'DATABASE_UNINITIALIZED',
      503,
      error
    );
  }

  // Permission denied
  if (error.code === 'PGRST109' || error.code === '42501') {
    return serverError(
      res,
      'Permission denied.',
      'PERMISSION_DENIED',
      403,
      error
    );
  }

  // Foreign key constraint
  if (error.code === 'PGRST116' || error.code === '23503') {
    return clientError(
      res,
      'Invalid reference. The referenced resource does not exist.',
      'INVALID_REFERENCE',
      400
    );
  }

  // Generic database error
  return serverError(
    res,
    'A database error occurred. Please try again.',
    'DATABASE_ERROR',
    503,
    error
  );
}

/**
 * Validate Vercel response object
 * Use this at the start of every API handler to ensure res methods exist
 * @param {Object} res - Response object
 * @returns {boolean}
 */
export function validateResponse(res) {
  if (typeof res?.status !== 'function') {
    console.error('[API] Invalid response object - res.status is not a function');
    return false;
  }
  if (typeof res?.json !== 'function') {
    console.error('[API] Invalid response object - res.json is not a function');
    return false;
  }
  return true;
}
