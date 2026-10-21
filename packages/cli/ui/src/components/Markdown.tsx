import { useMemo, useState, type ReactNode } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { cn } from '../lib/utils';

/*
 * Dependency-free Markdown renderer. Model output can contain arbitrary text,
 * so everything is rendered as React text nodes (never innerHTML) — no XSS
 * surface. Supports: fenced code, headings, lists (ul/ol), blockquotes, tables,
 * hr, bold/italic/strike, inline code and links.
 */

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{lang || 'text'}</span>
        <div className="code-actions">
          <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~]+~~)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const t = m[0];
    const key = `${keyBase}-i${i++}`;
    if (t.startsWith('`')) {
      nodes.push(<code key={key}>{t.slice(1, -1)}</code>);
    } else if (t.startsWith('**') || t.startsWith('__')) {
      nodes.push(<strong key={key}>{renderInline(t.slice(2, -2), key)}</strong>);
    } else if (t.startsWith('~~')) {
      nodes.push(<del key={key}>{renderInline(t.slice(2, -2), key)}</del>);
    } else if (t.startsWith('*') || t.startsWith('_')) {
      nodes.push(<em key={key}>{renderInline(t.slice(1, -1), key)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
      if (link) {
        const href = /^(https?:|mailto:)/i.test(link[2]) ? link[2] : '#';
        nodes.push(<a key={key} href={href} target="_blank" rel="noreferrer">{renderInline(link[1], key)}</a>);
      } else {
        nodes.push(t);
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function parseBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = /^(\s*)(```+|~~~+)\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[3];
      const indent = fence[1].length;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*(```+|~~~+)\s*$/.test(lines[i])) {
        buf.push(lines[i].slice(indent));
        i++;
      }
      i++;
      out.push(<CodeBlock key={k()} code={buf.join('\n')} lang={lang} />);
      continue;
    }

    if (/^\s*$/.test(line)) { i++; continue; }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push(<hr key={k()} />); i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const content = renderInline(h[2], k());
      const hk = k();
      if (lvl === 1) out.push(<h1 key={hk}>{content}</h1>);
      else if (lvl === 2) out.push(<h2 key={hk}>{content}</h2>);
      else if (lvl === 3) out.push(<h3 key={hk}>{content}</h3>);
      else if (lvl === 4) out.push(<h4 key={hk}>{content}</h4>);
      else if (lvl === 5) out.push(<h5 key={hk}>{content}</h5>);
      else out.push(<h6 key={hk}>{content}</h6>);
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(<blockquote key={k()}>{parseBlocks(buf.join('\n'))}</blockquote>);
      continue;
    }

    const li = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      const ordered = /\d+\./.test(li[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const m2 = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!m2) break;
        let text = m2[2];
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          text += ' ' + lines[i].trim();
          i++;
        }
        items.push(text);
      }
      const Tag = ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={k()}>
          {items.map((it, idx) => <li key={idx}>{renderInline(it, k())}</li>)}
        </Tag>
      );
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        <table key={k()}>
          <thead><tr>{header.map((c, idx) => <th key={idx}>{renderInline(c, k())}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c, k())}</td>)}</tr>)}</tbody>
        </table>
      );
      continue;
    }

    // paragraph
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*(```+|~~~+)/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(<p key={k()}>{renderInline(buf.join('\n'), k())}</p>);
  }
  return out;
}

export function Markdown({ text }: { text: string }) {
  const nodes = useMemo(() => parseBlocks(text || ''), [text]);
  return <div className="prose">{nodes}</div>;
}

/** Split `<scratchpad>` / `<thinking>` segments out of the assistant text. */
export function splitReasoning(text: string): { type: 'md' | 'reasoning'; text: string }[] {
  const segments: { type: 'md' | 'reasoning'; text: string }[] = [];
  const re = /<(scratchpad|thinking|reasoning|thinking_process)>([\s\S]*?)(?:<\/\1>|$)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segments.push({ type: 'md', text: text.slice(last, m.index) });
    segments.push({ type: 'reasoning', text: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ type: 'md', text: text.slice(last) });
  return segments.length ? segments : [{ type: 'md', text }];
}

function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thinking-block my-2">
      <button onClick={() => setOpen(o => !o)} className="thinking-summary w-full">
        <IconChevronRight size={13} stroke={1.8} className={cn('transition-transform', open && 'rotate-90')} />
        <span className="font-medium">Reasoning</span>
        <span className="text-fg-subtle">{text.length} chars</span>
      </button>
      {open && <div className="thinking-body whitespace-pre-wrap font-mono text-xs">{text}</div>}
    </div>
  );
}

/** Renders assistant/user text: reasoning blocks collapsed, everything else as markdown. */
export function MessageBody({ text }: { text: string }) {
  const segments = useMemo(() => splitReasoning(text || ''), [text]);
  return (
    <div className="text-sm leading-relaxed">
      {segments.map((s, i) => s.type === 'reasoning'
        ? <ReasoningBlock key={i} text={s.text} />
        : <Markdown key={i} text={s.text} />)}
    </div>
  );
}
