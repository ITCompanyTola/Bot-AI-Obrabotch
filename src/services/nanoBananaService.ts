import axios from 'axios';
import { Buffer } from 'buffer';
import { Markup } from 'telegraf';
import { config } from '../config';
import { Database } from '../database';
import { PRICES } from '../constants';

const API_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const API_KEY = config.nanoBananaApiKey;

interface TaskResponse {
  code: number;
    message: number;
    data: {
        taskId: string;
    }
}

interface TaskStatusResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
    model: string;
    state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  }
}