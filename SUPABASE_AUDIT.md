# Supabase Error Pattern Audit Checklist

This document lists all the Supabase query patterns found in the codebase and their status.

## Error Handling Pattern Requirements

All Supabase queries should follow this pattern:

```javascript
try {
  const { data, error } = await supabase
    .from('table')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    // Handle error appropriately
    if (error.code === 'PGRST205') {
      // Schema not initialized
      return res.status(503).json({ error: 'Database not initialized' });
    }
    throw error; // Re-throw for outer catch
  }

  // Use data
  return data;
} catch (err) {
  console.error('Query failed:', err);
  return res.status(500).json({ error: 'Database error' });
}
```

## Files to Audit (282 query patterns found)

### API Routes (Critical Priority)
- [ ] `/api/activity.js` - 2 queries
- [ ] `/api/ai.js` - 8 queries
- [ ] `/api/analyze.js` - 7 queries
- [ ] `/api/assets.js` - 8 queries
- [ ] `/api/audit.js` - 2 queries
- [ ] `/api/chat.js` - 3 queries
- [ ] `/api/crawl.js` - 1 query
- [ ] `/api/export-pptx.js` - 5 queries
- [ ] `/api/export-report.js` - 4 queries
- [ ] `/api/gallery.js` - 2 queries
- [ ] `/api/generate.js` - 10 queries
- [ ] `/api/presentation.js` - 2 queries
- [ ] `/api/projects.js` - 15 queries
- [ ] `/api/slides.js` - 8 queries
- [ ] `/api/spec.js` - 8 queries
- [ ] `/api/theme.js` - 2 queries
- [ ] `/api/understand.js` - 4 queries
- [ ] `/api/visibility.js` - 2 queries
- [ ] `/api/auth/` - Auth routes

### Server Side (High Priority)
- [ ] `/server/engine.js` - 10 queries
- [ ] `/server/specSync.js` - 6 queries
- [ ] `/server/visibility.js` - 4 queries

### Frontend (Medium Priority)
- [ ] `/src/app/AuthProvider.tsx` - 2 queries
- [ ] Other service files

## Specific Patterns to Check

### ✓ Pattern 1: Error Checking with Try-Catch
Good:
```javascript
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) {
    if (error.code === 'PGRST205') return res.status(503);
    throw error;
  }
} catch (err) {
  return res.status(500);
}
```

### ✓ Pattern 2: Error Code Handling
Must handle:
- `PGRST205` / `42P01` - Schema not initialized
- `PGRST109` / `42501` - Permission denied
- `PGRST116` / `23503` - Foreign key constraint

### ✗ Pattern 3: Unsafe .then() Chains (DEPRECATED)
Bad:
```javascript
supabase.from('table').insert(data).then(({ error }) => {
  if (error) console.log(error);
}).catch(err => {
  // Chains are not promise-based in Supabase JS
})
```

### ✗ Pattern 4: Silent Failures
Bad:
```javascript
const { data } = await supabase.from('table').select('*');
// Using data without checking for error
```

## Response Object Issues

Check for `res.status is not a function` errors:

- [ ] All API handlers validate response object on entry
- [ ] Use `/server/response.js` helper functions
- [ ] Never assume response object structure

## Verification Checklist

- [ ] All 282+ query patterns audited
- [ ] Error handling added to any missing try-catch blocks
- [ ] Response contract standardized using `response.js`
- [ ] Configuration validated on startup
- [ ] API keys never exposed in responses
- [ ] Database errors logged safely (no secrets)
- [ ] Tests for error cases written

## Migration Path

1. **Phase 1**: Identify all queries missing error checks
2. **Phase 2**: Add standardized error handling
3. **Phase 3**: Use response contract helpers
4. **Phase 4**: Test failure scenarios
5. **Phase 5**: Deploy with confidence

## Testing Checklist

When error handling is in place, test:

- [ ] Missing database (schema not initialized)
- [ ] Missing SUPABASE_SERVICE_ROLE_KEY
- [ ] Network timeouts
- [ ] Permission denied (RLS failure)
- [ ] Foreign key constraint violations
- [ ] Invalid JSON in jsonb fields
- [ ] Concurrent updates
- [ ] Very large result sets

## Notes

- The codebase uses Supabase JS client (not PostgREST directly)
- All queries should use async/await, not promise chains
- Error object structure: `{ code, message, details }`
- Response object may differ between Vercel and Node environments
- Use response.js helpers for consistent handling
