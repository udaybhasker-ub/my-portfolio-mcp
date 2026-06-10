import * as Client from '../db/client.js';
import { evaluateAlerts } from '../alerts/engine.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const alertTools: Tool[] = [
  {
    name: 'list_alerts',
    description: 'Get all alerts, optionally filtered by ticker',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Optional: filter by ticker symbol',
        },
      },
    },
  },
  {
    name: 'add_alert',
    description: 'Create a new alert',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        alertType: {
          type: 'string',
          enum: ['PRICE_ABOVE', 'PRICE_BELOW', 'GAIN_LOSS_PERCENT'],
          description: 'Type of alert',
        },
        threshold: {
          type: 'number',
          description: 'Alert threshold value',
        },
        description: {
          type: 'string',
          description: 'Alert description',
        },
      },
      required: ['ticker', 'alertType', 'threshold', 'description'],
    },
  },
  {
    name: 'update_alert',
    description: 'Update an alert',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Alert ID',
        },
        alertType: {
          type: 'string',
          enum: ['PRICE_ABOVE', 'PRICE_BELOW', 'GAIN_LOSS_PERCENT'],
          description: 'Type of alert',
        },
        threshold: {
          type: 'number',
          description: 'Alert threshold value',
        },
        description: {
          type: 'string',
          description: 'Alert description',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_alert',
    description: 'Delete an alert',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Alert ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_alert_comment',
    description: 'Add a comment to an alert',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'Alert ID',
        },
        text: {
          type: 'string',
          description: 'Comment text',
        },
      },
      required: ['alertId', 'text'],
    },
  },
  {
    name: 'list_alert_comments',
    description: 'Get all comments on an alert',
    inputSchema: {
      type: 'object',
      properties: {
        alertId: {
          type: 'string',
          description: 'Alert ID',
        },
      },
      required: ['alertId'],
    },
  },
  {
    name: 'evaluate_alerts',
    description:
      'Evaluate alerts against live prices from FinMCP and report which are currently triggered, optionally filtered by ticker',
    inputSchema: {
      type: 'object',
      properties: {
        ticker: {
          type: 'string',
          description: 'Optional: filter by ticker symbol',
        },
      },
    },
  },
];

export async function handleAlertTool(
  name: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'list_alerts':
      return Client.listAlerts(params.ticker as string | undefined);

    case 'add_alert':
      return Client.addAlert(
        params.ticker as string,
        params.alertType as 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GAIN_LOSS_PERCENT',
        params.threshold as number,
        params.description as string
      );

    case 'update_alert': {
      const updates: Record<string, unknown> = {};
      if (params.alertType !== undefined) updates.alertType = params.alertType;
      if (params.threshold !== undefined) updates.threshold = params.threshold;
      if (params.description !== undefined) updates.description = params.description;
      return Client.updateAlert(params.id as string, updates);
    }

    case 'delete_alert':
      Client.deleteAlert(params.id as string);
      return { success: true };

    case 'add_alert_comment':
      return Client.addAlertComment(params.alertId as string, params.text as string);

    case 'list_alert_comments':
      return Client.listAlertComments(params.alertId as string);

    case 'evaluate_alerts':
      return evaluateAlerts(params.ticker as string | undefined);

    default:
      throw new Error(`Unknown alert tool: ${name}`);
  }
}
