'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';

type Props = {
  content: string;
  onChange: (html: string) => void;
  /** default: full toolbar card · notes: minimal text toolbar · apple: Apple Notes style (checklists). */
  variant?: 'default' | 'notes' | 'apple';
};

function ToolbarBtn({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-heading ${
        active ? 'bg-[#141413] text-white' : 'bg-[#FAF9F5] text-[#141413] border border-[#E8E6DC]'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarBtnApple({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[36px] px-2.5 py-2 rounded-lg text-[15px] font-semibold transition-colors duration-150 ${
        active ? 'bg-[#e5e5ea] text-[#007aff]' : 'text-[#007aff] hover:bg-[#e5e5ea]/90'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarMinimal({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1.5 text-[13px] font-heading font-medium rounded-md transition-colors duration-200 ${
        active
          ? 'text-[#141413] underline decoration-[#D97757] decoration-2 underline-offset-[6px]'
          : 'text-[#B0AEA5] hover:text-[#141413]'
      }`}
    >
      {children}
    </button>
  );
}

export default function TiptapNoteEditor({ content, onChange, variant = 'default' }: Props) {
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'task-list-root' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'task-item-row' },
      }),
      Placeholder.configure({
        placeholder:
          variant === 'apple' ? 'Type a note or tap Checklist…' : variant === 'notes' ? 'Start writing…' : 'Start writing...',
      }),
    ],
    content: content || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          variant === 'apple'
            ? 'apple-notes-editor prose prose-sm max-w-none min-h-[48vh] md:min-h-[52vh] px-0 py-1 focus:outline-none text-[#1c1c1e] text-[17px] leading-[1.47] font-[system-ui,-apple-system,BlinkMacSystemFont,"Segoe_UI",Roboto,sans-serif] [&_ul:not([data-type=taskList])]:list-disc [&_ol]:list-decimal [&_ul:not([data-type=taskList])_li]:pl-1 [&_ul:not([data-type=taskList])_li]:ml-4'
            : variant === 'notes'
              ? 'focusflow-notes-editor prose prose-sm max-w-none min-h-[45vh] md:min-h-[50vh] px-0 py-2 focus:outline-none text-[#141413] text-[15px] md:text-[17px] leading-[1.65] font-body [&_ul:not([data-type=taskList])]:list-disc [&_ol]:list-decimal [&_ul:not([data-type=taskList])_li]:pl-1 [&_ul:not([data-type=taskList])_li]:ml-4'
              : 'prose prose-sm max-w-none min-h-[240px] px-1 py-2 focus:outline-none text-[#141413] font-body [&_ul:not([data-type=taskList])]:list-disc [&_ol]:list-decimal [&_ul:not([data-type=taskList])_li]:ml-4',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!editor || !mounted) {
    return (
      <div
        className={`rounded-md bg-[#FAF9F5]/50 ${
          variant === 'apple'
            ? 'min-h-[48vh] md:min-h-[52vh] bg-[#f2f2f7]'
            : variant === 'notes'
              ? 'min-h-[45vh] md:min-h-[50vh]'
              : 'min-h-[240px] rounded-lg border border-[#E8E6DC]'
        }`}
      />
    );
  }

  const chain = () => editor.chain().focus();

  if (variant === 'apple') {
    return (
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-0.5 pb-3 mb-1 border-b border-[#d1d1d6]/80">
          <ToolbarBtnApple onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')}>
            B
          </ToolbarBtnApple>
          <ToolbarBtnApple onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')}>
            I
          </ToolbarBtnApple>
          <ToolbarBtnApple onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            •
          </ToolbarBtnApple>
          <ToolbarBtnApple onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            1.
          </ToolbarBtnApple>
          <ToolbarBtnApple onClick={() => chain().toggleTaskList().run()} active={editor.isActive('taskList')}>
            ☑
          </ToolbarBtnApple>
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  }

  if (variant === 'notes') {
    return (
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pb-6 mb-2 border-b border-[#E8E6DC]/60">
          <ToolbarMinimal onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')}>
            Bold
          </ToolbarMinimal>
          <span className="text-[#E8E6DC] select-none px-0.5" aria-hidden>
            ·
          </span>
          <ToolbarMinimal onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')}>
            Italic
          </ToolbarMinimal>
          <span className="text-[#E8E6DC] select-none px-0.5" aria-hidden>
            ·
          </span>
          <ToolbarMinimal onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            Bullets
          </ToolbarMinimal>
          <span className="text-[#E8E6DC] select-none px-0.5" aria-hidden>
            ·
          </span>
          <ToolbarMinimal onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            Numbers
          </ToolbarMinimal>
          <span className="text-[#E8E6DC] select-none px-0.5" aria-hidden>
            ·
          </span>
          <ToolbarMinimal onClick={() => chain().toggleTaskList().run()} active={editor.isActive('taskList')}>
            Checklist
          </ToolbarMinimal>
        </div>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="border border-[#E8E6DC] rounded-xl bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-[#E8E6DC] bg-[#FAF9F5]">
        <ToolbarBtn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')}>
          B
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')}>
          I
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')}>
          • List
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
          1. List
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleTaskList().run()} active={editor.isActive('taskList')}>
          ☑
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
          H1
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
          H2
        </ToolbarBtn>
        <ToolbarBtn onClick={() => chain().toggleCode().run()} active={editor.isActive('code')}>
          Code
        </ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
