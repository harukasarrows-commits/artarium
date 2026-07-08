import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = [
  { source: "presentation.md", output: "presentation.html", label: "プレゼン資料" },
  { source: "brand-identity.md", output: "brand-identity.html", label: "ブランドガイドライン" },
  { source: "development-instructions.md", output: "development-instructions.html", label: "開発指示書" },
  { source: "specification.md", output: "specification.html", label: "仕様書" },
  { source: "roadmap.md", output: "roadmap.html", label: "今後の開発計画" },
  { source: "development-schedule.md", output: "development-schedule.html", label: "開発スケジュール案" },
  { source: "development-schedule-dates.md", output: "development-schedule-dates.html", label: "開発スケジュール（実日付版）" }
];

const root = path.dirname(fileURLToPath(import.meta.url));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function slugify(value) {
  return encodeURIComponent(
    value
      .replace(/^#+\s*/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
  );
}

function closeParagraph(state, html) {
  if (!state.paragraph.length) return;
  html.push(`<p>${inlineMarkdown(state.paragraph.join(" "))}</p>`);
  state.paragraph = [];
}

function closeList(state, html) {
  if (!state.list) return;
  html.push(`</${state.list}>`);
  state.list = "";
}

function closeTable(state, html) {
  if (!state.table.length) return;
  const rows = state.table;
  const head = rows[0];
  const body = rows.slice(2);
  html.push("<div class=\"table-wrap\"><table>");
  html.push(`<thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`);
  html.push("<tbody>");
  body.forEach((row) => {
    html.push(`<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`);
  });
  html.push("</tbody></table></div>");
  state.table = [];
}

function closeBlocks(state, html) {
  closeParagraph(state, html);
  closeList(state, html);
  closeTable(state, html);
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/:?-+:?/g, "---"));
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const state = { paragraph: [], list: "", table: [], code: false, codeLang: "", codeLines: [] };

  lines.forEach((line) => {
    if (line.startsWith("```")) {
      if (state.code) {
        if (state.codeLang === "embed") {
          html.push(state.codeLines.join("\n"));
        } else {
          html.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
        }
        state.code = false;
        state.codeLang = "";
        state.codeLines = [];
        return;
      }
      closeBlocks(state, html);
      state.code = true;
      state.codeLang = line.slice(3).trim();
      state.codeLines = [];
      return;
    }

    if (state.code) {
      state.codeLines.push(line);
      return;
    }

    if (/^\|.+\|$/.test(line.trim())) {
      closeParagraph(state, html);
      closeList(state, html);
      state.table.push(parseTableRow(line));
      return;
    }

    if (state.table.length) closeTable(state, html);

    if (!line.trim()) {
      closeParagraph(state, html);
      closeList(state, html);
      return;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeBlocks(state, html);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      html.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      return;
    }

    const unordered = line.match(/^\s*-\s+(.+)$/);
    if (unordered) {
      closeParagraph(state, html);
      if (state.list !== "ul") {
        closeList(state, html);
        html.push("<ul>");
        state.list = "ul";
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      return;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      closeParagraph(state, html);
      if (state.list !== "ol") {
        closeList(state, html);
        html.push("<ol>");
        state.list = "ol";
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      return;
    }

    state.paragraph.push(line.trim());
  });

  closeBlocks(state, html);
  if (state.code) html.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
  return html.join("\n");
}

function pageTemplate({ title, body, nav }) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | Artarium Docs</title>
    <link rel="stylesheet" href="./docs.css">
  </head>
  <body>
    <div class="doc-shell">
      <aside class="doc-nav">
        <a class="brand" href="./index.html"><svg viewBox="0 0 96 104" aria-hidden="true"><rect x="10" y="7" width="76" height="90" rx="10" fill="none" stroke="#b99a55" stroke-width="8"/><path d="M48 82 V45" stroke="#eee6d5" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M48 57 C33 56 23 45 21.5 27 C39 30 47.5 42 48 57 Z" fill="#eee6d5"/><path d="M48 49 C48.5 32.5 59 21 74.5 18.5 C73 35.5 62 47 48 49 Z" fill="#eee6d5"/></svg><span>Artarium Docs</span></a>
        <nav>${nav}</nav>
      </aside>
      <main class="doc-main">
        ${body}
      </main>
    </div>
  </body>
</html>
`;
}

function navHtml(activeOutput = "") {
  return docs
    .map((doc) => `<a class="${doc.output === activeOutput ? "is-active" : ""}" href="./${doc.output}">${doc.label}</a>`)
    .join("\n");
}

function stylesheet() {
  return `:root {
  color-scheme: dark;
  --bg: #070707;
  --panel: rgba(21, 22, 22, 0.92);
  --ink: #eee6d5;
  --muted: rgba(238, 230, 213, 0.68);
  --line: rgba(169, 140, 74, 0.28);
  --gold: #b99a55;
  --code: #121514;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(ellipse at 50% 0, rgba(185, 154, 85, 0.13), transparent 36%),
    linear-gradient(180deg, #101111, var(--bg));
  font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif;
  line-height: 1.8;
}

.doc-shell {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 34px;
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 34px 0 60px;
}

.doc-nav {
  position: sticky;
  top: 24px;
  align-self: start;
  padding: 18px;
  border: 1px solid var(--line);
  background: rgba(10, 10, 10, 0.72);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  color: var(--ink);
  font-size: 1.15rem;
  font-weight: 700;
  text-decoration: none;
}

.brand svg {
  width: 21px;
  flex: none;
}

.doc-nav nav {
  display: grid;
  gap: 8px;
}

.doc-nav a {
  padding: 9px 10px;
  border: 1px solid transparent;
  color: var(--muted);
  text-decoration: none;
}

.doc-nav a:hover,
.doc-nav a.is-active {
  border-color: var(--line);
  color: var(--ink);
  background: rgba(185, 154, 85, 0.08);
}

.doc-main {
  min-width: 0;
  padding: 34px 40px;
  border: 1px solid var(--line);
  background: var(--panel);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.44);
}

h1,
h2,
h3,
h4 {
  line-height: 1.38;
}

h1 {
  margin: 0 0 26px;
  font-size: clamp(2rem, 5vw, 3.3rem);
  color: var(--ink);
}

h2 {
  margin: 42px 0 14px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  color: var(--gold);
  font-size: 1.45rem;
}

h3 {
  margin: 28px 0 10px;
  font-size: 1.12rem;
}

p,
li {
  color: var(--muted);
}

a {
  color: var(--gold);
}

code {
  padding: 0.1em 0.36em;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  color: var(--ink);
  background: var(--code);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
}

pre {
  overflow: auto;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--code);
}

