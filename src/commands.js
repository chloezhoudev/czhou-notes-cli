import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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
  }, (argv) => {
    console.log('Note: ', argv.note);
    console.log('Tags: ', argv.tags);
  })
  .command(
    'all',
    'Get all notes',
    () => {},
    (argv) => {
      console.log('Getting all notes...');
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
    (argv) => {
      console.log('Filtering note by: ', argv.filter);
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
    (argv) => {
      console.log('Removing note by id: ', argv.id);
    }
  )
  .command(
    'clean',
    'Remove all notes',
    () => {},
    (argv) => {
      console.log('Removing all notes...');
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
    (argv) => {
      console.log('Port to bind on is: ', argv.port);
    }
  )
  .demandCommand(1)
  .parse()