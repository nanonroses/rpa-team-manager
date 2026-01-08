/**
 * Tests para funciones de utilidad UTF-8
 * Relacionado con: Bug UTF-8 Characters (ver .claude/notes/bugs-fixed.md)
 */

// Mapeo simplificado para testing
const utf8Mappings: Record<string, string> = {
    '\u00c3\u00b3': '\u00f3', // ó
    '\u00c3\u00ad': '\u00ed', // í
    '\u00c3\u00b1': '\u00f1', // ñ
    '\u00c3\u00a1': '\u00e1', // á
    '\u00c3\u00a9': '\u00e9', // é
    '\u00c3\u00ba': '\u00fa', // ú
};

function fixUtf8(text: string): string {
    if (!text) return text;
    let fixed = text;
    for (const [broken, correct] of Object.entries(utf8Mappings)) {
        fixed = fixed.replace(new RegExp(broken, 'g'), correct);
    }
    return fixed;
}

describe('UTF-8 Fix Utility', () => {
    describe('fixUtf8', () => {
        it('should return empty string for empty input', () => {
            expect(fixUtf8('')).toBe('');
        });

        it('should return null for null input', () => {
            expect(fixUtf8(null as unknown as string)).toBe(null);
        });

        it('should return undefined for undefined input', () => {
            expect(fixUtf8(undefined as unknown as string)).toBe(undefined);
        });

        it('should return clean text unchanged', () => {
            const clean = 'Texto limpio sin problemas';
            expect(fixUtf8(clean)).toBe(clean);
        });

        it('should handle ASCII text', () => {
            const ascii = 'Hello World 123';
            expect(fixUtf8(ascii)).toBe(ascii);
        });

        it('should handle mixed content', () => {
            const mixed = 'Project Name ABC-123';
            expect(fixUtf8(mixed)).toBe(mixed);
        });
    });
});
