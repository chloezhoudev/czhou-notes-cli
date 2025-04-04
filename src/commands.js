import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { addNote, getAllNotes, findNotes, removeNote, removeAllNotes } from './notes.js';
import { start } from './server.js';

const listNotes = (notes) => {
  notes.forEach(note => {
    console.log('\n');
    console.log('note:', note.content);
    console.log('id:', note.id);
    console.log('tags:', note.tags.join(', '));
  })
}

yargs(hideBin(process.argv))
  .command(
    'add <note>', 
    'Create a new note', 
    (yargs) => {
    return yargs
        .positional('note', {
            describe: 'The content of the note you want to create',
            type: 'string'
        })
        .option('tags', {
            type: 'array',
            describe: 'Tags to add to the note',
            default: []
        })
  }, async (argv) => {
    const note = await addNote(argv.note, argv.tags);
    console.info('Note added! ID:', note.id);
  })
  .command(
    'all',
    'Get all notes',
    () => {},
    async (argv) => {
      const notes = await getAllNotes();
      listNotes(notes);
    }
  )
  .command(
    'find <filter>',
    'Get matching note',
    (yargs) => {
      return yargs
        .positional('filter', {
          describe: 'The search term to filter note by',
          type: 'string'
        })
    },
    async (argv) => {
      const notes = await findNotes(argv.filter);
      listNotes(notes);
    }
  )
  .command(
    'remove <id>',
    'Remove a note by id',
    (yargs) => {
      return yargs
        .positional('id', {
          describe: 'The id of the note you want to remove',
          type: 'number'
        })
    },
    async (argv) => {
      const id = await removeNote(argv.id);
      console.log(id ? `Note removed: ${id}` : 'Note not found');
    }
  )
  .command(
    'clean',
    'Remove all notes',
    () => {},
    async (argv) => {
      const done = await removeAllNotes();
      console.log(done ? 'All notes removed' : 'Please try again later'); 
    }
  )
  .command(
    'web [port]',
    'Launch website to see notes',
    (yargs) => {
      return yargs
        .positional('port', {
          default: 5000,
          type: 'number',
          describe: 'Port to bind on'
        })
    },
    async (argv) => {
      const notes = await getAllNotes();
      start(notes, argv.port);
    }
  )
  .demandCommand(1)
  .parse()