import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronUp, Database, ExternalLink, FileText, Globe, Search, Shield, Wifi, Zap } from 'lucide-react';
import { getResearchStatus, getResearchSources, getResearchClaims } from '../services';
import type { ResearchClaim, ResearchMode, ResearchSession, ResearchSource } from '../types';

interface ResearchViewProps {
  projectId: string;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  official: { label: 'Official', color: 'bg-emerald-100 text-emerald-800' },
  official_documentation: { label: 'Official Docs', color: 'bg-emerald-100 text-emerald-800' },
  official_newsroom: { label: 'Official Newsroom', color: 'bg-emerald-100 text-emerald-800' },
  government: { label: 'Government', color: 'bg-blue-100 text-blue-800' },
  industry: { label: 'Industry', color: 'bg-violet-100 text-violet-800' },
  news: { label: 'News', color: 'bg-amber-100 text-amber-800' },
  third_party: { label: 'Third Party', color: 'bg-gray-100 text-gray-600' },
};

const CLAIM_STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  verified: { label: 'Verified', color: 'text-emerald-700 bg-emerald-50', icon: <Check size={10} /> },
  supported: { label: 'Supported', color: 'text-blue-700 bg-blue-50', icon: <Check size={10} /> },
  inferred: { label: 'Inferred', color: 'text-amber-700 bg-amber-50', icon: <ChevronUp size={10} /> },
  conflicting: { label: 'Conflicting', color: 'text-red-700 bg-red-50', icon: <AlertTriangle size={10} /> },
  rejected: { label: 'Rejected', color: 'text-gray-500 bg-gray-50', icon: <ChevronDown size={10} /> },
};

const CLAIM_TYPE_GROUPS: Record<string, string[]> = {
  'Company': ['company_description', 'business_model', 'founder'],
  'Products': ['product', 'service', 'feature', 'integration'],
  'Market': ['market', 'industry', 'competitor', 'differentiator'],
  'Audience': ['audience', 'customer'],
  'Business': ['pricing', 'metric', 'partnership', 'location'],
  'Technical': ['technology', 'security'],
  'People': ['leadership'],
  'News': ['news', 'observation'],
};

function groupClaims(claims: ResearchClaim[]): Record<string, ResearchClaim[]> {
  const result: Record<string, ResearchClaim[]> = {};
  for (const claim of claims) {
    let group = 'Other';
    for (const [g, types] of Object.entries(CLAIM_TYPE_GROUPS)) {
      if (types.includes(claim.claimType)) { group = g; break; }
    }
    if (!result[group]) result[group] = [];
    result[group].push(claim);
  }
  return result;
}

function confidenceBar(score: number) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f87171';
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 rounded-full bg-line overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-[10px] text-fog font-mono">{pct}%</span>
    </div>
  );
}

