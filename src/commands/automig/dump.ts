import {core, flags, SfdxCommand} from '@salesforce/command';
import {AnyJson} from '@salesforce/ts-types';
import {readFile, writeFile} from 'fs-extra';
import * as path from 'path';
import {AutoMigrator, DumpQuery} from 'salesforce-migration-automatic';

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages('sfdx-migration-automatic', 'dump');

export default class Dump extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ sfdx automig:dump --targetusername username@example.com --targetdevhubusername devhub@example.org --objects Opportunity,Case,Account:related,Task:related --outdir ./dump',
  '$ sfdx automig:dump --targetusername username@example.com --targetdevhubusername devhub@example.org --config automig-dump-config.json'
  ];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    config: flags.string({char: 'f', description: messages.getMessage('configFlagDescription')}),
    objects: flags.array({char: 'o', description: messages.getMessage('objectFlagDescription')}),
    outdir: flags.string({char: 'd', description: messages.getMessage('outdirFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    // const name = this.flags.name || 'world';

    interface DumpConfig {
      outDir: string;
      targets: DumpQuery[];
    }

    let config: DumpConfig;
    if (this.flags.config) {
      const configFileName: string = this.flags.config;
      const configDir = path.dirname(configFileName);
      const fileData = await readFile(configFileName, 'utf8');
      config = JSON.parse(fileData) as DumpConfig;
      if (this.flags.outdir) {
        config.outDir = this.flags.outdir;
      } else if (!path.isAbsolute(config.outDir)) {
        config.outDir = path.join(configDir, config.outDir);
      }
    } else if (this.flags.objects) {
      config = {
        outDir: this.flags.outdir || '.',
        targets: this.flags.objects.map(object => ({
          object
        }))
      };
    } else {
      throw new Error('No --config or --objects options are supplied to command arg');
    }

    const conn = this.org.getConnection();
    const am = new AutoMigrator(conn);

    const csvs = await am.dumpAsCSVData(config.targets);
    const filepaths = await Promise.all(
      config.targets.map(async ({ object }, i) => {
        const csv = csvs[i];
        const filename = `${object}.csv`;
        const filepath = path.join(config.outDir, filename);
        await writeFile(filepath, csv, 'utf8');
        return filepath;
      })
    );
    this.ux.log(filepaths.join('\n'));
    return { filepaths };
  }
}
