const fs = require('fs');

const raw = fs.readFileSync('input_data.csv', 'utf8');
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

if (lines.length === 0) {
  console.log("No data");
  process.exit(1);
}

// Find botnetdomain column index
const header = lines[0].split(',');
const botnetIdx = header.indexOf('botnetdomain');
console.log('botnetdomain column index:', botnetIdx);

const domains = new Set();
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols.length > botnetIdx && botnetIdx !== -1) {
    const domain = cols[botnetIdx].trim().toLowerCase();
    // Validate domain format (not empty, not redirect, etc.)
    if (domain && domain !== 'botnetdomain' && domain.includes('.')) {
      domains.add(domain);
    }
  }
}

const sortedDomains = Array.from(domains).sort();
console.log('Total unique domains:', sortedDomains.length);
console.log(sortedDomains);

fs.writeFileSync('extracted_domains.txt', sortedDomains.join('\n') + '\n');
