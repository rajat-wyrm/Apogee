import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { ArrowLeft, Bold, Italic, List, ListOrdered, Quote, Heading2, Code, Undo2, Redo2, Strikethrough } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Separator } from '../components/ui/Separator';
import { FileText } from 'lucide-react';

export default function DocumentEditor() {
  const { id } = useParams();
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your document…' }),
    ],
    content: '<h1>Untitled document</h1><p>This is a beautiful document editor. Start typing to create your masterpiece.</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
    },
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  if (!id) {
    return <EmptyState icon={FileText} title="Document not found" description="Pick a document from the documents list." />;
  }

  const ToolButton = ({ onClick, active, children, label }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] transition-colors ${active ? 'bg-[var(--bg-muted)] text-[var(--fg)]' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Button as={Link} to="/app/documents" variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
        Back to documents
      </Button>

      <Card padding="md">
        <div className="flex flex-wrap items-center gap-1 mb-4 pb-3 border-b border-[var(--border)]">
          <ToolButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label="Bold">
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label="Italic">
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label="Heading">
            <Heading2 className="h-4 w-4" />
          </ToolButton>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <ToolButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label="Bullet list">
            <List className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} label="Quote">
            <Quote className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label="Code block">
            <Code className="h-4 w-4" />
          </ToolButton>
          <div className="flex-1" />
          <ToolButton onClick={() => editor?.chain().focus().undo().run()} label="Undo">
            <Undo2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={() => editor?.chain().focus().redo().run()} label="Redo">
            <Redo2 className="h-4 w-4" />
          </ToolButton>
        </div>
        <EditorContent editor={editor} />
      </Card>
    </motion.div>
  );
}
