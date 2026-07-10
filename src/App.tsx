import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as zenn from 'zenn-markdown-html';

// スタイルシートの適用
import 'zenn-content-css/lib/index.css';
import 'github-markdown-css/github-markdown.css';

import { 
  Eye, 
  Edit3, 
  Columns, 
  Share2, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  FileText, 
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

export const App: React.FC = () => {
  const [markdown, setMarkdown] = useState<string>(() => {
    return localStorage.getItem('local_md_draft') || 
      '# Pocket-MD\n\nモバイルで快適にマークダウン文章を作成・プレビューできるエディタです。\n\n## 便利な機能\n\n- **自動保存**: 入力した内容は端末に自動保存されます。\n- **iOS対応**: キーボードの上に特殊記号バーがぴったり張り付きます。\n- **拡大防止**: テキストエリアをタップしても画面が勝手にズームしません。\n- **文字数・読了目安表示**: フッターでリアルタイムに確認できます。\n\n:::message\nこれはZennスタイルのメッセージボックスです！右上のトグルで表示を切り替えてみてください。\n:::';
  });
  const [parseMode, setParseMode] = useState<ParseMode>('github');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [isRegex, setIsRegex] = useState<boolean>(false);
  const [isMatchCase, setIsMatchCase] = useState<boolean>(false);
  const [matchCount, setMatchCount] = useState<number>(0);

  // iOS キーボード追従用
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('local_md_draft', markdown);
  }, [markdown]);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const height = window.innerHeight - vv.height;
      setKeyboardHeight(height > 50 ? height : 0);
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  const charCount = markdown.length;
  // 読了目安時間の計算（1分間に約400文字として算出）
  const readingTime = useMemo(() => {
    return Math.ceil(charCount / 400);
  }, [charCount]);

  const insertCharacter = (char: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    let newText = '';
    let newCursorPos = start + char.length;

    if (start !== end) {
      const selected = text.substring(start, end);
      const pairs: Record<string, string> = { '[': ']', '(': ')', '`': '`', '*': '*' };
      if (pairs[char]) {
        newText = text.substring(0, start) + char + selected + pairs[char] + text.substring(end);
        newCursorPos = end + char.length + pairs[char].length;
      } else {
        newText = text.substring(0, start) + char + text.substring(end);
      }
    } else {
      newText = text.substring(0, start) + char + text.substring(end);
    }
    setMarkdown(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const moveCursor = (direction: 'left' | 'right') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const currentPos = textarea.selectionStart;
    const newPos = direction === 'left' ? Math.max(0, currentPos - 1) : currentPos + 1;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
  };

  const handleSearch = () => {
    if (!searchQuery) { setMatchCount(0); return; }
    try {
      const flags = isMatchCase ? 'g' : 'gi';
      const pattern = isRegex ? searchQuery : searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(pattern, flags);
      const matches = markdown.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } catch (e) { setMatchCount(0); }
  };

  useEffect(() => { handleSearch(); }, [searchQuery, isRegex, isMatchCase, markdown]);

  const handleReplace = (all = false) => {
    if (!searchQuery) return;
    try {
      const flags = isMatchCase ? '' : 'i';
      const globalFlags = isMatchCase ? 'g' : 'gi';
      const pattern = isRegex ? searchQuery : searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (all) {
        const regex = new RegExp(pattern, globalFlags);
        setMarkdown(markdown.replace(regex, replaceQuery));
      } else {
        const regex = new RegExp(pattern, flags);
        setMarkdown(markdown.replace(regex, replaceQuery));
      }
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Markdown Draft', text: markdown }); }
      catch (error) { console.log('Share failed', error); }
    } else {
      navigator.clipboard.writeText(markdown);
      alert('コピーしました');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden select-none">
      
      {/* ─── ヘッダー ─── */}
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-10 shadow-sm shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-sm tracking-wide">Pocket-MD</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg text-xs font-medium">
            <button onClick={() => setParseMode('github')} className={`px-2 py-1 rounded-md transition ${parseMode === 'github' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}>GH</button>
            <button onClick={() => setParseMode('zenn')} className={`px-2 py-1 rounded-md transition ${parseMode === 'zenn' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-500 dark:text-white' : 'text-slate-500'}`}>Zenn</button>
          </div>
          <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-lg transition ${showSearch ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Search className="w-4 h-4" /></button>
          <button onClick={handleShare} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"><Share2 className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ─── 検索パネル ─── */}
      {showSearch && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 space-y-2 text-xs shadow-inner shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
              <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent w-full focus:outline-none text-base" />
              {matchCount > 0 && <span className="text-[10px] bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded ml-1">{matchCount}</span>}
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} /><span>Regex</span></label>
              <label className="flex items-center space-x-1 cursor-pointer"><input type="checkbox" checked={isMatchCase} onChange={(e) => setIsMatchCase(e.target.checked)} /><span>Aa</span></label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
              <input type="text" placeholder="置換..." value={replaceQuery} onChange={(e) => setReplaceQuery(e.target.value)} className="bg-transparent w-full focus:outline-none text-base" />
            </div>
            <div className="flex space-x-1 shrink-0">
              <button onClick={() => handleReplace(false)} className="bg-slate-200 dark:bg-slate-600 px-3 py-1.5 rounded font-medium">置換</button>
              <button onClick={() => handleReplace(true)} className="bg-indigo-500 text-white px-3 py-1.5 rounded font-medium">すべて</button>
            </div>
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
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="マークダウンで記述..."
              className="w-full flex-1 p-4 bg-transparent resize-none font-mono text-base leading-relaxed focus:outline-none overflow-y-auto pb-24"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div ref={previewRef} className={`w-full ${viewMode === 'split' ? 'w-1/2' : ''} h-full overflow-y-auto bg-white dark:bg-slate-900 pb-24`}>
            <MarkdownPreview markdown={markdown} mode={parseMode} />
          </div>
        )}
      </main>

      {/* ─── 補助キーボード & フッター ─── */}
      <div 
        className="fixed left-0 right-0 z-30 transition-all duration-75 ease-out select-none"
        style={{ bottom: `${keyboardHeight}px` }}
      >
        {/* サブキーボード */}
        {viewMode === 'edit' && (
          <div className="bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-300 dark:border-slate-700 p-1 flex items-center overflow-x-auto whitespace-nowrap shadow-lg">
            <div className="flex space-x-1 pr-2 border-r border-slate-300 dark:border-slate-600 shrink-0">
              <button onClick={() => moveCursor('left')} className="p-2.5 bg-white dark:bg-slate-700 rounded shadow-sm active:bg-slate-200"><ArrowLeft className="w-4 h-4" /></button>
              <button onClick={() => moveCursor('right')} className="p-2.5 bg-white dark:bg-slate-700 rounded shadow-sm active:bg-slate-200"><ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-1 items-center space-x-1.5 px-2">
              {['#', '*', '-', '`', '[', ']', '(', ')', '!', ':', ':::message\n\n:::'].map((item) => (
                <button
                  key={item}
                  onClick={() => insertCharacter(item)}
                  className="px-4 py-2 bg-white dark:bg-slate-700 rounded text-sm font-mono font-bold shadow-sm active:bg-slate-200 min-w-[40px] text-center"
                >
                  {item.length > 5 ? 'Msg' : item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* フッター */}
        <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span>文字: <strong className="text-slate-700 dark:text-slate-300">{charCount}</strong></span>
            <span className="border-l border-slate-300 dark:border-slate-600 h-3"></span>
            <span>読了目安: <strong className="text-slate-700 dark:text-slate-300">約 {readingTime} 分</strong></span>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg shrink-0">
            <button onClick={() => setViewMode('edit')} className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === 'edit' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : ''}`}><Edit3 className="w-3 h-3" /><span>編</span></button>
            <button onClick={() => setViewMode('preview')} className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === 'preview' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : ''}`}><Eye className="w-3 h-3" /><span>プレ</span></button>
            <button onClick={() => setViewMode('split')} className={`hidden md:flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === 'split' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : ''}`}><Columns className="w-3 h-3" /><span>分</span></button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
