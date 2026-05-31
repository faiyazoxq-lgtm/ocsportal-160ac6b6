export type DmMessageType = "text" | "image" | "file" | "voice_note" | "system";

export interface UserContactProfile {
  profile_id: string;
  avatar_url: string | null;
  job_title: string | null;
  capability_summary: string | null;
  bio: string | null;
  telegram_username: string | null;
  telegram_chat_id: string | null;
  telegram_linked_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactDirectoryEntry {
  profile_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: "dispatcher" | "engineer" | "boss";
  is_active: boolean;
  avatar_url: string | null;
  job_title: string | null;
  capability_summary: string | null;
  telegram_linked: boolean;
  telegram_username: string | null;
  engineer?: {
    id: string;
    primary_trade: string | null;
    trade_tags: string[];
    certification_tags: string[];
    covered_postcode_zones: string[];
  } | null;
}

export interface DirectMessageThread {
  id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DirectMessageParticipant {
  id: string;
  thread_id: string;
  profile_id: string;
  joined_at: string;
  last_read_at: string | null;
}

export interface DirectMessage {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  message_type: DmMessageType;
  body_text: string | null;
  metadata_json: Record<string, unknown>;
  sent_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface DirectMessageFile {
  id: string;
  message_id: string;
  file_kind: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  uploaded_at: string;
}

export interface ThreadSummary {
  thread: DirectMessageThread;
  other: ContactDirectoryEntry | null;
  last_message: DirectMessage | null;
  unread_count: number;
}