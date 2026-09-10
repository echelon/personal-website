/** A mount function owns only its root; return a cleanup callback when needed. */
export interface EmbedContext {
  readonly reducedMotion: MediaQueryList;
}

export type EmbedMount = (root: HTMLElement, context: EmbedContext) => void | (() => void) | Promise<void | (() => void)>;

/** Render a labeled slider without duplicating IDs when an article repeats an embed. */
export function slider(label: string, min: number, max: number, value: number, onInput: (value: number) => void) {
  const wrapper = document.createElement('label');
  wrapper.className = 'experiment-slider';
  const title = document.createElement('span');
  title.textContent = label;
  const output = document.createElement('output');
  output.value = String(value);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener('input', () => {
    output.value = input.value;
    onInput(Number(input.value));
  });
  wrapper.append(title, input, output);
  return wrapper;
}
