import type { IToken } from 'chevrotain';
import { keywordToken, punctuationToken } from '../../lexer.js';

/** True when the token is the given keyword, compared case-insensitively. */
export function isKeyword(token: IToken, image: string): boolean {
  return token.tokenType === keywordToken && token.image.toLowerCase() === image;
}

export function isOpenParen(token: IToken): boolean {
  return token.tokenType === punctuationToken && token.image === '(';
}

export function isCloseParen(token: IToken): boolean {
  return token.tokenType === punctuationToken && token.image === ')';
}
