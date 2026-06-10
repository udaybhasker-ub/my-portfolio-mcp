interface Config {
  nodeEnv: string;
  driveFolderId: string;
  databasePath: string;
  databaseSyncIntervalMinutes: number;
  backupTimeUtc: string;
  port: number;
  mcpAuthToken: string;
}

function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const driveFolderId = process.env.DRIVE_FOLDER_ID || '';
  const databasePath = process.env.DATABASE_PATH || './portfolio_data.db';
  const databaseSyncIntervalMinutes = parseInt(
    process.env.DATABASE_SYNC_INTERVAL_MINUTES || '1',
    10
  );
  const backupTimeUtc = process.env.BACKUP_TIME_UTC || '23:00';
  const port = parseInt(process.env.PORT || '8000', 10);
  const mcpAuthToken = process.env.MCP_AUTH_TOKEN || '';

  return {
    nodeEnv,
    driveFolderId,
    databasePath,
    databaseSyncIntervalMinutes,
    backupTimeUtc,
    port,
    mcpAuthToken,
  };
}

export const config_ = loadConfig();
