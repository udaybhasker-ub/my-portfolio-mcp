import { getDriveClient } from './auth.js';
import { config_ } from '../config.js';
import { createReadStream, existsSync } from 'fs';
import { resolve } from 'path';
import cron from 'node-cron';

const BACKUPS_FOLDER_NAME = 'backups';
const BACKUP_RETENTION_DAYS = 7;

let backupsFolderId: string | null = null;

async function getBackupsFolderId(): Promise<string> {
  if (backupsFolderId) {
    return backupsFolderId;
  }

  const drive = await getDriveClient();

  const files = await drive.files.list({
    q: `'${config_.driveFolderId}' in parents and name='${BACKUPS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    pageSize: 1,
    fields: 'files(id)',
  });

  if (files.data.files && files.data.files.length > 0) {
    backupsFolderId = files.data.files[0].id || null;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: BACKUPS_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [config_.driveFolderId],
      },
      fields: 'id',
    });
    backupsFolderId = folder.data.id || null;
  }

  if (!backupsFolderId) {
    throw new Error('Failed to get or create backups folder');
  }

  return backupsFolderId;
}

export async function createDailyBackup(): Promise<void> {
  try {
    const dbPath = resolve(config_.databasePath);

    if (!existsSync(dbPath)) {
      console.log('Database file does not exist, skipping backup');
      return;
    }

    const drive = await getDriveClient();
    const backupsFolderIdValue = await getBackupsFolderId();
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFileName = `portfolio_data_${timestamp}.db`;

    const fileContent = createReadStream(dbPath);

    const files = await drive.files.list({
      q: `'${backupsFolderIdValue}' in parents and name='${backupFileName}' and trashed=false`,
      pageSize: 1,
      fields: 'files(id)',
    });

    if (files.data.files && files.data.files.length > 0) {
      const fileId = files.data.files[0].id;
      if (fileId) {
        await drive.files.update({
          fileId,
          media: { body: fileContent },
        });
        console.log(`Updated backup ${backupFileName}`);
      }
    } else {
      await drive.files.create({
        requestBody: {
          name: backupFileName,
          parents: [backupsFolderIdValue],
        },
        media: { body: fileContent },
      });
      console.log(`Created backup ${backupFileName}`);
    }

    await pruneOldBackups(backupsFolderIdValue);
  } catch (error) {
    console.error('Error creating daily backup:', error);
  }
}

async function pruneOldBackups(backupsFolderIdValue: string): Promise<void> {
  try {
    const drive = await getDriveClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

    const files = await drive.files.list({
      q: `'${backupsFolderIdValue}' in parents and trashed=false`,
      pageSize: 100,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
    });

    if (!files.data.files) {
      return;
    }

    for (const file of files.data.files) {
      if (!file.id || !file.createdTime) {
        continue;
      }

      const fileDate = new Date(file.createdTime);
      if (fileDate < cutoffDate) {
        await drive.files.delete({ fileId: file.id });
        console.log(`Deleted old backup ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Error pruning old backups:', error);
  }
}

export async function scheduleBackups(): Promise<void> {
  const cronExpression = convertTimeUtcToCron(config_.backupTimeUtc);

  cron.schedule(cronExpression, async () => {
    console.log(`Running scheduled backup at ${new Date().toISOString()}`);
    await createDailyBackup();
  });

  console.log(`Backup scheduled for ${config_.backupTimeUtc} UTC`);
}

function convertTimeUtcToCron(timeUtc: string): string {
  const [hours, minutes] = timeUtc.split(':');
  return `${minutes} ${hours} * * *`;
}
