
const fs = require('fs');
let content = fs.readFileSync('c:/GitHub/Wip_Diversos/backend/src/controller/WhatsConversationPath.ts', 'utf8');

let count = 0;
while (true) {
    let startIndex = content.indexOf('fs.readFile(logMsgFilePath');
    if (startIndex === -1) break;

    // Find the end of this statement by counting braces
    let braceCount = 0;
    let started = false;
    let endIndex = startIndex;
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            started = true;
        } else if (content[i] === '}') {
            braceCount--;
        }

        if (started && braceCount === 0) {
            // Check if it's the end of the arrow function
            let nextChars = content.substring(i, i + 5);
            if (nextChars.startsWith('});')) {
                endIndex = i + 3;
                break;
            }
        }
    }

    if (endIndex > startIndex) {
        // Also remove leading whitespace
        let wsStart = startIndex;
        while (wsStart > 0 && (content[wsStart - 1] === ' ' || content[wsStart - 1] === '\t')) {
            wsStart--;
        }
        
        let removed = content.substring(wsStart, endIndex);
        
        if (removed.includes('fs.writeFile')) {
            content = content.substring(0, wsStart) + content.substring(endIndex);
            count++;
            console.log('Removed block of length', removed.length);
        } else {
            console.log('Found block but it does not contain fs.writeFile, skipping to avoid infinite loop. Start:', startIndex);
            break;
        }
    } else {
        console.log('Could not find end of block for index:', startIndex);
        break;
    }
}

content = content.replace(/const logMsgFilePath = path\.join\(__dirname, ''msg\.json''\); *\n/, '');

fs.writeFileSync('c:/GitHub/Wip_Diversos/backend/src/controller/WhatsConversationPath.ts', content);
console.log('Removed', count, 'occurrences.');

