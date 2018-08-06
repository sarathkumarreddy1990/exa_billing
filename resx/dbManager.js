const fs = require('fs')
  , path = require('path')
  , spawn = require('child_process').spawn
  , pgConnStringParser = require('pg-connection-string').parse
  // constants
  , VERBOSE = false
  , IS_WINDOWS = process.platform === 'win32'
  , appName = 'EXA DB Manager'
  , psqlFileName = `psql${IS_WINDOWS ? '.exe' : ''}`
  , webConfigFileName = 'web.json'
  , sqlUpdatesFileName = 'migrations.sql'
  , psqlFilePath = IS_WINDOWS ? path.join(__dirname, psqlFileName) :  psqlFileName   // on non windows systems, expect psql to be in PATH
  , webConfigFilePath = path.join(__dirname, '../../cfg', webConfigFileName)
  , sqlUpdatesFilePath = path.join(__dirname, sqlUpdatesFileName)
  ;


/**
 * EXA DB Manager
 *
 * TODO:
 *  - check if backup (pg_dump) is running before running any tasks
 *  - implement DB creation (instead of web install)
 */

// ----------------------------------------------------------------------------
// command functions
let updateCommand = (db) => {
  console.time(`${appName} | migrate`);
  // see: https://www.postgresql.org/docs/current/static/app-psql.html
  var args = [
    '--host', db.host,
    '--port', db.port,
    '--username', db.user,
    '--dbname', db.database,
    '--file', sqlUpdatesFilePath,
    '--no-psqlrc',
    '--set', 'ON_ERROR_STOP=1',
    '--no-password',
    '--quiet',
    '--tuples-only',
    '--echo-errors' // print failed SQL commands to standard error output.
    //'--log-file', path.join(__dirname, '../../../../log', 'dbupdate.log'),
    //'--single-transaction'
  ];
  process.env['PGPASSWORD'] = db.password;
  process.env['PGAPPNAME'] = db.application_name + ':update';

  let lastLine = '';
  console.log(`${appName} | migrate: ${psqlFileName} ${args.join(' ')}`);
  const psql = spawn(psqlFilePath, args);

  //psql.stderr.on('data', (data) => { console.log(`${appName} | stderr: ${data}`); });
  //psql.stderr.on('end',    () => { console.log(`${appName} | stderr end`); });
  //psql.stderr.on('finish', () => { console.log(`${appName} | stderr finish`); });
  //psql.stderr.on('close',  () => { console.log(`${appName} | stderr close`); });

  //psql.stdout.on('data', (data) => { console.log(`${appName} | stdout: ${data}`); });
  //psql.stdout.on('end',    () => { console.log(`${appName} | stdout end`); });
  //psql.stdout.on('finish', () => { console.log(`${appName} | stdout finish`); });
  //psql.stdout.on('close',  () => { console.log(`${appName} | stdout close`); });

  psql.stderr.on('data', (data) => {
    lastLine = '' + data + '';
    //lastLine = line.replace(/\n$/, '');
    //console.log(lastLine);
    if (VERBOSE) { console.log(`${appName} | stderr: ${lastLine}`); }
  });

  psql.on('error', (err) => {
    console.log(`${appName} | failed to start "${psqlFileName}"! Error code: ${err.code}, errno: ${err.errno}, message: "${err.message}"`);
    process.env['PGPASSWORD'] = '';
  });

  // psql.on('close', (code, signal) => {
  //   console.log(`${appName} | CLOSE ${code}`);
  //   process.env['PGPASSWORD'] = '';
  // });

  // see "Exit Status" at: https://www.postgresql.org/docs/current/static/app-psql.html#AEN98634
  psql.on('exit', (code, signal) => {
    if (code == 0) {
      console.log(`${appName} | migration completed successfully`);
    } else {
      console.log(`${appName} | migration failed with exit code: ${code}`);
      console.log(`${appName} | ------vvv last error vvv-----`);
      console.log(lastLine);
      console.log(`${appName} | ------^^^ last error ^^^-----`);
    }
    console.timeEnd(`${appName} | migrate`);
    process.env['PGPASSWORD'] = '';
  });
}
// ----------------------------------------------------------------------------
// sanity checks
if (process.argv.length != 3) {
  console.log(`${appName} | please specify command...`);
  process.exit(1);
}
if (!fs.existsSync(webConfigFilePath)) {
  console.log(`${appName} | could not find EXA's config file "${webConfigFileName}" at "${webConfigFilePath}"...`);
  process.exit(1);
}
if (!fs.existsSync(sqlUpdatesFilePath)) {
  console.log(`${appName} | could not find SQL updates file "${sqlUpdatesFileName}" at "${sqlUpdatesFilePath}"`);
  process.exit(1);
}
// ----------------------------------------------------------------------------
// common config
const webConfig = require(webConfigFilePath);
const dbConfig = pgConnStringParser(webConfig.dbConnectionBilling || webConfig.Connection.conStr);
dbConfig.application_name = 'exa_dbmanager';
// ----------------------------------------------------------------------------
// command execution
if (process.argv[2] === 'migrate') {
  return updateCommand(dbConfig);
} else {
  console.log(`${appName} | please specify a *valid* command...`);
}
