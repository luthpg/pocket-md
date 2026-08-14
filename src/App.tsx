import React, {
	useState,
	useRef,
	useEffect,
	useMemo,
	useCallback,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import * as zenn from "zenn-markdown-html";

// remark 関連 (Formatter / Linter)
import { remark } from "remark";
import remarkStringify from "remark-stringify";
import remarkDirective from "remark-directive";
import remarkLint from "remark-lint";
import remarkLintHeadingIncrement from "remark-lint-heading-increment";
import remarkLintNoDuplicateHeadings from "remark-lint-no-duplicate-headings";
import remarkLintNoUndefinedReferences from "remark-lint-no-undefined-references";

// スタイルシートの適用
import "zenn-content-css/lib/index.css";
import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/github-dark.css";

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
	MousePointer,
	Sun,
	Moon,
	AlertTriangle,
	CheckCircle2,
	Wand2,
} from "lucide-react";

import matter from "gray-matter";

// ─── ダークモード補正用カスタムCSS ───
const DarkThemeCustomStyles = () => (
	<style>{`
    .dark .markdown-body {
      color-scheme: dark;
      background-color: transparent !important;
      color: #e2e8f0 !important;
    }
    .dark .markdown-body table tr {
      background-color: #0f172a !important;
      border-top-color: #334155 !important;
    }
    .dark .markdown-body table tr:nth-child(2n) {
      background-color: #1e293b !important;
    }
    .dark .markdown-body table th,
    .dark .markdown-body table td {
      border-color: #334155 !important;
      color: #e2e8f0 !important;
    }
    .dark .markdown-body code:not(pre code) {
      background-color: #334155 !important;
      color: #f8fafc !important;
    }
    .dark .markdown-body a {
      color: #818cf8 !important;
    }
    .dark .markdown-body hr {
      background-color: #334155 !important;
    }
    .dark .markdown-body blockquote {
      color: #94a3b8 !important;
      border-left-color: #475569 !important;
    }

    .dark .znc {
      background-color: transparent !important;
      color: #e2e8f0 !important;
    }
    .dark .znc a {
      color: #60a5fa !important;
    }
    .dark .znc table {
      color: #e2e8f0 !important;
    }
    .dark .znc th, .dark .znc td {
      border-color: #334155 !important;
      color: #e2e8f0 !important;
      background-color: transparent !important;
    }
    .dark .znc tr:nth-child(2n) {
      background-color: #1e293b !important;
    }
    .dark .znc .footnotes,
    .dark .znc .footnotes-list,
    .dark .znc .footnote-item,
    .dark .znc .footnote-ref {
      color: #94a3b8 !important;
      border-top-color: #334155 !important;
    }
    .dark .znc .footnote-ref a {
      color: #818cf8 !important;
    }
    .dark .znc code:not([class*="language-"]) {
      background-color: #1e293b !important;
      color: #f1f5f9 !important;
      border-color: #334155 !important;
    }
    .dark .znc hr {
      border-color: #334155 !important;
    }
    .dark .znc blockquote {
      color: #94a3b8 !important;
      border-left-color: #475569 !important;
    }
    .dark .znc .msg {
      background-color: #1e293b !important;
      color: #e2e8f0 !important;
      border-color: #334155 !important;
    }
    .dark .znc .details {
      background-color: #1e293b !important;
      border-color: #334155 !important;
      color: #e2e8f0 !important;
    }
    .dark .znc .details summary {
      color: #e2e8f0 !important;
    }
  `}</style>
);

// 日本語（CJK）文字か判定する正規表現
const isCJK = (str: string) =>
	/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(
		str,
	);

// 強調やインラインコードの前後が日本語の場合、自動で半角スペースを補完するプラグイン
const remarkSpacingForCJK = () => {
	return (tree: any) => {
		const walk = (node: any) => {
			if (!node.children || !Array.isArray(node.children)) return;

			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];

				// 対象要素: 強調(strong), 斜体(emphasis), インラインコード(inlineCode)
				if (
					child.type === "strong" ||
					child.type === "emphasis" ||
					child.type === "inlineCode"
				) {
					// 直前のテキストノードをチェック
					const prev = node.children[i - 1];
					if (prev && prev.type === "text" && prev.value) {
						const lastChar = prev.value.slice(-1);
						// 末尾が日本語かつスペースがない場合、末尾に半角スペースを追加
						if (isCJK(lastChar) && !/\s$/.test(prev.value)) {
							prev.value += " ";
						}
					}

					// 直後のテキストノードをチェック
					const next = node.children[i + 1];
					if (next && next.type === "text" && next.value) {
						const firstChar = next.value[0];
						// 先頭が日本語かつスペースがない場合、先頭に半角スペースを追加
						if (isCJK(firstChar) && !/^\s/.test(next.value)) {
							next.value = " " + next.value;
						}
					}
				}

				// 子要素も再帰的にチェック
				walk(child);
			}
		};

		walk(tree);
	};
};

