import type { EmbedMount } from '@brand/embeds';
import { makeSample, textFrames } from './id3-sample.ts';
import './id3-hex.css';

const hex = (value: number, digits = 2) => value.toString(16).toUpperCase().padStart(digits, '0');
const printable = (value: number) => value >= 32 && value <= 126 ? String.fromCharCode(value) : '·';

const mount: EmbedMount = root => {
  const events = new AbortController();
  const { signal } = events;
  root.classList.add('id3-hex');
  root.innerHTML = `
    <div class="hx-top"><span>Sample tag · ID3v2.4</span><span class="hx-length"></span></div>
    <div class="hx-fields"></div>
    <div class="hx-legend"><span>Edit a value to update the bytes.</span><button type="button" class="hx-reset">Reset</button></div>
    <div class="hx-labels" aria-hidden="true"><span>Addr</span><span>Hex <span class="hx-mobile-label">/ ASCII</span></span><span class="hx-ascii-heading">ASCII</span></div>
    <div class="hx-dump" role="group" aria-label="ID3 tag bytes"></div>
    <div class="hx-inspector" role="status" aria-live="off"><div><strong class="hx-field-name"></strong><span class="hx-offset"></span></div><p class="hx-explanation"></p></div>
    <p class="hx-note">Hover or tap a byte to inspect it. This sample contains metadata only. <a href="https://id3.org/id3v2.4.0-structure">ID3 specification</a></p>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const dump = find<HTMLElement>('.hx-dump');
  const inspector = find<HTMLElement>('.hx-inspector');
  const name = find<HTMLElement>('.hx-field-name');
  const offset = find<HTMLElement>('.hx-offset');
  const explanation = find<HTMLElement>('.hx-explanation');
  const length = find<HTMLElement>('.hx-length');
  const form = find<HTMLElement>('.hx-fields');
  let model = makeSample(textFrames.map(frame => frame.initial));
  let selected = 0;
  let columns = 16;
  let cells: HTMLButtonElement[] = [];
  let asciiCells: HTMLElement[] = [];

  const inputs = textFrames.map(({ id, label, initial }) => {
    const wrapper = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = `${label} · ${id}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initial;
    input.maxLength = 60;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      model = makeSample(inputs.map(element => element.value));
      selected = model.fields.find(field => field.key === `${id}-text` || field.key === `${id}-encoding` && !input.value)!.start;
      renderBytes();
      revealSelected();
    }, { signal });
    wrapper.append(caption, input);
    form.append(wrapper);
    return input;
  });

  function select(index: number, announce = false) {
    selected = Math.max(0, Math.min(model.bytes.length - 1, index));
    const field = model.fields.find(part => selected >= part.start && selected < part.end)!;
    cells.forEach((cell, i) => {
      cell.classList.toggle('hx-related', i >= field.start && i < field.end);
      cell.classList.toggle('hx-selected', i === selected);
      cell.tabIndex = i === selected ? 0 : -1;
      cell.setAttribute('aria-pressed', String(i === selected));
      asciiCells[i].classList.toggle('hx-related', i >= field.start && i < field.end);
    });
    inspector.setAttribute('aria-live', announce ? 'polite' : 'off');
    name.textContent = field.label;
    offset.textContent = `0x${hex(selected, 4)} · ${hex(model.bytes[selected])}`;
    explanation.textContent = field.explanation;
  }

  function renderBytes() {
    cells = [];
    asciiCells = [];
    const fragment = document.createDocumentFragment();
    for (let start = 0; start < model.bytes.length; start += columns) {
      const row = document.createElement('div');
      row.className = 'hx-row';
      const address = document.createElement('span');
      address.className = 'hx-address';
      address.textContent = hex(start, 4);
      address.setAttribute('aria-hidden', 'true');
      const bytes = document.createElement('div');
      bytes.className = 'hx-bytes';
      const ascii = document.createElement('div');
      ascii.className = 'hx-ascii';
      ascii.setAttribute('aria-hidden', 'true');
      for (let i = start; i < Math.min(start + columns, model.bytes.length); i++) {
        const value = model.bytes[i];
        const field = model.fields.find(part => i >= part.start && i < part.end)!;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hx-byte';
        button.dataset.index = String(i);
        button.dataset.frame = field.frame;
        button.setAttribute('aria-label', `Offset ${hex(i, 4)}, hex ${hex(value)}${value >= 32 && value <= 126 ? `, ${String.fromCharCode(value)}` : ''}. ${field.label}.`);
        const number = document.createElement('span');
        number.textContent = hex(value);
        const character = document.createElement('span');
        character.className = 'hx-letter';
        character.textContent = printable(value);
        character.setAttribute('aria-hidden', 'true');
        button.append(number, character);
        bytes.append(button);
        cells.push(button);
        const asciiCharacter = document.createElement('span');
        asciiCharacter.textContent = printable(value);
        ascii.append(asciiCharacter);
        asciiCells.push(asciiCharacter);
      }
      row.append(address, bytes, ascii);
      fragment.append(row);
    }
    dump.replaceChildren(fragment);
    length.textContent = `${model.bytes.length} bytes`;
    select(selected);
  }

  function revealSelected() {
    const cell = cells[selected].getBoundingClientRect();
    const bounds = dump.getBoundingClientRect();
    if (cell.top < bounds.top) dump.scrollTop -= bounds.top - cell.top;
    else if (cell.bottom > bounds.bottom) dump.scrollTop += cell.bottom - bounds.bottom;
  }

  const byteAt = (event: Event) => (event.target as Element).closest<HTMLButtonElement>('.hx-byte');
  dump.addEventListener('pointerover', event => {
    const cell = byteAt(event);
    if (event.pointerType === 'mouse' && cell) select(Number(cell.dataset.index));
  }, { signal });
  dump.addEventListener('click', event => {
    const cell = byteAt(event);
    if (cell) select(Number(cell.dataset.index), true);
  }, { signal });
  dump.addEventListener('focusin', event => {
    const cell = byteAt(event);
    if (cell) select(Number(cell.dataset.index), true);
  }, { signal });
  dump.addEventListener('keydown', event => {
    if (!byteAt(event)) return;
    let next: number;
    if (event.key === 'ArrowRight') next = selected + 1;
    else if (event.key === 'ArrowLeft') next = selected - 1;
    else if (event.key === 'ArrowDown') next = selected + columns;
    else if (event.key === 'ArrowUp') next = selected - columns;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = model.bytes.length - 1;
    else return;
    event.preventDefault();
    select(next, true);
    cells[selected].focus({ preventScroll: true });
    revealSelected();
  }, { signal });
  find<HTMLButtonElement>('.hx-reset').addEventListener('click', () => {
    inputs.forEach((input, i) => { input.value = textFrames[i].initial; });
    model = makeSample(inputs.map(input => input.value));
    selected = 0;
    dump.scrollTop = 0;
    renderBytes();
  }, { signal });

  function resize(width: number) {
    const next = width < 580 ? 8 : 16;
    if (cells.length && next === columns) return;
    const hadFocus = dump.contains(document.activeElement);
    columns = next;
    root.classList.toggle('hx-compact', columns === 8);
    root.style.setProperty('--hx-columns', String(columns));
    renderBytes();
    if (hadFocus) { cells[selected].focus({ preventScroll: true }); revealSelected(); }
  }
  resize(root.clientWidth - 40);
  const observer = new ResizeObserver(([entry]) => resize(entry.contentRect.width));
  observer.observe(root);
  return () => { events.abort(); observer.disconnect(); };
};

export default mount;
