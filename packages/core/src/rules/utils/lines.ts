/*
 * The line ending `text` is written in.
 */
export function detectLineEnding(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}