interface MarkdownPreviewProps {
	markdown: string;
	mode: "github" | "zenn";
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
	markdown,
	mode,
}) => {
	const [zennHtml, setZennHtml] = useState<string>("変換中...");

	// 1. Frontmatterと本文の抽出（useMemoで最適化）
	const {
		data: frontmatter,
		content,
	}: { data: Record<string, any>; content: string } = useMemo(() => {
		try {
			return matter(markdown);
		} catch {
			// パース失敗時のフォールバック処理
			return { data: {}, content: markdown };
		}
	}, [markdown]);

	useEffect(() => {
		if (mode !== "zenn") return;
		let isMounted = true;

		const parseZennHtml = async () => {
			try {
				const parseFunc = (zenn as any).default || zenn;
				// 分離後の本文(content)のみをパーサーに入力
				const html = await parseFunc(content);

				if (isMounted) {
					setZennHtml(html);
				}
			} catch (error) {
				if (isMounted) {
					setZennHtml(
						`<div class="text-red-500">パースエラーが発生しました: ${error}</div>`,
					);
				}
			}
		};
		parseZennHtml();

		return () => {
			isMounted = false;
		};
	}, [content, mode]);

	if (mode === "zenn") {
		const hasFrontmatter = Object.keys(frontmatter).length > 0;

		return (
			<div className="znc min-h-full p-4 overflow-x-auto text-slate-800 dark:text-slate-100">
				{/* Frontmatterが存在する場合、Zennスタイルの記事ヘッダーを表示 */}
				{hasFrontmatter && (
					<div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
						{frontmatter.emoji && (
							<div className="text-4xl mb-4 text-center">
								{frontmatter.emoji}
							</div>
						)}
						<h1 className="text-2xl font-bold mb-4 text-center">
							{frontmatter.title || "無題の記事"}
						</h1>
						<div className="flex justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
							{frontmatter.type && (
								<span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">
									{frontmatter.type}
								</span>
							)}
							{Array.isArray(frontmatter.topics) &&
								frontmatter.topics.map((topic: string) => (
									<span
										key={topic}
										className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md"
									>
										# {topic}
									</span>
								))}
						</div>
					</div>
				)}

				<div dangerouslySetInnerHTML={{ __html: zennHtml }} />
			</div>
		);
	}

	return (
		<div className="markdown-body min-h-full p-4 overflow-x-auto text-slate-800 dark:text-slate-100">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeHighlight]}
				components={{
					a: ({ ...props }) => (
						<a target="_blank" rel="noopener noreferrer" {...props} />
					),
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
};

type ParseMode = "github" | "zenn";
type ViewMode = "edit" | "preview" | "split";
type ToolbarTab = "edit" | "symbol" | "struct" | "zenn" | "media";

interface LintMessage {
	line: number;
	column: number;
	reason: string;
	ruleId?: string;
}

export const App: React.FC = () => {
	const initialDefaultText =
		"# Pocket-MD\n\nモバイルで快適にマークダウン文章を作成・プレビューできるエディタです。\n\n### 見出しのスキップ（Lint警告のテスト）\n\n- **自動保存**: 入力した内容は端末に自動保存されます。\n- **リアルタイムLint**: 構造の崩れや見出しの飛びを自動検知！[^1]\n- **フォーマッター**: 整形ボタンで表記揺れをクリア。\n\n:::message\nこれはZennスタイルのメッセージボックスです！\n:::\n\n[^1]: 脚注のテストメッセージです。\n";

	const [markdown, setMarkdown] = useState<string>(() => {
		return localStorage.getItem("local_md_draft") || initialDefaultText;
	});

	const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
		const saved = localStorage.getItem("theme_mode");
		if (saved !== null) return saved === "dark";
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	const [history, setHistory] = useState<string[]>([markdown]);
	const [historyIndex, setHistoryIndex] = useState<number>(0);

	const [parseMode, setParseMode] = useState<ParseMode>("github");
	const [viewMode, setViewMode] = useState<ViewMode>("edit");
	const [activeTab, setActiveTab] = useState<ToolbarTab>("edit");

	// モーダル・パネル状態
	const [showSearch, setShowSearch] = useState<boolean>(false);
	const [showToc, setShowToc] = useState<boolean>(false);
	const [showLintPanel, setShowLintPanel] = useState<boolean>(false);

	// Lint 状態
	const [diagnostics, setDiagnostics] = useState<LintMessage[]>([]);
	const [isFormatting, setIsFormatting] = useState<boolean>(false);

	// 検索・置換
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [replaceQuery, setReplaceQuery] = useState<string>("");
	const [isRegex, setIsRegex] = useState<boolean>(false);
	const [isMatchCase, setIsMatchCase] = useState<boolean>(false);
	const [matchCount, setMatchCount] = useState<number>(0);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const previewRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);

	// ─── Linter & Formatter コアプロセッサ ───
	const runLintAndFormat = useCallback(
		async (text: string, executeFormat = false) => {
			try {
				const processor = remark()
					.use(remarkGfm)
					.use(remarkDirective)
					.use(remarkLint)
					.use(remarkLintHeadingIncrement)
					.use(remarkLintNoDuplicateHeadings)
					.use(remarkLintNoUndefinedReferences)
					.use(remarkSpacingForCJK)
					.use(remarkStringify, {
						bullet: "-",
						fence: "`",
						incrementListMarker: true,
					});

				const file = await processor.process(text);

				const messages: LintMessage[] = file.messages.map((msg: any) => ({
					line: msg.line || 1,
					column: msg.column || 1,
					reason: msg.reason,
					ruleId: msg.ruleId,
				}));

				setDiagnostics(messages);

				if (executeFormat) {
					return String(file);
				}
			} catch (err) {
				console.error("Lint/Format Process Error:", err);
			}
			return text;
		},
		[],
	);

	// 400ms デバウンス付き リアルタイム Lint チェック
	useEffect(() => {
		const timer = setTimeout(() => {
			runLintAndFormat(markdown, false);
		}, 400);

		return () => clearTimeout(timer);
	}, [markdown, runLintAndFormat]);

	// フォーマット実行ハンドラ
	const handleFormat = async () => {
		setIsFormatting(true);
		const formatted = await runLintAndFormat(markdown, true);
		if (formatted && formatted !== markdown) {
			updateMarkdown(formatted);
		}
		setIsFormatting(false);
	};

	useEffect(() => {
		localStorage.setItem("theme_mode", isDarkMode ? "dark" : "light");
	}, [isDarkMode]);

	useEffect(() => {
		localStorage.setItem("local_md_draft", markdown);
	}, [markdown]);

	const updateMarkdown = useCallback(
		(newText: string, recordHistory = true) => {
			setMarkdown(newText);
			if (recordHistory) {
				setHistory((prev) => {
					const nextHistory = prev.slice(0, historyIndex + 1);
					if (nextHistory[nextHistory.length - 1] === newText) return prev;
					const updated = [...nextHistory, newText];
					if (updated.length > 50) updated.shift();
					return updated;
				});
				setHistoryIndex((prev) => Math.min(prev + 1, 49));
			}
		},
		[historyIndex],
	);

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
		const textToCopy =
			start !== end ? markdown.substring(start, end) : markdown;
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

	const insertSnippet = useCallback(
		(prefix: string, suffix: string = "", defaultText: string = "") => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const selectedText = markdown.substring(start, end);

			const content = selectedText || defaultText;
			const replacement = `${prefix}${content}${suffix}`;

			const newMarkdown =
				markdown.substring(0, start) + replacement + markdown.substring(end);
			updateMarkdown(newMarkdown);

			setTimeout(() => {
				textarea.focus();
				if (selectedText) {
					textarea.setSelectionRange(
						start + prefix.length,
						start + prefix.length + content.length,
					);
				} else {
					const cursorPos = start + prefix.length;
					textarea.setSelectionRange(cursorPos, cursorPos);
				}
			}, 0);
		},
		[markdown, updateMarkdown],
	);

	const handleInsertCodeBlock = () => {
		const lang = prompt("プログラミング言語 (例: ts, py, sh, js)", "ts") || "";
		const filename = prompt("ファイル名 (任意, Zenn等: 例 index.ts)", "");
		const header = filename ? `${lang}:${filename}` : lang;
		insertSnippet(`\`\`\`${header}\n`, "\n`\``", "// コードを入力");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		const { selectionStart, selectionEnd, value } = textarea;

		const autoClosePairs: Record<string, string> = {
			"(": ")",
			"[": "]",
			"{": "}",
			"`": "`",
			'"': '"',
			"'": "'",
		};

		if (autoClosePairs[e.key] && selectionStart === selectionEnd) {
			e.preventDefault();
			const closeChar = autoClosePairs[e.key];
			const newText =
				value.substring(0, selectionStart) +
				e.key +
				closeChar +
				value.substring(selectionEnd);
			updateMarkdown(newText);
			setTimeout(() => {
				textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
			}, 0);
			return;
		}

		if (e.key === "Enter") {
			const currentLine =
				value.substring(0, selectionStart).split("\n").pop() || "";

			const todoMatch = currentLine.match(/^(\s*)([-*]\s+\[[ x]\])\s+(.*)/);
			const listMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
			const quoteMatch = currentLine.match(/^(\s*)(>\s*)(.*)/);

			if (todoMatch) {
				const [_, indent, __, content] = todoMatch;
				if (content.trim() === "") {
					e.preventDefault();
					const lineStart = selectionStart - currentLine.length;
					updateMarkdown(
						value.substring(0, lineStart) + value.substring(selectionStart),
					);
					return;
				}
				e.preventDefault();
				const insertText = `\n${indent}- [ ] `;
				updateMarkdown(
					value.substring(0, selectionStart) +
						insertText +
						value.substring(selectionEnd),
				);
				setTimeout(() => {
					textarea.setSelectionRange(
						selectionStart + insertText.length,
						selectionStart + insertText.length,
					);
				}, 0);
				return;
			}

			if (listMatch) {
				const [_, indent, mark, content] = listMatch;
				if (content.trim() === "") {
					e.preventDefault();
					const lineStart = selectionStart - currentLine.length;
					updateMarkdown(
						value.substring(0, lineStart) + value.substring(selectionStart),
					);
					return;
				}
				e.preventDefault();
				let nextMark = mark;
				if (/^\d+\.$/.test(mark)) {
					nextMark = `${parseInt(mark, 10) + 1}.`;
				}
				const insertText = `\n${indent}${nextMark} `;
				updateMarkdown(
					value.substring(0, selectionStart) +
						insertText +
						value.substring(selectionEnd),
				);
				setTimeout(() => {
					textarea.setSelectionRange(
						selectionStart + insertText.length,
						selectionStart + insertText.length,
					);
				}, 0);
				return;
			}

			if (quoteMatch) {
				const [_, indent, __, content] = quoteMatch;
				if (content.trim() === "") {
					e.preventDefault();
					const lineStart = selectionStart - currentLine.length;
					updateMarkdown(
						value.substring(0, lineStart) + value.substring(selectionStart),
					);
					return;
				}
				e.preventDefault();
				const insertText = `\n${indent}> `;
				updateMarkdown(
					value.substring(0, selectionStart) +
						insertText +
						value.substring(selectionEnd),
				);
				setTimeout(() => {
					textarea.setSelectionRange(
						selectionStart + insertText.length,
						selectionStart + insertText.length,
					);
				}, 0);
				return;
			}
		}
	};

	const moveCursor = (direction: "left" | "right") => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const currentPos = textarea.selectionStart;
		const newPos =
			direction === "left" ? Math.max(0, currentPos - 1) : currentPos + 1;
		textarea.focus();
		textarea.setSelectionRange(newPos, newPos);
	};

	const jumpToLine = (lineNumber: number) => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const lines = markdown.split("\n");
		let pos = 0;
		for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
			pos += lines[i].length + 1;
		}
		textarea.focus();
		textarea.setSelectionRange(pos, pos);
		setShowToc(false);
		setShowLintPanel(false);
	};

	const handleSearch = useCallback(() => {
		if (!searchQuery) {
			setMatchCount(0);
			return;
		}
		try {
			const flags = isMatchCase ? "g" : "gi";
			const pattern = isRegex
				? searchQuery
				: searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
			const regex = new RegExp(pattern, flags);
			const matches = markdown.match(regex);
			setMatchCount(matches ? matches.length : 0);
		} catch (e) {
			setMatchCount(0);
		}
	}, [searchQuery, isRegex, isMatchCase, markdown]);

	useEffect(() => {
		handleSearch();
	}, [handleSearch]);

	const handleReplace = (all = false) => {
		if (!searchQuery) return;
		try {
			const flags = isMatchCase ? "" : "i";
			const globalFlags = isMatchCase ? "g" : "gi";
			const pattern = isRegex
				? searchQuery
				: searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
			if (all) {
				const regex = new RegExp(pattern, globalFlags);
				updateMarkdown(markdown.replace(regex, replaceQuery));
			} else {
				const regex = new RegExp(pattern, flags);
				updateMarkdown(markdown.replace(regex, replaceQuery));
			}
		} catch (e) {
			console.error(e);
		}
	};

	const tocItems = useMemo(() => {
		const lines = markdown.split("\n");
		return lines
			.map((line, index) => {
				const match = line.match(/^(#{1,6})\s+(.+)/);
				if (match) {
					return {
						level: match[1].length,
						title: match[2],
						lineNumber: index + 1,
					};
				}
				return null;
			})
			.filter(Boolean) as {
			level: number;
			title: string;
			lineNumber: number;
		}[];
	}, [markdown]);

	const handleExport = () => {
		const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
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
		e.target.value = "";
	};

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			const dataUrl = event.target?.result as string;
			if (dataUrl) {
				const altText = prompt("画像の代替テキスト (Alt)", "画像") || "画像";
				insertSnippet(`![${altText}](`, `${dataUrl})`);
			}
		};
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const handleShare = async () => {
		if (navigator.share) {
			try {
				await navigator.share({ title: "Markdown Draft", text: markdown });
			} catch (error) {
				console.log("Share failed", error);
			}
		} else {
			await handleCopy();
			alert("クリップボードにコピーしました");
		}
	};

	const charCount = markdown.length;
	const readingTime = useMemo(() => Math.ceil(charCount / 400), [charCount]);

	// エディタ領域のスクロール位置復元
	useEffect(() => {
		if ((viewMode === "edit" || viewMode === "split") && textareaRef.current) {
			const savedScroll = sessionStorage.getItem("pocket_md_scroll_edit");
			if (savedScroll) {
				const scrollTop = parseInt(savedScroll, 10);
				requestAnimationFrame(() => {
					if (textareaRef.current) {
						textareaRef.current.scrollTop = scrollTop;
					}
				});
			}
		}
	}, [viewMode]);

	// プレビュー領域のスクロール位置復元
	useEffect(() => {
		if (
			(viewMode === "preview" || viewMode === "split") &&
			previewRef.current
		) {
			const savedScroll = sessionStorage.getItem("pocket_md_scroll_preview");
			if (savedScroll) {
				const scrollTop = parseInt(savedScroll, 10);
				requestAnimationFrame(() => {
					if (previewRef.current) {
						previewRef.current.scrollTop = scrollTop;
					}
				});
			}
		}
	}, [viewMode]);

	// スクロール位置保存イベントハンドラ
	const handleEditScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
		sessionStorage.setItem(
			"pocket_md_scroll_edit",
			e.currentTarget.scrollTop.toString(),
		);
	};

	const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
		sessionStorage.setItem(
			"pocket_md_scroll_preview",
			e.currentTarget.scrollTop.toString(),
		);
	};

	return (
		<div
			className={`flex flex-col h-dvh w-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-hidden select-none ${isDarkMode ? "dark" : ""}`}
		>
			<DarkThemeCustomStyles />

			{/* ─── ヘッダー ─── */}
			<header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-10 shadow-xs shrink-0">
				<div className="flex items-center space-x-2">
					<FileText className="w-5 h-5 text-indigo-500" />
					<span className="font-bold text-sm tracking-wide">Pocket-MD</span>
				</div>

				<div className="flex items-center space-x-1 sm:space-x-2">
					{/* Lint 状態バッジ */}
					<button
						onClick={() => setShowLintPanel(!showLintPanel)}
						className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
							diagnostics.length > 0
								? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
								: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
						}`}
						title="構文チェック診断結果"
					>
						{diagnostics.length > 0 ? (
							<>
								<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
								<span>{diagnostics.length} 警告</span>
							</>
						) : (
							<>
								<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
								<span className="hidden sm:inline">正常</span>
							</>
						)}
					</button>

					<div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg text-xs font-medium">
						<button
							onClick={() => setParseMode("github")}
							className={`px-2 py-1 rounded-md transition ${parseMode === "github" ? "bg-white dark:bg-slate-600 shadow-xs text-indigo-600 dark:text-white" : "text-slate-500"}`}
						>
							GH
						</button>
						<button
							onClick={() => setParseMode("zenn")}
							className={`px-2 py-1 rounded-md transition ${parseMode === "zenn" ? "bg-white dark:bg-slate-600 shadow-xs text-blue-500 dark:text-white" : "text-slate-500"}`}
						>
							Zenn
						</button>
					</div>

					<button
						onClick={() => setIsDarkMode(!isDarkMode)}
						className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
						title={isDarkMode ? "ライトモード" : "ダークモード"}
					>
						{isDarkMode ? (
							<Sun className="w-4 h-4 text-amber-400" />
						) : (
							<Moon className="w-4 h-4 text-slate-600" />
						)}
					</button>

					<button
						onClick={() => setShowToc(!showToc)}
						className={`p-2 rounded-lg transition ${showToc ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}
						title="目次"
					>
						<ListFilter className="w-4 h-4" />
					</button>
					<button
						onClick={() => setShowSearch(!showSearch)}
						className={`p-2 rounded-lg transition ${showSearch ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}
						title="検索"
					>
						<Search className="w-4 h-4" />
					</button>
					<button
						onClick={handleShare}
						className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
						title="共有"
					>
						<Share2 className="w-4 h-4" />
					</button>
				</div>
			</header>

			{/* ─── Lint 診断ドロワー ─── */}
			{showLintPanel && (
				<div className="absolute top-12 right-4 w-72 max-h-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-30 p-3 overflow-y-auto">
					<div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
						<div className="flex items-center space-x-1 font-bold text-xs">
							<AlertTriangle className="w-4 h-4 text-amber-500" />
							<span>Lint 診断結果 ({diagnostics.length})</span>
						</div>
						<button onClick={() => setShowLintPanel(false)}>
							<X className="w-4 h-4" />
						</button>
					</div>
					{diagnostics.length === 0 ? (
						<p className="text-xs text-slate-400 py-2 text-center">
							エラーや警告はありません
						</p>
					) : (
						<div className="space-y-1.5">
							{diagnostics.map((msg, idx) => (
								<button
									key={idx}
									onClick={() => jumpToLine(msg.line)}
									className="w-full text-left text-xs p-2 rounded bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition border border-amber-200/50 dark:border-amber-700/50"
								>
									<div className="font-mono text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
										L{msg.line}:C{msg.column}
									</div>
									<div className="text-slate-700 dark:text-slate-200 mt-0.5">
										{msg.reason}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			)}

			{/* ─── 検索・置換パネル ─── */}
			{showSearch && (
				<div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 space-y-2 text-xs shadow-inner shrink-0 z-20">
					<div className="flex flex-wrap items-center gap-2">
						<div className="flex items-center flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
							<input
								type="text"
								placeholder="検索..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="bg-transparent w-full focus:outline-none text-sm"
							/>
							{matchCount > 0 && (
								<span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded ml-1 font-mono">
									{matchCount}
								</span>
							)}
						</div>
						<div className="flex items-center space-x-2 shrink-0">
							<label className="flex items-center space-x-1 cursor-pointer">
								<input
									type="checkbox"
									checked={isRegex}
									onChange={(e) => setIsRegex(e.target.checked)}
								/>
								<span>Regex</span>
							</label>
							<label className="flex items-center space-x-1 cursor-pointer">
								<input
									type="checkbox"
									checked={isMatchCase}
									onChange={(e) => setIsMatchCase(e.target.checked)}
								/>
								<span>Aa</span>
							</label>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<div className="flex items-center flex-1 min-w-[150px] bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5">
							<input
								type="text"
								placeholder="置換..."
								value={replaceQuery}
								onChange={(e) => setReplaceQuery(e.target.value)}
								className="bg-transparent w-full focus:outline-none text-sm"
							/>
						</div>
						<div className="flex space-x-1 shrink-0">
							<button
								onClick={() => handleReplace(false)}
								className="bg-slate-200 dark:bg-slate-600 px-3 py-1.5 rounded font-medium"
							>
								置換
							</button>
							<button
								onClick={() => handleReplace(true)}
								className="bg-indigo-500 text-white px-3 py-1.5 rounded font-medium"
							>
								すべて
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ─── 目次 (ToC) ドロワー ─── */}
			{showToc && (
				<div className="absolute top-12 right-0 w-64 max-h-80 bg-white dark:bg-slate-800 border-l border-b border-slate-200 dark:border-slate-700 shadow-xl z-30 p-3 overflow-y-auto">
					<div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
						<span className="font-bold text-xs">目次 (ToC)</span>
						<button onClick={() => setShowToc(false)}>
							<X className="w-4 h-4" />
						</button>
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
			{(viewMode === "edit" || viewMode === "split") && (
				<div className="bg-slate-100 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 flex flex-col shrink-0 z-10 shadow-xs">
					<div className="flex border-b border-slate-200 dark:border-slate-700 text-[11px] font-medium bg-slate-200/50 dark:bg-slate-900/50">
						<button
							onClick={() => setActiveTab("edit")}
							className={`flex-1 py-1.5 text-center transition ${activeTab === "edit" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500" : "text-slate-500"}`}
						>
							編集
						</button>
						<button
							onClick={() => setActiveTab("symbol")}
							className={`flex-1 py-1.5 text-center transition ${activeTab === "symbol" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500" : "text-slate-500"}`}
						>
							記号
						</button>
						<button
							onClick={() => setActiveTab("struct")}
							className={`flex-1 py-1.5 text-center transition ${activeTab === "struct" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500" : "text-slate-500"}`}
						>
							構造
						</button>
						<button
							onClick={() => setActiveTab("zenn")}
							className={`flex-1 py-1.5 text-center transition ${activeTab === "zenn" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500" : "text-slate-500"}`}
						>
							Zenn
						</button>
						<button
							onClick={() => setActiveTab("media")}
							className={`flex-1 py-1.5 text-center transition ${activeTab === "media" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-500" : "text-slate-500"}`}
						>
							メディア
						</button>
					</div>

					<div className="p-1.5 flex items-center overflow-x-auto whitespace-nowrap space-x-1.5">
						<div className="flex space-x-1 pr-1.5 border-r border-slate-300 dark:border-slate-600 shrink-0">
							<button
								onClick={() => moveCursor("left")}
								className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs active:bg-slate-200"
							>
								<ArrowLeft className="w-3.5 h-3.5" />
							</button>
							<button
								onClick={() => moveCursor("right")}
								className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs active:bg-slate-200"
							>
								<ArrowRight className="w-3.5 h-3.5" />
							</button>
						</div>

						{/* タブ①: 編集アクション */}
						{activeTab === "edit" && (
							<>
								<button
									onClick={handleFormat}
									disabled={isFormatting}
									className="px-3 py-1.5 bg-indigo-500 text-white rounded text-xs flex items-center space-x-1 shadow-xs font-semibold active:bg-indigo-600"
								>
									<Wand2 className="w-3.5 h-3.5" />
									<span>{isFormatting ? "整形中..." : "自動整形"}</span>
								</button>
								<button
									onClick={handleUndo}
									disabled={historyIndex === 0}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 disabled:opacity-40 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<RotateCcw className="w-3.5 h-3.5" />
									<span>Undo</span>
								</button>
								<button
									onClick={handleRedo}
									disabled={historyIndex === history.length - 1}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 disabled:opacity-40 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<RotateCw className="w-3.5 h-3.5" />
									<span>Redo</span>
								</button>
								<button
									onClick={handleSelectAll}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<MousePointer className="w-3.5 h-3.5" />
									<span>全選択</span>
								</button>
								<button
									onClick={handleCopy}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<Copy className="w-3.5 h-3.5" />
									<span>コピー</span>
								</button>
								<button
									onClick={handleCut}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<Scissors className="w-3.5 h-3.5" />
									<span>切り取り</span>
								</button>
							</>
						)}

						{/* タブ②: 記号 */}
						{activeTab === "symbol" &&
							[
								"(",
								")",
								"[",
								"]",
								"{",
								"}",
								"`",
								'"',
								"'",
								":",
								"-",
								"*",
								"#",
								"|",
								"~",
								"!",
							].map((sym) => (
								<button
									key={sym}
									onClick={() => insertSnippet(sym)}
									className="px-3.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-mono font-bold shadow-xs active:bg-slate-200 min-w-[32px]"
								>
									{sym}
								</button>
							))}

						{/* タブ③: マークダウン構造 */}
						{activeTab === "struct" && (
							<>
								<button
									onClick={() => insertSnippet("# ")}
									className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-bold shadow-xs"
								>
									H1
								</button>
								<button
									onClick={() => insertSnippet("## ")}
									className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-bold shadow-xs"
								>
									H2
								</button>
								<button
									onClick={() => insertSnippet("### ")}
									className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-bold shadow-xs"
								>
									H3
								</button>
								<button
									onClick={() => insertSnippet("**", "**")}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<Bold className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => insertSnippet("*", "*")}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<Italic className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => insertSnippet("- ")}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<List className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => insertSnippet("1. ")}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<ListOrdered className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => insertSnippet("- [ ] ")}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<CheckSquare className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => insertSnippet("> ")}
									className="px-2.5 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-mono shadow-xs"
								>
									引用
								</button>
								<button
									onClick={handleInsertCodeBlock}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<Code className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => insertSnippet("[", "](url)")}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<LinkIcon className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() =>
										insertSnippet(
											"\n| Header | Header |\n| --- | ---\n| Item | Item |\n",
										)
									}
									className="p-2 bg-white dark:bg-slate-700 rounded shadow-xs"
								>
									<TableIcon className="w-3.5 h-3.5" />
								</button>
							</>
						)}

						{/* タブ④: Zenn記法 */}
						{activeTab === "zenn" && (
							<>
								<button
									onClick={() =>
										insertSnippet(":::message\n", "\n:::", "メッセージ")
									}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<MessageSquare className="w-3.5 h-3.5 text-blue-500" />
									<span>Msg</span>
								</button>
								<button
									onClick={() =>
										insertSnippet(
											":::message alert\n",
											"\n:::",
											"警告メッセージ",
										)
									}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<MessageSquare className="w-3.5 h-3.5 text-red-500" />
									<span>Alert</span>
								</button>
								<button
									onClick={() =>
										insertSnippet(
											"::::details タイトル\n",
											"\n::::",
											"詳細コンテンツ",
										)
									}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs shadow-xs"
								>
									Details
								</button>
								<button
									onClick={() => insertSnippet("$", "$")}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs font-mono shadow-xs"
								>
									TeX(数式)
								</button>
								<button
									onClick={() =>
										insertSnippet("[^1]", "\n\n[^1]: 注釈テキスト")
									}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs shadow-xs"
								>
									脚注
								</button>
							</>
						)}

						{/* タブ⑤: メディア・ファイル */}
						{activeTab === "media" && (
							<>
								<button
									onClick={() => imageInputRef.current?.click()}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<ImageIcon className="w-3.5 h-3.5 text-green-500" />
									<span>画像挿入</span>
								</button>
								<button
									onClick={handleExport}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<Download className="w-3.5 h-3.5" />
									<span>保存 (.md)</span>
								</button>
								<button
									onClick={() => fileInputRef.current?.click()}
									className="px-3 py-1.5 bg-white dark:bg-slate-700 rounded text-xs flex items-center space-x-1 shadow-xs"
								>
									<Upload className="w-3.5 h-3.5" />
									<span>開く</span>
								</button>
							</>
						)}
					</div>
				</div>
			)}

			{/* ─── メインワークスペース ─── */}
			<main className="flex-1 flex overflow-hidden relative">
				{(viewMode === "edit" || viewMode === "split") && (
					<div
						className={`w-full ${viewMode === "split" ? "w-1/2 border-r border-slate-200 dark:border-slate-700" : ""} h-full relative flex flex-col`}
					>
						<textarea
							ref={textareaRef}
							value={markdown}
							onChange={(e) => updateMarkdown(e.target.value)}
							onKeyDown={handleKeyDown}
							onScroll={handleEditScroll}
							placeholder="マークダウンで記述..."
							className="w-full flex-1 p-4 bg-transparent resize-none font-mono text-base leading-relaxed focus:outline-none overflow-y-auto"
						/>
					</div>
				)}
				{(viewMode === "preview" || viewMode === "split") && (
					<div
						ref={previewRef}
						onScroll={handlePreviewScroll}
						className={`w-full ${viewMode === "split" ? "w-1/2" : ""} h-full overflow-y-auto bg-white dark:bg-slate-900`}
					>
						<MarkdownPreview markdown={markdown} mode={parseMode} />
					</div>
				)}
			</main>

			<input
				ref={fileInputRef}
				type="file"
				accept=".md,.txt"
				onChange={handleImport}
				className="hidden"
			/>
			<input
				ref={imageInputRef}
				type="file"
				accept="image/*"
				onChange={handleImageUpload}
				className="hidden"
			/>

			{/* ─── フッター ─── */}
			<footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 shrink-0 z-10">
				<div className="flex items-center space-x-2 sm:space-x-4">
					<span>
						文字:{" "}
						<strong className="text-slate-700 dark:text-slate-300">
							{charCount}
						</strong>
					</span>
					<span className="border-l border-slate-300 dark:border-slate-600 h-3"></span>
					<span>
						読了:{" "}
						<strong className="text-slate-700 dark:text-slate-300">
							約 {readingTime} 分
						</strong>
					</span>
				</div>
				<div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg shrink-0">
					<button
						onClick={() => setViewMode("edit")}
						className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === "edit" ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-xs" : ""}`}
					>
						<Edit3 className="w-3 h-3" />
						<span>編</span>
					</button>
					<button
						onClick={() => setViewMode("preview")}
						className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === "preview" ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-xs" : ""}`}
					>
						<Eye className="w-3 h-3" />
						<span>プレ</span>
					</button>
					<button
						onClick={() => setViewMode("split")}
						className={`hidden md:flex items-center space-x-1 px-3 py-1 rounded-md transition ${viewMode === "split" ? "bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-xs" : ""}`}
					>
						<Columns className="w-3 h-3" />
						<span>分</span>
					</button>
				</div>
			</footer>
		</div>
	);
};

export default App;
