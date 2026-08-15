export interface LogEvent {
  event_id: string;
  analyst: string;
  ticket_id: string;
  event_type: string;
  reason_close: string;
  escalation: string;
  link_alert: string;
  event_name: string;
  magnitude: string;
  tanggal: string;
  waktu: string;
  ticket_date: string;
  ticket_time: string;
  soc_response_time: string;
  user_date: string;
  user_time: string;
  user_response_time: string;
  action: string;
  event_status: string;
  traffic_flow: string;
  src_ip: string;
  src_country: string;
  dst_ip: string;
  dst_port: string;
  dst_country: string;
  app_access: string;
  user_agent: string;
  request_server: string;
  url: string;
  query: string;
  note: string;
  severity?: string;
  sev_magnitude?: string;
  waktu_deteksi?: string;
}

export interface ProcessResult {
  success: boolean;
  message: string;
  instansi: string;
  shift: string;
  processLog: string[];
  resultFiles: {
    name: string;
    path: string;
    downloadUrl: string;
    type: 'excel' | 'text' | 'wa';
    content?: string;
    base64?: string;
  }[];
  aalPivotData?: {
    ip: string;
    subtotal: number;
    domains: { domain: string; count: number }[];
  }[];
  aalRawData?: any[];
  medikaPivotData?: {
    rows: { ip: string; count: number }[];
    grandTotal: number;
  };
  sectionBText?: string;
}

export interface TemplateInfo {
  name: string;
  instansi: string;
  formattedName: string;
}

export interface TemplatesList {
  [instansi: string]: string[];
}
