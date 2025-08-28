const fs = require('fs');
const path = require('path');

function minifyJS(content) {
    return content
        // Remove single line comments (but preserve URLs and other //)
        .replace(/\/\/(?![^"']*["'])[^\r\n]*/g, '')
        // Remove multi-line comments  
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Replace multiple whitespace with single space
        .replace(/\s+/g, ' ')
        // Remove spaces around specific punctuation (more conservative)
        .replace(/\s*([{}();,])\s*/g, '$1')
        // Remove spaces around equals and basic operators
        .replace(/\s*([=+\-*/<>!&|])\s*/g, '$1')
        // Clean up any remaining multiple spaces
        .replace(/\s+/g, ' ')
        // Trim leading/trailing space
        .trim();
}

try {
    const inputFile = 'chat-embed.js';
    const outputFile = 'chat-embed-min.js';
    
    console.log('Reading file:', inputFile);
    const content = fs.readFileSync(inputFile, 'utf8');
    
    console.log('Original size:', content.length, 'characters');
    console.log('Minifying...');
    
    const minified = minifyJS(content);
    
    console.log('Minified size:', minified.length, 'characters');
    console.log('Reduction:', ((content.length - minified.length) / content.length * 100).toFixed(1) + '%');
    
    fs.writeFileSync(outputFile, minified, 'utf8');
    console.log('Minified file saved as:', outputFile);
    
} catch (error) {
    console.error('Error:', error.message);
}
