import { google, drive_v3 } from 'googleapis';
import { getAuthClient } from './oauth.js';

let driveClient: drive_v3.Drive | null = null;

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (!driveClient) {
    const auth = await getAuthClient();
    driveClient = google.drive({ version: 'v3', auth });
  }

  return driveClient;
}

export async function testDriveConnection(): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    await drive.files.list({ pageSize: 1 });
    return true;
  } catch {
    console.error('Failed to connect to Google Drive');
    return false;
  }
}
