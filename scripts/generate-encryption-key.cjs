#!/usr/bin/env node

const crypto = require('crypto');

console.log('\n🔐 Generating API Key Encryption Secret...\n');

const secret = crypto.randomBytes(32).toString('hex');

console.log('Add this to your .env.local file:');
console.log('─'.repeat(70));
console.log(`API_KEY_ENCRYPTION_SECRET=${secret}`);
console.log('─'.repeat(70));
console.log('\n✅ Secret generated successfully!\n');
console.log('⚠️  IMPORTANT: Keep this secret secure and never commit it to version control.\n');
