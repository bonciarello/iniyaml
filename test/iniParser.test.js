import { describe, it, expect } from 'vitest';
import { iniToYaml, parseINI, toYAML } from '../src/lib/iniParser.js';

describe('INI Parser', () => {
  describe('parseINI', () => {
    it('parses simple key-value pairs in a section', () => {
      const input = `[server]\nhost = localhost\nport = 8080`;
      const result = parseINI(input);
      expect(result._sections).toContain('server');
      const server = result.server;
      expect(server._lines[0].type).toBe('section');
      expect(server._lines[1].type).toBe('kv');
      expect(server._lines[1].key).toBe('host');
      expect(server._lines[1].value).toBe('localhost');
      expect(server._lines[2].type).toBe('kv');
      expect(server._lines[2].key).toBe('port');
      expect(server._lines[2].value).toBe('8080');
    });

    it('parses comments starting with ; and #', () => {
      const input = `; Top comment\n# Another comment\n[app]\n; Section comment\nname = test`;
      const result = parseINI(input);
      expect(result._lines[0].type).toBe('comment');
      expect(result._lines[0].text).toBe('Top comment');
      expect(result._lines[1].type).toBe('comment');
      expect(result._lines[1].text).toBe('Another comment');
      const app = result.app;
      expect(app._lines[0].type).toBe('section');
      expect(app._lines[1].type).toBe('comment');
      expect(app._lines[1].text).toBe('Section comment');
    });

    it('parses quoted values', () => {
      const input = `[db]\npassword = "s3cret!"`;
      const result = parseINI(input);
      expect(result.db._lines[1].value).toBe('s3cret!');
    });

    it('handles empty input', () => {
      const result = parseINI('');
      expect(result._sections).toEqual([]);
    });

    it('preserves inline comments on values', () => {
      const input = `[app]\nname = myapp ; the application name`;
      const result = parseINI(input);
      expect(result.app._lines[1].key).toBe('name');
      expect(result.app._lines[1].value).toBe('myapp');
      expect(result.app._lines[1].comment).toBe('the application name');
    });
  });

  describe('iniToYaml', () => {
    it('converts a simple INI to YAML', () => {
      const input = `[server]\nhost = localhost\nport = 8080`;
      const output = iniToYaml(input);
      expect(output).toContain('server:');
      expect(output).toContain('host: localhost');
      expect(output).toContain('port: 8080');
    });

    it('preserves comments as YAML comments', () => {
      const input = `; Config file\n[server]\nhost = localhost`;
      const output = iniToYaml(input);
      expect(output).toContain('# Config file');
    });

    it('handles boolean values', () => {
      const input = `[debug]\nenabled = true\nverbose = false`;
      const output = iniToYaml(input);
      expect(output).toContain('enabled: true');
      expect(output).toContain('verbose: false');
    });

    it('converts nested sections via dots', () => {
      const input = `[database.mysql]\nhost = localhost\nport = 3306`;
      const output = iniToYaml(input);
      expect(output).toContain('database:');
      expect(output).toContain('mysql:');
      expect(output).toContain('host: localhost');
    });

    it('returns empty string for empty input', () => {
      expect(iniToYaml('')).toBe('');
      expect(iniToYaml('   ')).toBe('');
    });

    it('quotes strings with special characters', () => {
      const input = `[app]\ndesc = "value with spaces and # hash"`;
      const output = iniToYaml(input);
      expect(output).toContain("'value with spaces and # hash'");
    });

    it('handles yes/no boolean values', () => {
      const input = `[flags]\nauto = yes\nmanual = no`;
      const output = iniToYaml(input);
      expect(output).toContain('auto: true');
      expect(output).toContain('manual: false');
    });

    it('converts the full example correctly', () => {
      const input = `; Configurazione di esempio\n[server]\nhost = localhost\nport = 8080\ndebug = true\n\n[database]\ndriver = mysql\nhost = db.example.com\nport = 3306\nname = myapp`;
      const output = iniToYaml(input);
      expect(output).toContain('# Configurazione di esempio');
      expect(output).toContain('server:');
      expect(output).toContain('host: localhost');
      expect(output).toContain('port: 8080');
      expect(output).toContain('debug: true');
      expect(output).toContain('database:');
      expect(output).toContain('driver: mysql');
    });
  });
});
