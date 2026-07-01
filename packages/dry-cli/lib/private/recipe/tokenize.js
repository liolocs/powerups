const DELIMITERS = " ,;:.-_()[]{}\"'?!";
export default function tokenize(input) {
    const lowercased_input = input.toLowerCase();
    const keywords = [];
    let current = "";
    for (const character of lowercased_input) {
        if (DELIMITERS.includes(character)) {
            if (current.length > 0) {
                keywords.push(current);
                current = "";
            }
        }
        else {
            current += character;
        }
    }
    if (current.length > 0) {
        keywords.push(current);
    }
    return keywords;
}
//# sourceMappingURL=tokenize.js.map