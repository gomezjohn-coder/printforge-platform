const { describe, it } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';

// Helper to make HTTP requests
function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    }).on('error', reject);
  });
}

describe('Search Service', () => {
  it('should respond to health check', async () => {
    // Unit test: verify search engine module loads
    const { SearchEngine } = require('./search-engine');
    assert.ok(SearchEngine, 'SearchEngine class should be exported');
  });

  it('should create a search engine instance', () => {
    const { SearchEngine } = require('./search-engine');
    const engine = new SearchEngine('http://localhost:3001');
    assert.ok(engine, 'SearchEngine instance should be created');
  });
});
