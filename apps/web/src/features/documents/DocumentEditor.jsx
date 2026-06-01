import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table/table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import CharacterCount from '@tiptap/extension-character-count';
import { common, createLowlight } from 'lowlight';
import api, { silent } from '../../lib/api';
import { useAuthStore, useUIStore } from '../../store';
import { Avatar } from '../../components/ui/Avatar';
import { Sparkles, ArrowLeft, Save, Check, Loader, Type, Heading1, Heading2, Heading3, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, ListChecks, Quote, Code, Link as LinkIcon, Image as ImageIcon, Table as TableIcon, Highlighter, AlignLeft, AlignCenter, AlignRight, MessageSquare, History, Share2, MoreHorizontal, Wand2, Languages, FileText, ChevronDown, FileDown, Copy, Eye, EyeOff, AlertCircle, BookOpen, ChevronRight } from 'lucide-react';
import { formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';
import { joinRoom, leaveRoom } from '../../lib/socket';
import { Mention } from '../../components/editor/Mention';

const lowlight = createLowlight(common);

export default function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [saved, setSaved] = useState(true);
  const [aiPanel, setAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [pageAnalytics, setPageAnalytics] = useState(null);
  const [comments, setComments] = useState([]);

  const doc = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.get(`/documents/${id}`, silent()).then((r) => r.data.data),
    enabled: !!id,
  });

  const versions = useQuery({
    queryKey: ['document-versions', id],
    queryFn: () => api.get(`/page-versions/${id}`, silent()).then((r) => r.data.data || []),
    enabled: !!id && showVersions,
  });

  const commentsQuery = useQuery({
    queryKey: ['document-comments', id],
    queryFn: () => api.get(`/documents/${id}/comments`, silent()).then((r) => r.data.data || []),
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (data) => api.patch(`/documents/${id}`, data).then((r) => r.data),
    onSuccess: () => { setSaved(true); qc.invalidateQueries(['document', id]); },
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Start writing, press / for commands…' }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      CharacterCount,
      Mention.configure({ HTMLAttributes: { class: 'mention' } }),
    ],
    content: doc.data?.content || '',
    onUpdate: ({ editor }) => {
      setSaved(false);
      debouncedUpdate(editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor && doc.data) {
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(doc.data.content);
      if (current !== incoming) editor.commands.setContent(doc.data.content || '');
    }
  }, [doc.data, editor]);

  useEffect(() => {
    if (id) {
      joinRoom(`doc:${id}`);
      // Track page view
      api.post('/analytics/track', { page_type: 'document', page_id: id, event_type: 'view' }, silent()).catch(() => {});
      return () => leaveRoom(`doc:${id}`);
    }
  }, [id]);

  let timer;
  const debouncedUpdate = (content) => {
    clearTimeout(timer);
    timer = setTimeout(() => update.mutate({ content }), 800);
  };

  const runAI = async (action) => {
    const text = editor?.getText() || '';
    if (!text) { toast.error('Document is empty'); return; }
    setAiLoading(true); setAiResult('');
    try {
      let endpoint, body;
      if (action === 'improve') { endpoint = `/documents/${id}/ai/improve`; body = {}; }
      else if (action === 'summarize') { endpoint = `/documents/${id}/ai/summarize`; body = {}; }
      else if (action === 'continue') { endpoint = `/documents/${id}/ai/continue`; body = { prompt: aiPrompt }; }
      else if (action === 'translate') { endpoint = `/ai/translate`; body = { text, to: aiPrompt || 'Spanish' }; }
      else if (action === 'qa') { endpoint = `/ai/chat`; body = { messages: [{ role: 'user', content: aiPrompt || 'Summarize this document' }], feature: 'doc_qa' }; }
      const { data } = await api.post(endpoint, body, silent());
      setAiResult(data.data.text || 'No response');
    } catch (e) { toast.error('AI failed'); }
    finally { setAiLoading(false); }
  };

  const exportPDF = async () => {
    try {
      const text = editor?.getText() || '';
      const { data } = await api.post('/exports/pdf', { organization_id: doc.data?.workspace_id, type: 'document', entity_id: id, content: text, title: doc.data?.title }, silent());
      toast.success('PDF export queued! Check export jobs.');
    } catch (e) { toast.error('Export failed'); }
  };

  const insertMermaid = () => {
    const code = prompt('Mermaid diagram code:', 'graph TD;\n  A-->B;\n  A-->C;');
    if (code) editor.chain().focus().insertContent(`\n<pre class="mermaid">${code}</pre>\n`).run();
  };

  const insertMath = () => {
    const tex = prompt('LaTeX formula:', 'E = mc^2');
    if (tex) editor.chain().focus().insertContent(`<span data-type="math" data-tex="${tex}">${tex}</span>`).run();
  };

  const saveVersion = async () => {
    try {
      await api.post(`/page-versions/${id}`, { summary: 'Manual save' }, silent());
      qc.invalidateQueries(['document-versions', id]);
      toast.success('Version saved');
    } catch (e) { toast.error('Failed to save version'); }
  };

  const restoreVersion = async (version) => {
    if (!confirm(`Restore to version ${version}?`)) return;
    try {
      await api.post(`/page-versions/${id}/restore/${version}`, {}, silent());
      qc.invalidateQueries(['document', id]);
      toast.success('Version restored');
    } catch (e) { toast.error('Failed to restore'); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/app/documents/${id}`);
    toast.success('Link copied');
  };

  const addComment = async (text) => {
    if (!text.trim()) return;
    try {
      await api.post(`/documents/${id}/comments`, { body: text }, silent());
      qc.invalidateQueries(['document-comments', id]);
      toast.success('Comment added');
    } catch (e) { toast.error('Failed'); }
  };

  if (doc.isLoading) return <Loader />;

  // Build outline from headings
  const outline = editor ? extractOutline(editor.getJSON()) : [];

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="h-14 px-4 sm:px-6 border-b border-border flex items-center gap-3 sticky top-0 bg-surface z-10">
        <button onClick={() => navigate('/app/documents')} className="btn-icon btn-ghost"><ArrowLeft size={16} /></button>
        <input
          value={doc.data?.title || ''}
          onChange={(e) => { setSaved(false); debouncedUpdateTitle(e.target.value); }}
          className="text-base font-semibold bg-transparent focus:outline-none flex-1 min-w-0"
          placeholder="Untitled"
        />
        <span className="text-xs text-fg-3 flex items-center gap-1">
          {saved ? <><Check size={12} className="text-emerald-500" /> Saved</> : 'Saving…'}
        </span>
        <button onClick={saveVersion} className="btn-ghost btn-sm" title="Save version"><History size={14} /></button>
        <button onClick={copyLink} className="btn-ghost btn-sm" title="Copy link"><Copy size={14} /></button>
        <button onClick={exportPDF} className="btn-ghost btn-sm" title="Export PDF"><FileDown size={14} /></button>
        <button onClick={() => setShowVersions(!showVersions)} className={`btn-ghost btn-sm ${showVersions ? 'bg-surface-3' : ''}`} title="Version history"><History size={14} /></button>
        <button onClick={() => setAiPanel(!aiPanel)} className={`btn-sm ${aiPanel ? 'btn-primary' : 'btn-secondary'}`}><Sparkles size={14} /> AI</button>
        <button onClick={() => setShowOutline(!showOutline)} className="btn-ghost btn-icon" title="Outline"><BookOpen size={14} /></button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Outline sidebar */}
        {showOutline && (
          <div className="w-56 border-r border-border bg-surface-2 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold uppercase text-fg-3 mb-2">Outline</h3>
            {outline.length === 0 ? <p className="text-xs text-fg-3">No headings</p> : (
              <div className="space-y-1">
                {outline.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => editor?.chain().focus().setTextSelection(h.pos).run()}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-surface-3 truncate"
                    style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                  >
                    {h.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Versions sidebar */}
        {showVersions && (
          <div className="w-64 border-r border-border bg-surface-2 overflow-y-auto p-4">
            <h3 className="text-xs font-semibold uppercase text-fg-3 mb-2">Version history</h3>
            {versions.data?.length === 0 ? <p className="text-xs text-fg-3">No versions yet</p> : (
              <div className="space-y-2">
                {versions.data?.map((v) => (
                  <div key={v.id} className="p-2 rounded-lg border border-border bg-surface text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">v{v.version}</span>
                      <button onClick={() => restoreVersion(v.version)} className="text-brand-600 hover:underline">Restore</button>
                    </div>
                    <div className="text-fg-3">{v.change_summary || 'No summary'}</div>
                    <div className="text-fg-3 text-[10px] mt-1">{formatRelative(v.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-10">
            {editor && <Toolbar editor={editor} onInsertMermaid={insertMermaid} onInsertMath={insertMath} />}
            <div className="prose prose-lg dark:prose-invert max-w-none mt-6">
              <EditorContent editor={editor} />
            </div>
            {editor && (
              <div className="mt-8 text-xs text-fg-3 border-t border-border pt-4">
                {editor.storage.characterCount?.characters?.() || 0} characters · {editor.storage.characterCount?.words?.() || 0} words
              </div>
            )}

            {/* Comments */}
            <div className="mt-12 border-t border-border pt-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare size={14} /> Comments ({commentsQuery.data?.length || 0})</h3>
              <CommentBox onSubmit={addComment} />
              <div className="mt-4 space-y-3">
                {commentsQuery.data?.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={c.author_name} src={c.author_avatar} size="sm" />
                    <div className="flex-1">
                      <div className="text-xs text-fg-3"><span className="font-medium text-fg">{c.author_name || 'You'}</span> · {formatRelative(c.created_at)}</div>
                      <p className="text-sm mt-0.5">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Panel */}
        {aiPanel && (
          <div className="w-80 border-l border-border bg-surface-2 overflow-y-auto">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><Sparkles size={16} className="text-brand-500" /> AI Assistant</h3>
              <p className="text-xs text-fg-3 mt-1">Multi-provider AI with fallback</p>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => runAI('improve')} disabled={aiLoading} className="btn-secondary w-full justify-start"><Wand2 size={14} /> Improve writing</button>
              <button onClick={() => runAI('summarize')} disabled={aiLoading} className="btn-secondary w-full justify-start"><FileText size={14} /> Summarize</button>
              <div>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Continue with prompt…" rows={2} className="input mt-2 text-sm" />
                <button onClick={() => runAI('continue')} disabled={aiLoading || !aiPrompt} className="btn-primary w-full mt-1 justify-center">Continue writing</button>
              </div>
              <div className="border-t border-border pt-3 mt-3">
                <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Ask a question…" className="input text-sm" />
                <button onClick={() => runAI('qa')} disabled={aiLoading} className="btn-secondary w-full mt-1 justify-center">Ask AI</button>
              </div>
            </div>
            {aiLoading && <div className="p-4 text-center"><Loader /></div>}
            {aiResult && (
              <div className="p-4 border-t border-border">
                <h4 className="text-xs font-semibold mb-2 text-fg-2">Result</h4>
                <div className="text-sm whitespace-pre-wrap bg-surface p-3 rounded-lg border border-border">{aiResult}</div>
                <button onClick={() => { editor?.commands.insertContent(aiResult); setAiResult(''); toast.success('Inserted'); }} className="btn-primary btn-sm w-full mt-2">Insert into document</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  function debouncedUpdateTitle(title) {
    clearTimeout(timer);
    timer = setTimeout(() => update.mutate({ title }), 600);
  }
}

function extractOutline(json) {
  const outline = [];
  let pos = 0;
  const walk = (node) => {
    if (node.type === 'heading') {
      const text = (node.content || []).map((c) => c.text || '').join('');
      if (text) outline.push({ level: node.attrs?.level || 1, text, pos, id: Math.random() });
    }
    if (node.content) for (const c of node.content) walk(c);
  };
  if (json?.content) for (const n of json.content) walk(n);
  return outline;
}

function Toolbar({ editor, onInsertMermaid, onInsertMath }) {
  const Btn = ({ onClick, active, children, title, disabled }) => (
    <button onClick={onClick} disabled={disabled} className={`btn-icon btn-ghost ${active ? 'bg-surface-3' : ''}`} title={title}>{children}</button>
  );
  return (
    <div className="flex items-center gap-1 sticky top-0 bg-surface py-2 z-10 border-b border-border flex-wrap">
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={14} /></Btn>
      <div className="w-px h-5 bg-border mx-1" />
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)"><Bold size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)"><Italic size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)"><UnderlineIcon size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Type size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight"><Highlighter size={14} /></Btn>
      <div className="w-px h-5 bg-border mx-1" />
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list"><ListChecks size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block"><Code size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().setLink({ href: prompt('URL:') || '' }).run()} active={editor.isActive('link')} title="Link"><LinkIcon size={14} /></Btn>
      <div className="w-px h-5 bg-border mx-1" />
      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left"><AlignLeft size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center"><AlignCenter size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right"><AlignRight size={14} /></Btn>
      <div className="w-px h-5 bg-border mx-1" />
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon size={14} /></Btn>
      <Btn onClick={() => editor.chain().focus().insertContent(`<pre class="callout">💡 ${prompt('Callout text:') || 'Note'}</pre>`).run()} title="Callout"><AlertCircle size={14} /></Btn>
      <Btn onClick={onInsertMermaid} title="Mermaid diagram"><ChevronRight size={14} /></Btn>
      <Btn onClick={onInsertMath} title="Math formula">∑</Btn>
    </div>
  );
}

function CommentBox({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(text); setText(''); }} className="flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="input flex-1" />
      <button type="submit" className="btn-primary btn-sm">Comment</button>
    </form>
  );
}
