export const WORD_EXPRESSION = /([A-zÀ-ú0-9]+)/g;
export const PUNCTUATION_EXPRESSION = /([!-.,"])/g;

export interface SpellingOptions {
  process?: boolean;

  allWordsUppercased?: boolean;
  maintainUppercasedWords?: string[];

  replacements?: Record<string, string>;
}

export function isPunctuation(text: string) {
  return !text.match(WORD_EXPRESSION)
}

export function isAllUppercase(text: string) {
  return text.toLocaleUpperCase() == text;
}

export function toSentenceCase(text: string) {
  if (!text)
    return text;

  if (text.length == 1)
    return text.toLowerCase();

  return text.at(0)!.toUpperCase() + text.slice(1)!.toLowerCase();
}

export function correctSpellingOf(text: string, options: SpellingOptions = { process: true }) {
  if ('process' in options && !options.process) {
    return text;
  }

  const textData = [...text.matchAll(WORD_EXPRESSION), ...text.matchAll(PUNCTUATION_EXPRESSION)]
    .sort((a, b) => a!.index! < b!.index! ? -1 : 1);

  let phrase = "";
  let currentState = {
    quoteSeen: false,
    previousWasDot: false,
    previousWasQuote: false,
    firstWord: true,
    alreadySpacedAfter: false,
    previousWord: ''
  };

  for (const data of textData) {
    let { "0": word } = data;

    if (isPunctuation(word)) {
      let spaceBefore = word.match(/[-"(]/) != null && !currentState.quoteSeen;
      let spaceAfter = word.match(/[-]/) != null;

      if (spaceBefore) {
        phrase += ` `;
      }

      phrase += word;

      if (spaceAfter) {
        phrase += ` `;
        currentState.alreadySpacedAfter = true;
      }

      if (word == '"') {
        currentState.quoteSeen = !currentState.quoteSeen;
      }
    } else {
      if (!currentState.previousWasQuote && !currentState.alreadySpacedAfter && !currentState.previousWord.match(/[()]/))
        phrase += ' ';

      if (options.replacements && word in options.replacements) {
        word = options.replacements[word];
      } else {
        if (
          (currentState.previousWasDot || currentState.firstWord || options.allWordsUppercased)
        ) {
          if (!isAllUppercase(word) || !options.maintainUppercasedWords?.includes(word)) {
            word = toSentenceCase(word);
          }
        } else if (!options.allWordsUppercased) {
          word = word.toLowerCase();
        }
      }

      if (word == 'cao') {
        word = 'cão';
      } else if (word.endsWith('cao') && word.length > 3) {
        word = word.slice(0, -3) + 'ção';
      }

      phrase += word;

      currentState.alreadySpacedAfter = false;
    }

    switch (word) {
      case '.':
        currentState.previousWasDot = true;
        break;

      case '"':
        currentState.previousWasQuote = true;
        break;

      default:
        currentState.previousWasDot = false;
        currentState.previousWasQuote = false;
        break;
    }

    currentState.firstWord = false;
    currentState.previousWord = word;
  }

  return phrase.trim();
}