pre code {
  padding: 0;
  border: 0;
  background: transparent;
}

.table-wrap {
  overflow: auto;
  margin: 18px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 10px 12px;
  border: 1px solid rgba(169, 140, 74, 0.22);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--ink);
  background: rgba(185, 154, 85, 0.1);
}

td {
  color: var(--muted);
}

@media (max-width: 820px) {
  .doc-shell {
    grid-template-columns: 1fr;
    width: min(100% - 22px, 720px);
    gap: 18px;
    padding-top: 16px;
  }

  .doc-nav {
    position: static;
  }

  .doc-main {
    padding: 24px 18px;
  }
}
`;
}

async function main() {
  const nav = navHtml();
  await writeFile(path.join(root, "docs.css"), stylesheet());

  const indexBody = `<h1>Artarium 資料一覧</h1>
<p>歩くほど、絵は育つ。 — Artarium - 名画の庭 のプレゼン資料、ブランドガイドライン、開発指示書、仕様書、今後の計画をHTMLで確認できます。</p>
<ul>
${docs.map((doc) => `<li><a href="./${doc.output}">${doc.label}</a></li>`).join("\n")}
</ul>
<h2>更新ルール</h2>
<p>仕様、画面、モデル運用、マネタイズ、開発計画が変わった場合は、Markdown資料を更新した後にHTMLも再生成してください。</p>
<pre><code>node docs/build-html.mjs</code></pre>`;

  await writeFile(path.join(root, "index.html"), pageTemplate({
    title: "資料一覧",
    body: indexBody,
    nav
  }));

  for (const doc of docs) {
    const markdown = await readFile(path.join(root, doc.source), "utf8");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1] || doc.label;
    const body = markdownToHtml(markdown);
    await writeFile(path.join(root, doc.output), pageTemplate({
      title,
      body,
      nav: navHtml(doc.output)
    }));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
