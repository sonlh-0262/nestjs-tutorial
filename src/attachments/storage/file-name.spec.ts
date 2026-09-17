import { sanitiseFileName } from './file-name';

describe('sanitiseFileName', () => {
  it('keeps an ordinary name unchanged', () => {
    expect(sanitiseFileName('avatar.png', 'png')).toBe('avatar.png');
  });

  it('appends the detected extension when the name disagrees with it', () => {
    expect(sanitiseFileName('payload.svg', 'png')).toBe('payload.svg.png');
  });

  it('matches the existing extension case-insensitively', () => {
    expect(sanitiseFileName('AVATAR.PNG', 'png')).toBe('AVATAR.PNG');
  });

  it('adds an extension to a name that has none', () => {
    expect(sanitiseFileName('avatar', 'jpg')).toBe('avatar.jpg');
  });

  it('drops a POSIX directory prefix', () => {
    expect(sanitiseFileName('/etc/passwd', 'png')).toBe('passwd.png');
  });

  it('drops a Windows directory prefix', () => {
    expect(
      sanitiseFileName('C:' + String.fromCharCode(92) + 'x.png', 'png'),
    ).toBe('x.png');
  });

  it('defeats a traversal attempt in the name', () => {
    const traversal = ['..', '..', '..', 'etc', 'shadow'].join('/');

    expect(sanitiseFileName(traversal, 'png')).toBe('shadow.png');
  });

  it('strips leading dots so the result is never a hidden file', () => {
    expect(sanitiseFileName('...hidden.png', 'png')).toBe('hidden.png');
  });

  it('removes quotes, which would break Content-Disposition', () => {
    const name = 'a"b' + String.fromCharCode(39) + 'c.png';

    expect(sanitiseFileName(name, 'png')).toBe('a b c.png');
  });

  it('treats a backslash as a directory separator, not a name character', () => {
    const name = 'a' + String.fromCharCode(92) + 'b.png';

    expect(sanitiseFileName(name, 'png')).toBe('b.png');
  });

  it('removes control characters that could forge a header line', () => {
    const name =
      'evil' + String.fromCharCode(13) + String.fromCharCode(10) + 'X.png';

    expect(sanitiseFileName(name, 'png')).toBe('evil X.png');
  });

  it('collapses runs of whitespace', () => {
    expect(sanitiseFileName('my    holiday  photo.jpg', 'jpg')).toBe(
      'my holiday photo.jpg',
    );
  });

  it('falls back to a generic name when nothing usable is left', () => {
    expect(sanitiseFileName('...', 'png')).toBe('upload.png');
  });

  it('falls back for an empty name', () => {
    expect(sanitiseFileName('', 'webp')).toBe('upload.webp');
  });

  it('keeps non-ASCII characters, which the column can hold', () => {
    expect(sanitiseFileName('アバター.png', 'png')).toBe('アバター.png');
  });

  it('truncates to the column width, keeping the extension', () => {
    const result = sanitiseFileName(`${'a'.repeat(400)}.png`, 'png');

    expect(result).toHaveLength(255);
    expect(result.endsWith('.png')).toBe(true);
  });
});
