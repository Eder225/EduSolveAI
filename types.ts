
export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  size: number;
}

export interface Solution {
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  SOLVED = 'SOLVED',
  ERROR = 'ERROR'
}
