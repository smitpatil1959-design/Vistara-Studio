# Vistara Studio Testing Plan

## Test Website Categories

Test the evidence-based architecture with diverse websites to ensure it adapts to different company types.

### 1. SaaS Company (e.g., Linear, Notion)
**URL**: https://linear.app or https://www.notion.so

**Expected Evidence**:
- ✓ Clear product description
- ✓ Multiple features documented
- ✓ Pricing page with plans
- ✓ Target audience/use cases
- ✓ Technology stack mentions
- ✓ Customer testimonials
- ✓ Leadership team info

**Expected Slides**:
- Cover, About, Product, Features, Pricing, Use Cases, Integrations, Technology, Conclusion

---

### 2. Food/Restaurant (e.g., Zomato, local restaurant)
**URL**: https://www.zomato.com or local restaurant site

**Expected Evidence**:
- ✓ Company description
- ✓ Available cuisines/offerings
- ✓ Locations/cities served
- ✓ Ordering/delivery process
- ✓ Dining experience info
- ✓ Customer reviews/ratings

**Expected Slides**:
- Cover, About, Locations, Offerings, Ordering Experience, Customer Ratings, Conclusion

---

### 3. E-commerce (e.g., Shopify, Amazon seller)
**URL**: https://www.shopify.com or similar

**Expected Evidence**:
- ✓ Product categories
- ✓ Pricing/plans
- ✓ Target merchants
- ✓ Features and capabilities
- ✓ Payment methods
- ✓ Integrations

**Expected Slides**:
- Cover, About, Products, Features, Merchants, Integrations, Pricing, Conclusion

---

### 4. University/Education
**URL**: https://www.stanford.edu or similar

**Expected Evidence**:
- ✓ Institution name and mission
- ✓ Programs/departments
- ✓ Admissions info
- ✓ Campus locations
- ✓ Notable research
- ✓ Faculty/leadership
- ✓ Student demographics

**Expected Slides**:
- Cover, About, Programs, Admissions, Campus, Research, Student Experience, Conclusion

---

### 5. Marketplace (e.g., Airbnb, Uber)
**URL**: https://www.airbnb.com or https://www.uber.com

**Expected Evidence**:
- ✓ Platform description
- ✓ Buyer/seller sides
- ✓ Trust mechanisms
- ✓ Categories/offerings
- ✓ Geography coverage
- ✓ Business model (commissions, etc.)
- ✓ Metrics (listings, users, etc.)

**Expected Slides**:
- Cover, About, Platform Overview, Buyers, Sellers, Trust, Geography, Business Model, Metrics, Conclusion

---

### 6. Technology/Infrastructure (e.g., Vercel, AWS)
**URL**: https://vercel.com or https://aws.amazon.com

**Expected Evidence**:
- ✓ Services offered
- ✓ Technical capabilities
- ✓ Pricing tiers
- ✓ Documentation/learning
- ✓ Enterprise features
- ✓ Security/compliance
- ✓ Integration ecosystem

**Expected Slides**:
- Cover, About, Services, Features, Pricing, Documentation, Security, Enterprise, Ecosystem, Conclusion

---

### 7. Unknown/Small Company
**URL**: Random small/unknown business site

**Expected Behavior**:
- ✓ Graceful degradation
- ✓ No hardcoded assumptions
- ✓ Honest "Information Not Found" for missing data
- ✓ Slides adapt to what's available
- ✗ No invented facts

---

## Critical Test Scenarios

### Success Path
- [ ] Create study with valid URL
- [ ] System crawls website
- [ ] Evidence extracted from crawled pages
- [ ] OpenAI web search performed (if configured)
- [ ] Claims generated from evidence
- [ ] Slides dynamically selected
- [ ] Presentation generated
- [ ] Export to PPTX succeeds
- [ ] Can reopen and edit study

### Failure Scenarios

#### Network Issues
- [ ] Website timeout (should retry, then gracefully degrade)
- [ ] Website 404 (should handle, show "page not found")
- [ ] Website 403 (should show "access denied")
- [ ] DNS resolution failure
- [ ] Partial crawl (some pages fail, others succeed)

#### Data Quality Issues
- [ ] Empty website (no content)
- [ ] JavaScript-heavy site (may get limited content)
- [ ] Malformed HTML
- [ ] Missing meta tags
- [ ] No images/screenshots available

