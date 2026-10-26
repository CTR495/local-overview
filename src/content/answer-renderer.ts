import type { Source } from '../shared/types';

/** A small streaming grammar: plain text, **emphasis**, and supplied [source IDs]. */
export class AnswerRenderer {
  private pending = '';
  private emphasis?: HTMLElement;
  private sources = new Map<number, Source>();
  private cursor: HTMLElement;
  constructor(private readonly root: HTMLElement) {
    this.cursor = document.createElement('span');
    this.cursor.className = 'cursor';
    this.cursor.setAttribute('aria-hidden', 'true');
  }
  setSources(sources: Source[]): void {
    this.sources.clear();
    for (const source of sources) {
      try {
        const url = new URL(source.url);
        if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
          this.sources.set(source.id, source);
      } catch {
        /* Untrusted source URLs never become links. */
      }
    }
  }
  reset(): void {
    this.pending = '';
    this.emphasis = undefined;
    this.root.replaceChildren();
  }
  append(text: string): void {
    this.pending += text;
    this.consume(false);
    if (this.root.childNodes.length && !this.cursor.isConnected) this.root.append(this.cursor);
  }
  finish(): void {
    this.consume(true);
    this.cursor.remove();
    this.emphasis = undefined;
  }
  private insert(node: Node): void {
    if (this.emphasis) this.emphasis.append(node);
    else this.root.insertBefore(node, this.cursor.parentNode === this.root ? this.cursor : null);
  }
  private reveal(text: string): void {
    if (!text) return;
    const span = document.createElement('span');
    span.className = 'answer-reveal';
    span.textContent = text;
    this.insert(span);
  }
  private citation(id: number): void {
    const source = this.sources.get(id);
    if (!source) return;
    const link = document.createElement('a');
    link.className = 'citation answer-reveal';
    link.textContent = `[${id}]`;
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Source ${id}: ${source.title}`);
    this.insert(link);
  }
  private consume(final: boolean): void {
    let i = 0,
      plain = 0;
    while (i < this.pending.length) {
      const char = this.pending[i];
      if (char === '*') {
        if (i + 1 === this.pending.length && !final) break;
        if (this.pending[i + 1] === '*') {
          this.reveal(this.pending.slice(plain, i));
          if (this.emphasis) this.emphasis = undefined;
          else {
            const strong = document.createElement('strong');
            strong.className = 'emphasis';
            this.insert(strong);
            this.emphasis = strong;
          }
          i += 2;
          plain = i;
          continue;
        }
      }
      if (char === '[') {
        const tail = this.pending.slice(i);
        const match = /^\[(\d{1,3})\]/.exec(tail);
        if (match) {
          this.reveal(this.pending.slice(plain, i));
          this.citation(Number(match[1]));
          i += match[0].length;
          plain = i;
          continue;
        }
        if (!final && /^\[\d{0,3}$/.test(tail)) break;
      }
      i++;
    }
    this.reveal(this.pending.slice(plain, i));
    this.pending = this.pending.slice(i);
  }
}
