import type { EmbedMount } from '@brand/embeds';
import { makeSample, textFrames } from './id3-sample.ts';
import { exifFields, makeExifSample } from './exif-sample';
import './id3-hex.css';

const hex = (value: number, digits = 2) => value.toString(16).toUpperCase().padStart(digits, '0');
const printable = (value: number) => value >= 32 && value <= 126 ? String.fromCharCode(value) : '·';
const formats = [
  { id: 'id3', label: 'ID3', medium: 'MP3 audio', title: 'Sample tag · ID3v2.4', fields: textFrames, make: makeSample,
    note: 'Hover or tap a byte to inspect it. This sample contains metadata only.', reference: 'https://en.wikipedia.org/wiki/ID3' },
  { id: 'exif', label: 'EXIF', medium: 'Image metadata', title: 'Sample segment · EXIF / JPEG APP1', fields: exifFields, make: makeExifSample,
    note: 'Hover or tap a byte to inspect it. Fictional metadata only; no photo is read or modified.', reference: 'https://en.wikipedia.org/wiki/Exif' },
] as const;
let viewerCount = 0;

const mount: EmbedMount = root => {
  const events = new AbortController();
  const { signal } = events;
  const viewerId = `metadata-hex-${++viewerCount}`;
  root.classList.add('id3-hex');
  root.innerHTML = `
    <div class="hx-tabs" role="tablist" aria-label="Metadata format">${formats.map((format, i) =>
      `<button type="button" role="tab" id="${viewerId}-${format.id}" aria-controls="${viewerId}-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><strong>${format.label}</strong><span>${format.medium}</span></button>`).join('')}</div>
    <div class="hx-panel" role="tabpanel" id="${viewerId}-panel" aria-labelledby="${viewerId}-id3">
    <div class="hx-top"><span class="hx-format"></span><span class="hx-length"></span></div>
    <div class="hx-fields"></div>
    <p class="hx-error" id="${viewerId}-error" role="status" hidden>These EXIF sample fields use ASCII. Replace non-ASCII characters to update the bytes.</p>
    <div class="hx-legend"><span>Edit a value to update the bytes.</span><button type="button" class="hx-reset">Reset</button></div>
    <div class="hx-labels" aria-hidden="true"><span>Addr</span><span>Hex <span class="hx-mobile-label">/ ASCII</span></span><span class="hx-ascii-heading">ASCII</span></div>
    <div class="hx-dump" role="group" aria-label="ID3 tag bytes"></div>
    <div class="hx-inspector" role="status" aria-live="off"><div><strong class="hx-field-name"></strong><span class="hx-offset"></span></div><p class="hx-explanation"></p></div>
    <p class="hx-note"><span></span> <a></a></p>
    </div>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const dump = find<HTMLElement>('.hx-dump');
  const inspector = find<HTMLElement>('.hx-inspector');
  const name = find<HTMLElement>('.hx-field-name');
  const offset = find<HTMLElement>('.hx-offset');
  const explanation = find<HTMLElement>('.hx-explanation');
  const length = find<HTMLElement>('.hx-length');
  const form = find<HTMLElement>('.hx-fields');
  const error = find<HTMLElement>('.hx-error');
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const states = formats.map(format => {
    const values = format.fields.map(field => String(field.initial));
    return { values, model: format.make(values), selected: 0, scrollTop: 0 };
  });
  let formatIndex = 0;
  let model = states[0].model;
  let selected = 0;
  let columns = 16;
  let cells: HTMLButtonElement[] = [];
  let asciiCells: HTMLElement[] = [];
  let inputs: HTMLInputElement[] = [];

  function validateInputs() {
    let valid = true;
    inputs.forEach(input => {
      const invalid = formatIndex === 1 && !/^[\x20-\x7e]*$/.test(input.value);
      input.setAttribute('aria-invalid', String(invalid));
      input.setCustomValidity(invalid ? 'Use ASCII characters for this EXIF sample.' : '');
      if (invalid) input.setAttribute('aria-describedby', error.id);
      else input.removeAttribute('aria-describedby');
      valid = valid && !invalid;
    });
    error.hidden = valid;
    return valid;
  }

  function renderForm() {
    const format = formats[formatIndex];
    root.dataset.format = format.id;
    find<HTMLElement>('.hx-format').textContent = format.title;
    find<HTMLElement>('.hx-panel').setAttribute('aria-labelledby', tabs[formatIndex].id);
    dump.setAttribute('aria-label', `${format.label} metadata bytes`);
    find<HTMLElement>('.hx-note span').textContent = format.note;
    const reference = find<HTMLAnchorElement>('.hx-note a');
    reference.href = format.reference;
    reference.textContent = `${format.label} on Wikipedia`;
    form.replaceChildren();
    inputs = format.fields.map(({ id, label }, i) => {
      const wrapper = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = `${label} · ${id}`;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = states[formatIndex].values[i];
      input.dataset.index = String(i);
      input.maxLength = 60;
      input.spellcheck = false;
      input.autocomplete = 'off';
      wrapper.append(caption, input);
      form.append(wrapper);
      return input;
    });
    validateInputs();
  }

  form.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const state = states[formatIndex];
    state.values = inputs.map(element => element.value);
    if (!validateInputs()) return;
    model = state.model = formats[formatIndex].make(state.values);
    const id = formats[formatIndex].fields[Number(input.dataset.index)].id;
    selected = model.fields.find(field => field.key === `${id}-text`
      || !input.value && (field.key === `${id}-encoding` || field.key === `${id}-terminator`))!.start;
    renderBytes();
    revealSelected();
  }, { signal });

  function chooseTab(index: number) {
    if (index === formatIndex) return;
    states[formatIndex].selected = selected;
    states[formatIndex].scrollTop = dump.scrollTop;
    formatIndex = index;
    model = states[index].model;
    selected = states[index].selected;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    renderForm();
    renderBytes();
    dump.scrollTop = states[index].scrollTop;
  }
  tabs.forEach((tab, index) => tab.addEventListener('click', () => chooseTab(index), { signal }));
  find<HTMLElement>('.hx-tabs').addEventListener('keydown', event => {
    let next: number;
    if (event.key === 'ArrowRight') next = (formatIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (formatIndex + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    chooseTab(next);
    tabs[next].focus({ preventScroll: true });
  }, { signal });

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
    inputs.forEach((input, i) => { input.value = formats[formatIndex].fields[i].initial; });
    states[formatIndex].values = inputs.map(input => input.value);
    model = states[formatIndex].model = formats[formatIndex].make(states[formatIndex].values);
    validateInputs();
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
  renderForm();
  resize(root.clientWidth - 40);
  const observer = new ResizeObserver(([entry]) => resize(entry.contentRect.width));
  observer.observe(root);
  return () => { events.abort(); observer.disconnect(); };
};

export default mount;