#### OpenAI Issues
- [ ] OpenAI API key missing (should degrade gracefully)
- [ ] OpenAI API rate limit (should handle retry)
- [ ] OpenAI timeout
- [ ] Invalid search results format

#### Database Issues
- [ ] Supabase schema not initialized (should show clear error)
- [ ] Missing SUPABASE_SERVICE_ROLE_KEY
- [ ] Permission denied on insert
- [ ] Foreign key constraint failure
- [ ] Concurrent updates

#### React/Frontend Issues
- [ ] Malformed slide data (shouldn't crash entire app)
- [ ] Large dataset performance
- [ ] Browser back button during analysis
- [ ] Network failure mid-analysis
- [ ] Invalid image URLs in slides

### Conflict Detection
- [ ] Conflicting pricing information detected
- [ ] Conflicting company size metrics
- [ ] Conflicting founding dates
- [ ] System shows confidence scores
- [ ] User can see sources for each claim

---

## Evidence Verification Checklist

For each test site, verify:

### Evidence Collected
- [ ] Number of sources created
- [ ] Number of evidence items created
- [ ] Diversity of claim types
- [ ] Distribution across claim types

### Claims Generated
- [ ] Number of claims generated
- [ ] Claims have valid confidence scores (0-1)
- [ ] Each claim references evidence
- [ ] Status distribution (verified/supported/inferred)
- [ ] No duplicate claims

### Slides Generated
- [ ] Correct number of slides (not forced to 11)
- [ ] Appropriate slide types for content
- [ ] No "[object Object]" in slide content
- [ ] No undefined/null values rendered
- [ ] Images URLs valid
- [ ] Animations valid

---

## Performance Targets

- [ ] Homepage crawl: < 3 seconds
- [ ] Full site crawl (50 pages): < 30 seconds
- [ ] Web search (10 queries): < 10 seconds
- [ ] Evidence extraction: < 5 seconds
- [ ] Claim generation: < 5 seconds
- [ ] Slide selection: < 2 seconds
- [ ] Total study creation: < 60 seconds

---

## Data Integrity Tests

- [ ] Evidence doesn't exceed max storage
- [ ] Claims properly reference evidence IDs
- [ ] Source URLs are valid
- [ ] No circular references in evidence tree
- [ ] Confidence scores in valid range (0-1)
- [ ] Dates are ISO format
- [ ] UUIDs are valid

---

## End-to-End Test Flow

```
1. Clear database / start fresh
2. Sign up as new user
3. Dashboard should be empty
4. Create new study:
   - Enter valid URL
   - Choose purpose (investor, competitor, etc.)
   - Submit
5. Monitor CrawlStage:
   - Should show progress (Crawling... → Processing...)
   - Should complete or show error
6. View Report tabs:
   - DNA/Analysis/Audit should be populated
   - Can view understanding brief
7. Click Generate:
   - Should create presentation
   - Status should change to "generated"
8. View presentation:
   - All slides should render safely
   - No console errors
   - Can click through all slides
9. Export:
   - PPTX export should succeed
   - File should download
   - PPTX should be readable in PowerPoint
10. Re-open project:
    - Data should persist
    - Can edit slides
    - Can re-generate
11. Delete project:
    - Should remove all data
    - Database cleanup
```

---

## Regression Tests

After implementation, verify no regressions in:

- [ ] Login/signup flow
- [ ] Dashboard display
- [ ] Existing project loading
- [ ] Slide editing (manual)
- [ ] Creative Director (AI commands)
- [ ] Export (all formats)
- [ ] Gallery (public projects)
- [ ] Settings/preferences

---

## Monitoring/Logging

Enable and monitor:

- [ ] All API errors logged with context
- [ ] Evidence extraction logs
- [ ] Claim generation logs
- [ ] OpenAI search logs
- [ ] Supabase error logs
- [ ] React error boundaries triggered
- [ ] Performance metrics

---

## Deployment Checklist

Before going live:

- [ ] All tests passing
- [ ] No console errors
- [ ] Build succeeds without warnings
- [ ] Environment variables configured
- [ ] Supabase schema applied
- [ ] Rate limits configured
- [ ] Error messages user-friendly
- [ ] Performance acceptable
- [ ] No hardcoded company names
- [ ] Security review passed
- [ ] API keys properly secured
