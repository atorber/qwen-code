/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calculate display width of a string (CJK characters count as 2, others as 1)
 * This is important for proper alignment in terminal output when displaying Chinese/Japanese/Korean text.
 * 
 * @param str - The string to measure
 * @returns The display width in terminal columns
 */
export function getDisplayWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
        (code >= 0xAC00 && code <= 0xD7AF) ||  // Hangul Syllables
        (code >= 0xFF00 && code <= 0xFFEF)) {  // Fullwidth Forms
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Truncate a string to fit within a target display width and pad with spaces
 * Handles CJK characters correctly
 * 
 * @param str - The string to truncate and pad
 * @param targetWidth - The target display width
 * @returns The truncated and padded string
 */
export function truncateAndPad(str: string, targetWidth: number): string {
  let displayWidth = getDisplayWidth(str);
  let result = str;
  
  if (displayWidth > targetWidth) {
    // Truncate to fit with ellipsis
    let truncated = '';
    let currentWidth = 0;
    for (let i = 0; i < str.length; i++) {
      const charWidth = getDisplayWidth(str[i]);
      if (currentWidth + charWidth + 3 > targetWidth) break; // Reserve 3 for '...'
      truncated += str[i];
      currentWidth += charWidth;
    }
    result = truncated + '...';
    displayWidth = getDisplayWidth(result);
  }
  
  // Pad with spaces to reach target width
  const spacesToAdd = targetWidth - displayWidth;
  return result + ' '.repeat(Math.max(0, spacesToAdd));
}

