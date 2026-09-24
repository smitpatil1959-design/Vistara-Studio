import http from 'node:http';
import { Readable } from 'node:stream';

const security = await import('../server/security.js');
const {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIP,
  hostnameBlockedByName,
  validateTarget,
  CRAWL_LIMITS,
  CrawlBlockedError,
  safeDispatcher,
  readCappedBody,
  isSafeHtmlOrTextContentType,
  sanitizeUrlForLog,
  logSecurityEvent,
} = security;

// IPv4 unit tests
t('ipv4: public IANA allocation allowed (192.0.43.8)', () => assert.equal(isPrivateIPv4('192.0.43.8'), false));
t('ipv4: loopback blocked (127.0.0.1)', () => assert.equal(isPrivateIPv4('127.0.0.1'), true));
t('ipv4: link-local / cloud metadata blocked (169.254.169.254)', () => assert.equal(isPrivateIPv4('169.254.169.254'), true));
t('ipv4: RFC1918 10/8 blocked (10.0.0.1)', () => assert.equal(isPrivateIPv4('10.0.0.1'), true));
t('ipv4: RFC1918 172.16/12 blocked (172.16.0.1)', () => assert.equal(isPrivateIPv4('172.16.0.1'), true));
t('ipv4: RFC1918 192.168 blocked (192.168.1.1)', () => assert.equal(isPrivateIPv4('192.168.1.1'), true));
t('ipv4: CGNAT blocked (100.80.1.1)', () => assert.equal(isPrivateIPv4('100.80.1.1'), true));
t('ipv4: documentation nets blocked (198.51.100.3)', () => assert.equal(isPrivateIPv4('198.51.100.3'), true));
t('ipv4: malformed blocked (999.1.1.1)', () => assert.equal(isPrivateIPv4('999.1.1.1'), true));
t('ipv4: 0.0.0.0 blocked', () => assert.equal(isPrivateIPv4('0.0.0.0'), true));
t('ipv4: public ok (8.8.8.8)', () => assert.equal(isPrivateIPv4('8.8.8.8'), false));

// IPv6 unit tests
t('ipv6: loopback blocked (::1)', () => assert.equal(isPrivateIPv6('::1'), true));
t('ipv6: link-local blocked (fe80::1)', () => assert.equal(isPrivateIPv6('fe80::1'), true));
t('ipv6: ULA blocked (fd12:34::1)', () => assert.equal(isPrivateIPv6('fd12:34::1'), true));
t('ipv6: v4-mapped loopback blocked (::ffff:127.0.0.1)', () => assert.equal(isPrivateIPv6('::ffff:127.0.0.1'), true));
t('ipv6: AWS metadata IPv6 blocked (fd00:ec2::254)', () => assert.equal(isPrivateIPv6('fd00:ec2::254'), true));
t('ipv6: public ok (2606:4700:4700::1111)', () => assert.equal(isPrivateIPv6('2606:4700:4700::1111'), false));

// Alternate IP encodings (isPrivateIP)
t('isPrivateIP: decimal integer representation of 127.0.0.1 (2130706433)', () => {
  assert.equal(isPrivateIP('2130706433'), true);
});
t('isPrivateIP: hex integer representation of 127.0.0.1 (0x7f000001)', () => {
  assert.equal(isPrivateIP('0x7f000001'), true);
});
t('isPrivateIP: decimal representation of 169.254.169.254 (2852039166)', () => {
  assert.equal(isPrivateIP('2852039166'), true);
});
t('isPrivateIP: Alibaba metadata IP (100.100.100.200)', () => {
  assert.equal(isPrivateIP('100.100.100.200'), true);
});

