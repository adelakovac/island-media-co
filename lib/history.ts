export interface HistoryEntry {
  at: string;
  actor: string;
  action: string;
  note: string | null;
}

export function appendHistory(historyJson: string, entry: HistoryEntry): string {
  const history = JSON.parse(historyJson) as HistoryEntry[];
  history.push(entry);
  return JSON.stringify(history);
}

export function newHistory(entry: HistoryEntry): string {
  return JSON.stringify([entry]);
}
