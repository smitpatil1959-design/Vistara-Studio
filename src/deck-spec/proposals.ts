import { applyTheme, COMPOSITIONS, composeSlide, renumberSlides } from './design';
import { brandForLegacy } from './design';
import { themeFromBrand, type ThemeMood } from './brand';
import { addSlide, makeElement, updateElement } from './ops';
import type { PresentationSpec, SourceReference } from './types';
import type { verifiedChartPoints } from './evidence';

export type ProposalOperation =
  | { kind: 'rewrite'; elementId: string; text: string }
  | { kind: 'layout'; preset: string }
  | { kind: 'theme'; mood: ThemeMood }
  | { kind: 'purpose'; purpose: 'college' | 'investor' }
  | { kind: 'evidence'; title: string; claims: { id: string; text: string; source: SourceReference }[] }
  | { kind: 'chart'; points: ReturnType<typeof verifiedChartPoints> };
export interface EditorProposal { slideId: string; operations: ProposalOperation[]; summary: string; engine: string; model?: string; }

export function applyEditorProposal(doc: PresentationSpec, proposal: EditorProposal) {
  let next = doc, focus = proposal.slideId;
  const locate = () => next.slides.findIndex(slide => slide.id === proposal.slideId);
  if (locate() < 0) return { document: doc, focus };
  for (const op of proposal.operations) {
    const index = locate(), slide = next.slides[index];
    if (op.kind === 'rewrite') {
      const element = slide.elements.find(el => el.id === op.elementId);
      if (element?.content.kind === 'text' && !element.locked && !element.hidden) {
        next = updateElement(next, slide.id, element.id, { content: { ...element.content, text: op.text } });
      }
    } else if (op.kind === 'layout' && COMPOSITIONS.some(preset => preset.id === op.preset)) {
      next = { ...next, slides: next.slides.map((s, i) => i === index ? composeSlide(s, next.theme, op.preset, i, next.slides.length, next.brand, Number(s.metadata.designVariant ?? i % 5)) : s) };
    } else if (op.kind === 'theme') {
      const brand = next.brand || brandForLegacy(next.name, next.meta.projectUrl, next.theme.colors.accent);
      next = applyTheme(next, themeFromBrand(brand, op.mood));
    } else if (op.kind === 'purpose') {
      const order = op.purpose === 'investor'
        ? ['metrics', 'market', 'growth', 'businessValue', 'differentiation', 'comparison', 'pricing', 'overview', 'product', 'services']
        : ['intro', 'overview', 'problem', 'product', 'features', 'workflow', 'impact', 'technology', 'metrics'];
      const score = (s: typeof slide) => s.section === 'hero' ? -2 : s.metadata.referencePage ? 100 : s.section === 'cta' ? 99 : order.includes(s.section) ? order.indexOf(s.section) : 50;
      const slides = [...next.slides].sort((a, b) => score(a) - score(b));
      next = renumberSlides({ ...next, meta: { ...next.meta, purpose: op.purpose }, slides });
      const hero = next.slides.find(item => item.section === 'hero');
      const kicker = hero?.elements.find(element => element.content.kind === 'text' && element.content.role === 'kicker' && !element.locked);
      if (hero && kicker) next = updateElement(next, hero.id, kicker.id, { contentText: op.purpose === 'investor' ? 'INVESTOR BRIEFING' : 'COLLEGE PROJECT' });
    } else if (op.kind === 'evidence' || op.kind === 'chart') {
      const title = op.kind === 'chart' ? 'Verified figures' : op.title;
      const { spec, newId } = addSlide(next, 'overview', title);
      const added = spec.slides.at(-1)!;
      added.elements = added.elements.slice(0, 1);
      if (op.kind === 'evidence') {
        added.sources = op.claims.map(item => item.source);
        for (const claim of op.claims) {
          const card = makeElement('card');
          card.content = { kind: 'card', title: 'Research finding', body: claim.text, icon: null, index: null, metric: null };
          card.metadata = { claimId: claim.id, sourceUrl: claim.source.url };
          added.elements.push(card);
        }
      } else {
        added.sources = op.points.map(point => ({ url: point.sourceUrl, claimId: point.claimId }));
        const chart = makeElement('chart');
        chart.content = { kind: 'chart', chart: 'bars', series: op.points.map(point => ({ label: point.label, value: point.value, claimId: point.claimId, sourceUrl: point.sourceUrl })), dataSource: 'verified', axisLabel: op.points[0]?.unit, legend: false, showValues: true };
        added.elements.push(chart);
      }
      added.notes = 'Evidence from this project’s latest completed research. See slide sources for the original context.';
      const slides = spec.slides.slice(0, -1);
      slides.splice(index + 1, 0, composeSlide(added, spec.theme, op.kind === 'chart' ? 'data' : 'findings', index + 1, spec.slides.length, spec.brand));
      next = renumberSlides({ ...spec, slides });
      focus = newId;
    }
  }
  return { document: next, focus };
}
