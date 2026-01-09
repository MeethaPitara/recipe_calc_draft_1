// Simple batch logging for training data collection
export interface BatchLog {
  id: string;
  timestamp: string;
  recipe: { [key: string]: number };
  productType: string;
  machineType: 'batch' | 'continuous';
  
  // Lab measurements
  mixBrix?: number;
  pH?: number;
  viscosity?: string;
  
  // Process data
  ageTimeHours?: number;
  drawTempC?: number;
  overrunPct?: number;
  
  // Output quality
  scoopTempC?: number;
  hardnessScore?: number; // 1-10 scale
  meltdownMinutes?: number;
  panelScore?: number; // 1-10 scale
  
  notes?: string;
}

const BATCH_LOGS_KEY = 'mp.batch_logs';

export function logBatch(log: Omit<BatchLog, 'id' | 'timestamp'>): BatchLog {
  const fullLog: BatchLog = {
    ...log,
    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString()
  };
  
  const existing = getBatchLogs();
  existing.push(fullLog);
  
  // Keep only last 100 logs
  const trimmed = existing.slice(-100);
  localStorage.setItem(BATCH_LOGS_KEY, JSON.stringify(trimmed));
  
  return fullLog;
}

export function getBatchLogs(): BatchLog[] {
  try {
    return JSON.parse(localStorage.getItem(BATCH_LOGS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function exportBatchLogs(): string {
  const logs = getBatchLogs();
  const csv = [
    'Timestamp,Recipe,Product Type,Machine,Draw Temp,Overrun %,Scoop Temp,Hardness,Panel Score,Notes',
    ...logs.map(log => [
      log.timestamp,
      JSON.stringify(log.recipe).replace(/,/g, ';'),
      log.productType,
      log.machineType,
      log.drawTempC || '',
      log.overrunPct || '',
      log.scoopTempC || '',
      log.hardnessScore || '',
      log.panelScore || '',
      (log.notes || '').replace(/,/g, ';')
    ].join(','))
  ].join('\n');
  
  return csv;
}
