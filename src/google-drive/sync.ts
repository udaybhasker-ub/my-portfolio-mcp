import { getDriveClient } from './auth.js';
import { config_ } from '../config.js';
import { createReadStream, createWriteStream, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

const DB_FILE_NAME = 'portfolio_data.db';

export async function uploadDatabaseToDrive(): Promise<void> {
  try {
    const drive = await getDriveClient();
    const dbPath = resolve(config_.databasePath);

    if (!existsSync(dbPath)) {
      console.log('Database file does not exist, skipping upload');
      return;
    }

    const files = await drive.files.list({
      q: `'${config_.driveFolderId}' in parents and name='${DB_FILE_NAME}' and trashed=false`,
      pageSize: 1,
      fields: 'files(id)',
    });

    const fileContent = createReadStream(dbPath);
    let fileId: string | null | undefined;

    if (files.data.files && files.data.files.length > 0) {
      fileId = files.data.files[0].id;
    }

    if (fileId && fileId !== null) {
      await drive.files.update({
        fileId,
        media: { body: fileContent },
      });
      console.log(`Updated ${DB_FILE_NAME} on Drive`);
    } else {
      await drive.files.create({
        requestBody: {
          name: DB_FILE_NAME,
          parents: [config_.driveFolderId],
        },
        media: { body: fileContent },
      });
      console.log(`Uploaded ${DB_FILE_NAME} to Drive`);
    }
  } catch (error) {
    console.error('Error uploading database to Drive:', error);
  }
}

export async function downloadDatabaseFromDrive(): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    const dbPath = resolve(config_.databasePath);

    const files = await drive.files.list({
      q: `'${config_.driveFolderId}' in parents and name='${DB_FILE_NAME}' and trashed=false`,
      pageSize: 1,
      fields: 'files(id)',
    });

    if (!files.data.files || files.data.files.length === 0) {
      console.log('No database file found on Drive');
      return false;
    }

    const fileId = files.data.files[0].id;
    if (!fileId) {
      return false;
    }

    const dest = createWriteStream(dbPath);
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    await pipelineAsync(res.data as NodeJS.ReadableStream, dest);
    console.log(`Downloaded ${DB_FILE_NAME} from Drive`);
    return true;
  } catch (error) {
    console.error('Error downloading database from Drive:', error);
    return false;
  }
}

export async function compareLocalAndDriveTimestamps(): Promise<'local' | 'drive' | 'same'> {
  try {
    const drive = await getDriveClient();
    const dbPath = resolve(config_.databasePath);

    if (!existsSync(dbPath)) {
      return 'drive';
    }

    const files = await drive.files.list({
      q: `'${config_.driveFolderId}' in parents and name='${DB_FILE_NAME}' and trashed=false`,
      pageSize: 1,
      fields: 'files(id, modifiedTime)',
    });

    if (!files.data.files || files.data.files.length === 0) {
      return 'local';
    }

    const file = files.data.files[0];
    if (!file.modifiedTime) {
      return 'local';
    }

    const driveTime = new Date(file.modifiedTime).getTime();
    const stats = statSync(dbPath);
    const localTime = stats.mtimeMs;

    if (localTime > driveTime) {
      return 'local';
    } else if (driveTime > localTime) {
      return 'drive';
    } else {
      return 'same';
    }
  } catch (error) {
    console.error('Error comparing timestamps:', error);
    return 'local';
  }
}

export async function ensureDatabaseSynced(): Promise<void> {
  const comparison = await compareLocalAndDriveTimestamps();

  if (comparison === 'drive') {
    const success = await downloadDatabaseFromDrive();
    if (!success) {
      console.warn('Failed to download database from Drive, will use local copy');
    }
  }
}