export default function ResearchView({ projectId }: ResearchViewProps) {
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [claims, setClaims] = useState<ResearchClaim[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'claims'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [sess, srcs, clms] = await Promise.allSettled([
          getResearchStatus(projectId),
          getResearchSources(projectId),
          getResearchClaims(projectId),
        ]);
        if (sess.status === 'fulfilled') setSession(sess.value);
        if (srcs.status === 'fulfilled') setSources(srcs.value.sources);
        if (clms.status === 'fulfilled') setClaims(clms.value.claims);
        if (sess.status === 'rejected') setError('No research session found. Run the research pipeline first.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load research data');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-fog">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-lime-deep border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading research data…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center max-w-sm">
          <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} />
          <p className="text-fog text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const grouped = groupClaims(claims);
  const researchMode: ResearchMode = session?.researchMode || 'crawl_only';
  const verifiedCount = claims.filter(c => c.status === 'verified').length;
  const supportedCount = claims.filter(c => c.status === 'supported').length;
  const conflictingCount = claims.filter(c => c.status === 'conflicting').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-semibold text-ink">Research Report</h2>
          {researchMode === 'crawl_and_search' && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700">
              <Wifi size={10} /> Full internet research
            </span>
          )}
        </div>
        {session?.subjectName && (
          <p className="text-fog text-sm">
            Subject: <span className="font-medium text-ink">{session.subjectName}</span>
            {session.subjectType && <span className="ml-2 text-fog/70">({session.subjectType.replace(/_/g, ' ')})</span>}
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <Globe size={14} />, label: 'Sources', value: session?.sourcesCount ?? sources.length },
          { icon: <Database size={14} />, label: 'Evidence', value: session?.evidenceCount ?? 0 },
          { icon: <FileText size={14} />, label: 'Claims', value: session?.claimsCount ?? claims.length },
          { icon: <Shield size={14} />, label: 'Verified', value: verifiedCount },
        ].map(({ icon, label, value }) => (
          <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
            <span className="text-lime-deep">{icon}</span>
            <div>
              <p className="text-2xl font-semibold text-ink">{value}</p>
              <p className="text-[11px] text-fog">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-panel2 rounded-xl w-fit">
        {(['overview', 'sources', 'claims'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all capitalize ${
              activeTab === tab ? 'bg-white shadow-sm text-ink' : 'text-fog hover:text-ink'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Claim breakdown */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2"><Zap size={14} className="text-lime-deep" /> Claims Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Verified', count: verifiedCount, color: 'text-emerald-600' },
                { label: 'Supported', count: supportedCount, color: 'text-blue-600' },
                { label: 'Inferred', count: claims.filter(c => c.status === 'inferred').length, color: 'text-amber-600' },
                { label: 'Conflicting', count: conflictingCount, color: 'text-red-600' },
              ].map(({ label, count, color }) => (
                <div key={label} className="text-center p-3 rounded-xl bg-panel2">
                  <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  <p className="text-[11px] text-fog mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Research queries */}
          {session?.searchQueriesRun ? (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold text-ink mb-3 flex items-center gap-2"><Search size={14} className="text-lime-deep" /> Internet Research</h3>
              <div className="flex items-center gap-6 text-sm text-fog">
                <span><span className="font-semibold text-ink">{session.searchQueriesRun}</span> search queries run</span>
                <span><span className="font-semibold text-ink">{session.sourcesCount}</span> sources found</span>
                {session.conflictsCount > 0 && <span><span className="font-semibold text-ink">{session.conflictsCount}</span> conflicts resolved</span>}
              </div>
            </div>
          ) : null}

          {/* Top sources preview */}
          {sources.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold text-ink mb-3 flex items-center gap-2"><BookOpen size={14} className="text-lime-deep" /> Top Sources</h3>
              <div className="space-y-2">
                {sources.slice(0, 5).map(s => {
                  const badge = SOURCE_LABELS[s.sourceType] || SOURCE_LABELS.third_party;
                  return (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>{badge.label}</span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-fog hover:text-ink truncate transition-colors flex items-center gap-1">
                        {s.title || s.domain || s.url.slice(0, 50)}
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Sources tab */}
      {activeTab === 'sources' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {sources.length === 0 ? (
            <p className="text-fog text-sm text-center py-12">No sources found. Run the research pipeline first.</p>
          ) : sources.map(s => {
            const badge = SOURCE_LABELS[s.sourceType] || SOURCE_LABELS.third_party;
            return (
              <div key={s.id} className="glass rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${badge.color}`}>{badge.label}</span>
                  <div className="flex-1 min-w-0">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ink hover:text-lime-deep transition-colors flex items-center gap-1.5">
                      {s.title || s.domain || 'Untitled source'}
                      <ExternalLink size={11} className="shrink-0 text-fog" />
                    </a>
                    {s.snippet && <p className="text-[12px] text-fog mt-1 line-clamp-2">{s.snippet}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-fog/70 font-mono">
                      <span>{s.domain}</span>
                      {s.publicationDate && <span>{s.publicationDate}</span>}
                      <span>authority: {Math.round((s.hierarchyScore || 0) * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Claims tab */}
      {activeTab === 'claims' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {claims.length === 0 ? (
            <p className="text-fog text-sm text-center py-12">No claims found. Run the research pipeline first.</p>
          ) : Object.entries(grouped).map(([group, groupClaims]) => (
            <div key={group} className="glass rounded-2xl p-5">
              <h3 className="font-semibold text-ink mb-3 text-[13px] uppercase tracking-wide text-fog">{group}</h3>
              <div className="space-y-2">
                {groupClaims.map(c => {
                  const statusConfig = CLAIM_STATUS_LABELS[c.status] || CLAIM_STATUS_LABELS.inferred;
                  const isExpanded = expandedClaim === c.id;
                  return (
                    <div key={c.id} className="rounded-xl bg-panel2 p-3">
                      <div className="flex items-start gap-2.5 cursor-pointer" onClick={() => setExpandedClaim(isExpanded ? null : c.id)}>
                        <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${statusConfig.color}`}>
                          {statusConfig.icon} {statusConfig.label}
                        </span>
                        <p className="text-[13px] text-ink flex-1 leading-snug">{c.claim}</p>
                        <span className="shrink-0 text-fog">{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 ml-2 pl-3 border-l-2 border-lime-deep/30 space-y-2">
                          {confidenceBar(c.confidence)}
                          {c.sourceUrls.length > 0 && (
                            <div className="space-y-1">
                              {c.sourceUrls.slice(0, 3).map((url, i) => {
                                let domain = url;
                                try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = url; }
                                return (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-lime-deep hover:underline font-mono">
                                    <ExternalLink size={9} /> {domain}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