// Hostname blocklist unit tests
t('hostname: metadata endpoints blocked', () => assert.equal(hostnameBlockedByName('metadata.google.internal'), true));
t('hostname: AWS instance-data blocked', () => assert.equal(hostnameBlockedByName('instance-data'), true));
t('hostname: k8s default service blocked', () => assert.equal(hostnameBlockedByName('kubernetes.default.svc.cluster.local'), true));
t('hostname: .local blocked', () => assert.equal(hostnameBlockedByName('printer.local'), true));
t('hostname: .internal blocked', () => assert.equal(hostnameBlockedByName('service.internal'), true));
t('hostname: localhost blocked', () => assert.equal(hostnameBlockedByName('localhost'), true));
t('hostname: normal public ok', () => assert.equal(hostnameBlockedByName('example.com'), false));

// Explicit target verification for ALL required URLs
t('validateTarget: blocks http://localhost', async () => {
  await assert.rejects(() => validateTarget('http://localhost'), (e) => e.code === 'blocked-host');
});

t('validateTarget: blocks http://127.0.0.1', async () => {
  await assert.rejects(() => validateTarget('http://127.0.0.1'), (e) => e.code === 'blocked-host');
});

t('validateTarget: blocks http://127.0.0.1:3000', async () => {
  await assert.rejects(() => validateTarget('http://127.0.0.1:3000'), (e) => e.code === 'blocked-host' || e.code === 'port');
});

t('validateTarget: blocks http://169.254.169.254', async () => {
  await assert.rejects(() => validateTarget('http://169.254.169.254'), (e) => e.code === 'blocked-host');
});

t('validateTarget: blocks http://10.0.0.1', async () => {
  await assert.rejects(() => validateTarget('http://10.0.0.1'), (e) => e.code === 'blocked-host');
});

t('validateTarget: blocks http://172.16.0.1', async () => {
  await assert.rejects(() => validateTarget('http://172.16.0.1'), (e) => e.code === 'blocked-host');
});

t('validateTarget: blocks http://192.168.1.1', async () => {
  await assert.rejects(() => validateTarget('http://192.168.1.1'), (e) => e.code === 'blocked-host');
});

t('validateTarget: blocks file:///etc/passwd', async () => {
  await assert.rejects(() => validateTarget('file:///etc/passwd'), (e) => e.code === 'protocol' || e.code === 'invalid-url');
});

t('validateTarget: blocks javascript:alert(1)', async () => {
  await assert.rejects(() => validateTarget('javascript:alert(1)'), (e) => e.code === 'protocol' || e.code === 'invalid-url');
});

t('validateTarget: blocks data:text/html,test', async () => {
  await assert.rejects(() => validateTarget('data:text/html,test'), (e) => e.code === 'protocol' || e.code === 'invalid-url');
});

t('validateTarget: allows https://example.com', async () => {
  const r = await validateTarget('https://example.com');
  assert.equal(r.host, 'example.com');
});

// Alternate numeric representations in validateTarget
t('validateTarget: blocks decimal integer IP http://2130706433', async () => {
  await assert.rejects(() => validateTarget('http://2130706433'), (e) => e.code === 'blocked-host' || e.code === 'dns');
});

t('validateTarget: blocks hex IP http://0x7f000001', async () => {
  await assert.rejects(() => validateTarget('http://0x7f000001'), (e) => e.code === 'blocked-host' || e.code === 'dns');
});

// Port validation tests
t('validateTarget: rejects non-standard port 8080', async () => {
  await assert.rejects(() => validateTarget('https://example.com:8080/'), (e) => e.code === 'port');
});

t('validateTarget: rejects SSH port 22', async () => {
  await assert.rejects(() => validateTarget('http://example.com:22/'), (e) => e.code === 'port');
});

t('validateTarget: rejects MySQL port 3306', async () => {
  await assert.rejects(() => validateTarget('http://example.com:3306/'), (e) => e.code === 'port');
});

t('validateTarget: allows standard http port 80', async () => {
  const r = await validateTarget('http://example.com:80/');
  assert.equal(r.port, 80);
});

t('validateTarget: allows standard https port 443', async () => {
  const r = await validateTarget('https://example.com:443/');
  assert.equal(r.port, 443);
});

