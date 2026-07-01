const DELIMITERS = " ,;:.-_()[]{}\"'?!";

export default function tokenize(input: string): string[] {
  const lowercased_input = input.toLowerCase();
  const keywords: string[] = [];
  let current = "";

  for (const character of lowercased_input) {
    if (DELIMITERS.includes(character)) {
      if (current.length > 0) {
        keywords.push(current);
        current = "";
      }
    } else {
      current += character;
    }
  }

  if (current.length > 0) {
    keywords.push(current);
  }

  return keywords;
}