import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { applyEditorProposal, COMPOSITIONS, type EditorProposal, type PresentationSpec } from '../../deck-spec';
import { SpecCanvas } from '../../components/deck/SpecStage';
import { requestEditorProposal } from '../../services/ai';

interface Props {
  projectId: string;
  doc: PresentationSpec;
  slideId: string;
  selection: string[];
  onApply: (doc: PresentationSpec, slideId: string) => void;
}
const suggestions = ['Shorten the title', 'Try a two-column comparison layout', 'Apply an editorial theme', 'Add a slide with verified research findings', 'Chart comparable verified figures'];

export default function AssistantPanel({ projectId, doc, slideId, selection, onApply }: Props) {
  const [command, setCommand] = useState(''), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [draft, setDraft] = useState<{ base: PresentationSpec; proposal: EditorProposal; preview: PresentationSpec; focus: string } | null>(null);
  const ask = async (value: string) => {
    if (loading || !value.trim()) return;
    setCommand(value); setError(''); setDraft(null); setLoading(true);
    try {
      const proposal = await requestEditorProposal(projectId, value, doc, slideId, selection);
      const result = applyEditorProposal(doc, proposal);
      setDraft({ base: doc, proposal, preview: result.document, focus: result.focus });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not prepare a suggestion.'); }
    finally { setLoading(false); }
  };
  const stale = draft && draft.base !== doc;
  return <div className="v-assistant">
    <p className="v-help">Ask for a change and preview it before applying. Research additions cite the current sources.</p>
    <form onSubmit={event => { event.preventDefault(); void ask(command); }}>
      <textarea aria-label="Tell the assistant what to change" placeholder="What would you like to change?" value={command} onChange={event => setCommand(event.target.value)} rows={4} maxLength={800} />
      <button className="v-button v-primary" disabled={loading || !command.trim()}><Sparkles size={14} /> {loading ? 'Preparing preview…' : 'Suggest changes'}</button>
    </form>
    {error && <p className="v-error" role="alert">{error}</p>}
    {draft && <div className="v-assistant-preview" aria-live="polite">
      <span className="v-help">{draft.proposal.engine}{draft.proposal.model ? ` · ${draft.proposal.model.split('/').at(-1)}` : ''}</span>
      <p>{draft.proposal.summary}</p>
      {draft.proposal.operations.length > 0 && <>
        <SpecCanvas spec={draft.preview} index={Math.max(0, draft.preview.slides.findIndex(slide => slide.id === draft.focus))} />
        <ul>{draft.proposal.operations.map((op, i) => <li key={i}>{op.kind === 'rewrite' ? `Rewrite: “${op.text}”` : op.kind === 'layout' ? `Layout: ${COMPOSITIONS.find(item => item.id === op.preset)?.name}` : op.kind === 'theme' ? `Whole presentation: ${op.mood} theme` : op.kind === 'purpose' ? `Reorder slides for a ${op.purpose === 'investor' ? 'investor briefing' : 'college project'}`.replace('a investor', 'an investor') : op.kind === 'evidence' ? `New slide with ${op.claims.length} cited findings` : `New chart with ${op.points.length} cited figures`}</li>)}</ul>
        {draft.proposal.operations.some(op => op.kind === 'purpose') && <ol className="list-decimal pl-4">{draft.preview.slides.map(slide => <li key={slide.id}>{slide.label}</li>)}</ol>}
        {stale && <p role="status">The presentation changed. Request a new preview.</p>}
        <button className="v-button v-primary" disabled={!!stale || draft.preview === doc} onClick={() => { onApply(draft.preview, draft.focus); setDraft(null); }}>Apply changes</button>
      </>}
      <button className="v-button" onClick={() => setDraft(null)}>Discard preview</button>
    </div>}
    <div className="v-assistant-suggestions">{suggestions.map(value => <button className="v-button" key={value} disabled={loading} onClick={() => void ask(value)}>{value}</button>)}</div>
  </div>;
}
