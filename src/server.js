import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = join(__dirname, '..', 'template.html');

const formatNotes = (notes) => {
  return notes
    .map(note => `
      <div class="note">
        <p>${note.content}</p>
        <div class="tags">
          ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')}
        </div>
      </div>
    `)
    .join('\n');
}

const interpolate = (html, data) => {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, placeholder) => {
    console.log('match: ', match);
    console.log('group: ', placeholder);
    return data[placeholder] || ''
  })
}

const createServer =  (notes) => {
  return http.createServer(async (req, res) => {
    const template = await readFile(TEMPLATE_PATH, 'utf-8');
    const html = interpolate(template, { notes: formatNotes(notes) });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
}

export const start = (notes, port) => {
  const server = createServer(notes);
  server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });

  open(`http://localhost:${port}`);
}