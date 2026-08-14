import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Buffer } from "buffer";

// ブラウザ環境用に Buffer をグローバルへ割り当て
if (typeof window !== "undefined" && !(window as any).Buffer) {
	(window as any).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
