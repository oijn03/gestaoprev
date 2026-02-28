import { LucideIcon } from "lucide-react";

export interface CaseRequest {
    id: string;
    case_id: string;
    status: string;
    description: string | null;
    deadline: string | null;
    created_at: string;
    type: string;
    cancel_requested_by: string | null;
    report_forecast_date: string | null;
    cases: {
        id: string;
        patient_name: string;
        patient_cpf: string | null;
        process_number: string | null;
        title: string;
        description: string | null;
    } | null;
}

export interface Document {
    id: string;
    file_name: string;
    file_path: string;
    description: string | null;
    created_at: string;
}

export interface TimelineEvent {
    id: string;
    type: 'creation' | 'request' | 'acceptance' | 'document' | 'report';
    title: string;
    description: string;
    date: string;
    icon: LucideIcon;
}

export interface CaseMessage {
    id: string;
    case_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
}

export interface Report {
    id: string;
    case_request_id: string;
    author_id: string;
    title: string;
    type: string;
    status: string;
    file_path: string | null;
    created_at: string;
}
