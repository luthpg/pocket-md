import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import * as zenn from 'zenn-markdown-html';

// スタイルシートの適用
import 'zenn-content-css/lib/index.css';
import 'github-markdown-css/github-markdown.css';
import 'highlight.js/styles/github-dark.css';

import { 
  Eye, 
  Edit3, 
  Columns, 
  Share2, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
  RotateCcw, 
  RotateCw, 
  Copy, 
  Scissors, 
  CheckSquare, 
  List, 
  ListOrdered, 
  Code, 
  MessageSquare, 
  Image as ImageIcon, 
  Download, 
  Upload, 
  ListFilter, 
  Bold, 
  Italic, 
  Link as LinkIcon, 
  Table as TableIcon, 
  X,
  MousePointer
} from 'lucide-react';

interface MarkdownPreviewProps {
  markdown: string;
  mode: 'github' | 'zenn';
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ markdown, mode }) => {
  const [zennHtml, setZennHtml] = useState<string>('変換中...');

  useEffect(() => {
    if (mode !== 'zenn') return;

    let isMounted = true;
    const parseZennHtml = async () => {
      try {
        const parseFunc = (zenn as any).default || zenn;
        const html = await parseFunc(markdown);
        if (isMounted) {
          setZennHtml(html);
        }
      } catch (error) {
        if (isMounted) {
          setZennHtml(`<div class="text-red-500">パースエラーが発生しました: ${error}</div>`);
        }
      }
    };

    parseZennHtml();

    return () => {
      isMounted = false;
    };
  }, [markdown, mode]);

  // ─── Zenn モード ───
  if (mode === 'zenn') {
    return (
      <div 
        className="znc markdown-body bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-full p-4 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: zennHtml }}
      />
    );
  }

  // ─── GitHub モード ───
  return (
    <div className="github-markdown-body bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-full p-4 overflow-x-auto">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

type ParseMode = 'github' | 'zenn';
type ViewMode = 'edit' | 'preview' | 'split';
type ToolbarTab = 'edit' | 'symbol' | 'struct' | 'zenn' | 'media';

export const App: React.FC = () => {
  const initialDefaultText = 
    '# Pocket-MD\n\nモバイルで快適にマークダウン文章を作成・プレビューできるエディタです。\n\n## 便利な機能\n\n- **自動保存**: 入力した内容は端末に自動保存されます。\n- **上部ツールバー**: エディタ上部に移動し、キーボード追従のチラつきを解消！\n- **手動入力補完**: 括弧の自動閉じや改行時のリスト自動継続対応！\n\n:::message\nこれはZennスタイルのメッセージボックスです！右上のトグルで表示を切り替えられます。\n:::\n\n```ts:index.ts\nconsole.log("Hello Pocket-MD!");\n```';

  const [markdown, setMarkdown] = useState<string>(() => {
    return localStorage.getItem('local_md_draft') || initialDefaultText;
  });

  // Undo / Redo 用の履歴管理
  const [history, setHistory] = useState<string[]>([markdown]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [parseMode, setParseMode] = useState<ParseMode>('github');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [activeTab, setActiveTab] = useState<ToolbarTab>('edit');
  
  // モーダル・パネル状態
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showToc, setShowToc] = useState<boolean>(false);
  
  // 検索・置換
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [isRegex, setIsRegex] = useState<boolean>(false);
  const [isMatchCase, setIsMatchCase] = useState<boolean>(false);
  const [matchCount, setMatchCount] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 自動保存
  useEffect(() => {
    localStorage.setItem('local_md_draft', markdown);
  }, [markdown]);

  // 履歴付きでMarkdownを更新するヘルパー関数
  const updateMarkdown = useCallback((newText: string, recordHistory = true) => {
    setMarkdown(newText);
    if (recordHistory) {
      setHistory(prev => {
        const nextHistory = prev.slice(0, historyIndex + 1);
        if (nextHistory[nextHistory.length - 1] === newText) return prev;
        const updated = [...nextHistory, newText];
        if (updated.length > 50) updated.shift();
        return updated;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
  }, [historyIndex]);

  // ─── ① ショートカットアクション (Undo / Redo / SelectAll / Copy / Cut) ───
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setMarkdown(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setMarkdown(history[newIndex]);
    }
  };

  const handleSelectAll = () => {
    if (!textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(0, markdown.length);
  };

  const handleCopy = async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textToCopy = start !== end ? markdown.substring(start, end) : markdown;
    await navigator.clipboard.writeText(textToCopy);
  };

  const handleCut = async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;
    
    const textToCut = markdown.substring(start, end);
    await navigator.clipboard.writeText(textToCut);
    const newMarkdown = markdown.substring(0, start) + markdown.substring(end);
    updateMarkdown(newMarkdown);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start);
    }, 0);
  };

  // ─── ② 汎用スニペット挿入 (選択範囲囲み & 未選択時の中央カーソル配置) ───
  const insertSnippet = useCallback((prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);

    const content = selectedText || defaultText;
    const replacement = `${prefix}${content}${suffix}`;
    
    const newMarkdown = markdown.substring(0, start) + replacement + markdown.substring(end);
    updateMarkdown(newMarkdown);

    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + content.length);
      } else {
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
    }, 0);
  }, [markdown, updateMarkdown]);

  // ─── ③ コードブロック挿入（ファイル名・言語指定対応） ───
  const handleInsertCodeBlock = () => {
    const lang = prompt('プログラミング言語 (例: ts, py, sh, js)', 'ts') || '';
    const filename = prompt('ファイル名 (任意, Zenn等: 例 index.ts)', '');
    const header = filename ? `${lang}:${filename}` : lang;
    insertSnippet(`\`\`\`${header}\n`, '\n\`\`\`', '// コードを入力');
  };

  // ─── ④ 手動入力補完 & リスト自動継続 ───
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;

    // 1. 括弧・ダブルクォートなどの自動閉じ
    const autoClosePairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '`': '`',
      '"': '"',
      "'": "'",
    };

    if (autoClosePairs[e.key] && selectionStart === selectionEnd) {
      e.preventDefault();
      const closeChar = autoClosePairs[e.key];
      const newText = value.substring(0, selectionStart) + e.key + closeChar + value.substring(selectionEnd);
      updateMarkdown(newText);
      setTimeout(() => {
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
      }, 0);
      return;
    }

    // 2. Enterキーによるリスト・引用の自動継続
    if (e.key === 'Enter') {
      const currentLine = value.substring(0, selectionStart).split('\n').pop() || '';
      
      const todoMatch = currentLine.match(/^(\s*)([-*]\s+\[[ x]\])\s+(.*)/);
      const listMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
      const quoteMatch = currentLine.match(/^(\s*)(>\s*)(.*)/);

      // ToDoリスト継続
      if (todoMatch) {
        const [_, indent, __, content] = todoMatch;
        if (content.trim() === '') {
          e.preventDefault();
          const lineStart = selectionStart - currentLine.length;
          updateMarkdown(value.substring(0, lineStart) + value.substring(selectionStart));
          return;
        }
        e.preventDefault();
        const insertText = `\n${indent}- [ ] `;
        updateMarkdown(value.substring(0, selectionStart) + insertText + value.substring(selectionEnd));
        setTimeout(() => {
          textarea.setSelectionRange(selectionStart + insertText.length, selectionStart + insertText.length);
        }, 0);
        return;
      }

      // 通常リスト継続
      if (listMatch) {
        const [_, indent, mark, content] = listMatch;
        if (content.trim() === '') {
          e.preventDefault();
          const lineStart = selectionStart - currentLine.length;
          updateMarkdown(value.substring(0, lineStart) + value.substring(selectionStart));
          return;
        }
        e.preventDefault();
        let nextMark = mark;
        if (/^\d+\.$/.test(mark)) {
          nextMark = `${parseInt(mark, 10) + 1}.`;
        }
        const insertText = `\n${indent}${nextMark} `;
        updateMarkdown(value.substring(0, selectionStart) + insertText + value.substring(selectionEnd));
        setTimeout(() => {
          textarea.setSelectionRange(selectionStart + insertText.length, selectionStart + insertText.length);
        }, 0);
        return;
      }

      // 引用継続
      if (quoteMatch) {
        const [_, indent, __, content] = quoteMatch;
        if (content.trim() === '') {
          e.preventDefault();
          const lineStart = selectionStart - currentLine.length;
          updateMarkdown(value.substring(0, lineStart) + value.substring(selectionStart));
          return;
        }
        e.preventDefault();
        const insertText = `\n${indent}> `;
        updateMarkdown(value.substring(0, selectionStart) + insertText + value.substring(selectionEnd));
        setTimeout(() => {
          textarea.setSelectionRange(selectionStart + insertText.length, selectionStart + insertText.length);
        }, 0);
        return;
      }
    }
  };

  // カーソル移動
  const moveCursor = (direction: 'left' | 'right') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const currentPos = textarea.selectionStart;
    const newPos = direction === 'left' ? Math.max(0, currentPos - 1) : currentPos + 1;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
  };

  // ─── 検索 & 置換 ───
  const handleSearch = useCallback(() => {
    if (!searchQuery) { setMatchCount(0); return; }
    try {
      const flags = isMatchCase ? 'g' : 'gi';
      const pattern = isRegex ? searchQuery : searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(pattern, flags);
      const matches = markdown.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } catch (e) { setMatchCount(0); }
  }, [searchQuery, isRegex, isMatchCase, markdown]);

  useEffect(() => { handleSearch(); }, [handleSearch]);

  const handleReplace = (all = false) => {
    if (!searchQuery) return;
    try {
      const flags = isMatchCase ? '' : 'i';
      const globalFlags = isMatchCase ? 'g' : 'gi';
      const pattern = isRegex ? searchQuery : searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (all) {
        const regex = new RegExp(pattern, globalFlags);
        updateMarkdown(markdown.replace(regex, replaceQuery));
      } else {
        const regex = new RegExp(pattern, flags);
        updateMarkdown(markdown.replace(regex, replaceQuery));
      }
    } catch (e) { console.error(e); }
  };

  // ─── 目次 (ToC) 生成 ───
  const tocItems = useMemo(() => {
    const lines = markdown.split('\n');
    return lines.map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        return { level: match[1].length, title: match[2], lineNumber: index };
      }
      return null;
    }).filter(Boolean) as { level: number; title: string; lineNumber: number }[];
  }, [markdown]);

  const jumpToLine = (lineNumber: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lines = markdown.split('\n');
    let pos = 0;
    for (let i = 0; i < lineNumber; i++) {
      pos += lines[i].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
    setShowToc(false);
  };

  // ─── ファイル保存 & 読み込み ───
  const handleExport = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocket-md-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) updateMarkdown(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const altText = prompt('画像の代替テキスト (Alt)', '画像') || '画像';
        insertSnippet(`![${altText}](`, `${dataUrl})`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Markdown Draft', text: markdown }); }
      catch (error) { console.log('Share failed', error); }
    } else {
      await handleCopy();
      alert('クリップボードにコピーしました');
    }
  };

  const charCount = markdown.length;
  const readingTime = useMemo(() => Math.ceil(charCount / 400), [charCount]);

  return (
    <div className="flex flex-col h-dvh w-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden select-none">
      
      {/* ─── ヘッダー ─── */}
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-10 shadow-sm shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-sm tracking-wide">Pocket-MD</span>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2">
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg text-xs font-medium">
            <button onClick={() => setParseMode('github')} className={`px-2 py-1 rounded-md transition ${parseMode === 'github' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}>GH</button>
            <button onClick={() => setParseMode('zenn')} className={`px-2 py-1 rounded-md transition ${parseMode === 'zenn' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-500 dark:text-white' : 'text-slate-500'}`}>Zenn</button>
          </div>
          <button onClick={() => setShowToc(!showToc)} className={`p-2 rounded-lg transition ${showToc ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`} title="目次"><ListFilter className="w-4 h-4" /></button>
          <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-lg transition ${showSearch ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`} title="検索"><Search className="w-4 h-4" /></button>
          <button onClick={handleShare} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition" title="共有"><Share2 className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ─── 検索・置換パネル ─── */}
      {showSearch && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 space-y-2 text-xs shadow-inner shrink-0 z-20">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
              <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent w-full focus:outline-none text-sm" />
              {matchCount > 0 && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded ml-1 font-mono">{matchCount}</span>}
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} /><span>Regex</span></label>
              <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" checked={isMatchCase} onChange={(e) => setIsMatchCase(e.target.checked)} /><span>Aa</span></label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
              <input type="text" placeholder="置換..." value={replaceQuery} onChange={(e) => setReplaceQuery(e.target.value)} className="bg-transparent w-full focus:outline-none text-sm" />
            </div>
            <div className="flex space-x-1 shrink-0">
              <button onClick={() => handleReplace(false)} className="bg-slate-200 dark:bg-slate-600 px-3 py-1.5 rounded font-medium">置換</button>
              <button onClick={() => handleReplace(true)} className="bg-indigo-500 text-white px-3 py-1.5 rounded font-medium">すべて</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 目次 (ToC) ドロワー ─── */}
      {showToc && (
        <div className="absolute top-12 right-0 w-64 max-h-80 bg-white dark:bg-slate-800 border-l border-b border-slate-200 dark:border-slate-700 shadow-xl z-30 p-3 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
            <span className="font-bold text-xs">目次 (ToC)</span>
            <button onClick={() => setShowToc(false)}><X className="w-4 h-4" /></button>
          </div>
          {tocItems.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">見出しがありません</p>
          ) : (
            <div className="space-y-1">
              {tocItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => jumpToLine(item.lineNumber)}
                  className="w-full text-left text-xs truncate py-1 px-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 4}px` }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── エディタ上部：多機能ツールバー ─── */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <div className="bg-slate-100 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 flex flex-col shrink-0 z-10 shadow-xs">
          
          {/* カテゴリ切り替えタブ */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 text-[11px] font-medium bg-slate-200/50 dark:bg-slate-900/50">
            <button onClick={() => setActiveTab('edit')} className={`flex-1 py-1.5 text-center transition ${activeTab === 'edit' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500' : 'text-slate-500'}`}>編集</button>
            <button onClick={() => setActiveTab('symbol')} className={`flex-1 py-1.5 text-center transition ${activeTab === 'symbol' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500' : 'text-slate-500'}`}>記号</button>
            <button onClick={() => setActiveTab('struct')} className={`flex-1 py-1.5 text-center transition ${activeTab === 'struct' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500' : 'text-slate-500'}`}>構造</button>
            <button onClick={() => setActiveTab('zenn')} className={`flex-1 py-1.5 text-center transition ${activeTab === 'zenn' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500' : 'text-slate-500'}`}>Zenn</button>
            <button onClick={() => setActiveTab('media')} className={`flex-1 py-1.5 text-center transition ${activeTab === 'media' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500' : 'text-slate-500'}`}>メディア</button>
          </div>

          {/* サブツールバーボタン一覧 */}
          <div className="p-1.5 flex items-center overflow-x-auto whitespace-nowrap space-x-1.5">
            
            {/* 固定: カーソル移動ボタン */}
            <div className="flex space-x-1 pr-1.5 border-r border-slate-300 dark:border-slate-600 shrink-0">
              <button onClick={() => moveCursor('left')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs active:bg-slate-200"><ArrowLeft className="w-3.5 h-3.5" /></button>
              <button onClick={() => moveCursor('right')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs active:bg-slate-200"><ArrowRight className="w-3.5 h-3.5" /></button>
            </div>

            {/* タブ①: 編集アクション */}
            {activeTab === 'edit' && (
              <>
                <button onClick={handleUndo} disabled={historyIndex === 0} className="px-3 py-1.5 bg-white dark:bg-slate-700 disabled:opacity-40 rounded text-xs flex items-center space-x-1 shadow-xs"><RotateCcw className="w-3.5 h-3.5" /><span>Undo</span></button>
                <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="px-3 py-1.5 bg-white dark:bg-slate-700 disabled:opacity-40 rounded text-xs flex items-center space-x-1 shadow-xs"><RotateCw className="w-3.5 h-3.5" /><span>Redo</span></button>
                <button onClick={handleSelectAll} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><MousePointer className="w-3.5 h-3.5" /><span>全選択</span></button>
                <button onClick={handleCopy} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><Copy className="w-3.5 h-3.5" /><span>コピー</span></button>
                <button onClick={handleCut} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><Scissors className="w-3.5 h-3.5" /><span>切り取り</span></button>
              </>
            )}

            {/* タブ②: 記号 */}
            {activeTab === 'symbol' && (
              ['(', ')', '[', ']', '{', '}', '`', '"', "'", ':', '-', '*', '#', '|', '~', '!'].map((sym) => (
                <button key={sym} onClick={() => insertSnippet(sym)} className="px-3.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-mono font-bold shadow-xs active:bg-slate-200 min-w-[32px]">
                  {sym}
                </button>
              ))
            )}

            {/* タブ③: マークダウン構造 */}
            {activeTab === 'struct' && (
              <>
                <button onClick={() => insertSnippet('# ')} className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-bold shadow-xs">H1</button>
                <button onClick={() => insertSnippet('## ')} className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-bold shadow-xs">H2</button>
                <button onClick={() => insertSnippet('### ')} className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-bold shadow-xs">H3</button>
                <button onClick={() => insertSnippet('**', '**')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><Bold className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('*', '*')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><Italic className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('- ')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><List className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('1. ')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><ListOrdered className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('- [ ] ')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><CheckSquare className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('> ')} className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-mono shadow-xs">引用</button>
                <button onClick={handleInsertCodeBlock} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><Code className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('[', '](url)')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><LinkIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => insertSnippet('\n| Header | Header |\n| --- | ---\n| Item | Item |\n')} className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"><TableIcon className="w-3.5 h-3.5" /></button>
              </>
            )}

            {/* タブ④: Zenn記法 */}
            {activeTab === 'zenn' && (
              <>
                <button onClick={() => insertSnippet(':::message\n', '\n:::', 'メッセージ')} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><MessageSquare className="w-3.5 h-3.5 text-blue-500" /><span>Msg</span></button>
                <button onClick={() => insertSnippet(':::message alert\n', '\n:::', '警告メッセージ')} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><MessageSquare className="w-3.5 h-3.5 text-red-500" /><span>Alert</span></button>
                <button onClick={() => insertSnippet('::::details タイトル\n', '\n::::', '詳細コンテンツ')} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs shadow-xs">Details</button>
                <button onClick={() => insertSnippet('$', '$')} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-mono shadow-xs">TeX(数式)</button>
                <button onClick={() => insertSnippet('[^1]', '\n\n[^1]: 注釈テキスト')} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs shadow-xs">脚注</button>
              </>
            )}

            {/* タブ⑤: メディア・ファイル */}
            {activeTab === 'media' && (
              <>
                <button onClick={() => imageInputRef.current?.click()} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><ImageIcon className="w-3.5 h-3.5 text-green-500" /><span>画像挿入</span></button>
                <button onClick={handleExport} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><Download className="w-3.5 h-3.5" /><span>保存 (.md)</span></button>
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"><Upload className="w-3.5 h-3.5" /><span>開く</span></button>
              </>
            )}

          </div>
        </div>
      )}

      {/* ─── メインワークスペース ─── */}
      <main className="flex-1 flex overflow-hidden relative">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`w-full ${viewMode === 'split' ? 'w-1/2 border-r border-slate-200 dark:border-slate-700' : ''} h-full relative flex flex-col`}>
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => updateMarkdown(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="マークダウンで記述..."
              className="w-full flex-1 p-4 bg-transparent resize-none font-mono text-base leading-relaxed focus:outline-none overflow-y-auto"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div ref={previewRef} className={`w-full ${viewMode === 'split' ? 'w-1/2' : ''} h-full overflow-y-auto bg-white dark:bg-slate-900`}>
            <MarkdownPreview markdown={markdown} mode={parseMode} />
          </div>
        )}
      </main>

      {/* 非表示ファイルインプット */}
      <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleImport} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* ─── フッター ─── */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 shrink-0 z-10">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span>文字: <strong className="text-slate-700 dark:text-slate-300">{charCount}</strong></span>
          <span className="border-l border-slate-300 dark:border-slate-600 h-3"></span>
          <span>読了: <strong className="text-slate-700 dark:text-slate-300">約 {readingTime} 分</strong></span>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg shrink-0">
          <button onClick={() => setViewMode('edit')} className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === 'edit' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-xs' : ''}`}><Edit3 className="w-3 h-3" /><span>編</span></button>
          <button onClick={() => setViewMode('preview')} className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === 'preview' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-xs' : ''}`}><Eye className="w-3 h-3" /><span>プレ</span></button>
          <button onClick={() => setViewMode('split')} className={`hidden md:flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === 'split' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-xs' : ''}`}><Columns className="w-3 h-3" /><span>分</span></button>
        </div>
      </footer>

    </div>
  );
};

export default App;