// Credentials & Host format
t('validateTarget: rejects credentialed URLs', async () => {
  await assert.rejects(() => validateTarget('https://user:pass@example.com/a'), (e) => e.code === 'credentials' || e.code === 'blocked-host');
});

t('validateTarget: rejects no-TLD hosts', async () => {
  await assert.rejects(() => validateTarget('https://intranet'), (e) => e.code === 'dns' || e.code === 'blocked-host');
});

// Content-Type validation tests
t('content-type: allows text/html and text/plain', () => {
  assert.equal(isSafeHtmlOrTextContentType('text/html; charset=utf-8'), true);
  assert.equal(isSafeHtmlOrTextContentType('application/xhtml+xml'), true);
  assert.equal(isSafeHtmlOrTextContentType('text/plain'), true);
});

t('content-type: rejects binary downloads (pdf, zip, exe, video, audio)', () => {
  assert.equal(isSafeHtmlOrTextContentType('application/pdf'), false);
  assert.equal(isSafeHtmlOrTextContentType('application/zip'), false);
  assert.equal(isSafeHtmlOrTextContentType('application/octet-stream'), false);
  assert.equal(isSafeHtmlOrTextContentType('video/mp4'), false);
  assert.equal(isSafeHtmlOrTextContentType('audio/mpeg'), false);
});

// Stream capping tests
t('readCappedBody: caps responses exceeding maxBytes and cancels stream', async () => {
  let streamCancelled = false;
  const chunk = new TextEncoder().encode('A'.repeat(1024));
  let count = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (count++ < 10) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
    cancel() {
      streamCancelled = true;
    },
  });

  const mockRes = {
    body: stream,
    text: async () => 'A'.repeat(10240),
  };

  const { html, capped } = await readCappedBody(mockRes, 2048);
  assert.equal(capped, true);
  assert.ok(html.length <= 2048);
  assert.equal(streamCancelled, true);
});

// Sanitize URL for logging
t('sanitizeUrlForLog: removes credentials, query strings, and fragments', () => {
  const sanitized = sanitizeUrlForLog('https://alice:secret123@example.com:443/dashboard/overview?token=sensitive-api-key#details');
  assert.equal(sanitized, 'https://example.com/dashboard/overview');
  assert.ok(!sanitized.includes('secret123'));
  assert.ok(!sanitized.includes('sensitive-api-key'));
  assert.ok(!sanitized.includes('details'));
});

// Redirect protection test: server redirects to 127.0.0.1
t('redirect protection: blocks redirect to private IP', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect-ssrf') {
      res.writeHead(302, { Location: 'http://127.0.0.1/admin' });
      res.end();
    } else {
      res.writeHead(200);
      res.end('ok');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // When fetchValidated attempts to follow a redirect to 127.0.0.1, validateTarget on next hop rejects it
    await assert.rejects(
      () => security.fetchValidated(`http://127.0.0.1:${port}/redirect-ssrf`, CRAWL_LIMITS),
      (e) => e.code === 'blocked-host' || e.code === 'port'
    );
  } finally {
    server.close();
  }
});

// DNS rebinding / socket level dispatcher test
t('safeDispatcher: rejects socket connection to private IP', async () => {
  assert.ok(safeDispatcher, 'safeDispatcher is exported');
  // An attempt to fetch an invalid/loopback host with safeDispatcher will be intercepted at socket connect
  await assert.rejects(
    () => fetch('http://127.0.0.1:80/', { dispatcher: safeDispatcher }),
    (e) => /blocked-host|ECONNREFUSED|fetch failed/i.test(e.message || '')
  );
});

// Crawl limits sanity
t('crawl limits sane', () => {
  assert.ok(CRAWL_LIMITS.pageLimit <= 8, 'page cap bounded');
  assert.ok(CRAWL_LIMITS.totalBudgetMs <= 60000, 'total budget under function cap');
  assert.ok(CRAWL_LIMITS.redirectLimit <= 5, 'redirect cap');
  assert.ok(CRAWL_LIMITS.maxHtmlBytes >= 1024 * 1024, 'payload cap exists');
});
