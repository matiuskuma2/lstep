// === V2 Types (Proposal-First) ===

export type IntentName =
  | 'create_step_scenario'
  | 'edit_step_scenario'
  | 'create_tracking_link'
  | 'set_conversion_point'
  | 'show_report'
  | 'general_question'
  | 'unknown';

export interface ProposalStep {
  step_order: number;
  delay_minutes: number;
  message_content: string;
  goal_label: string;
}

export interface ProposalScenario {
  name: string;
  trigger_type: string;
  steps: ProposalStep[];
}

export interface ProposalEntryRoute {
  name: string;
  code: string;
}

export interface ProposalTrackedLink {
  destination_url: string;
  campaign_label: string;
  step_order: number;
}

export interface ProposalConversion {
  name: string;
  code: string;
}

export interface Proposal {
  summary: string;
  scenario?: ProposalScenario;
  entry_route?: ProposalEntryRoute;
  tracked_link?: ProposalTrackedLink;
  conversion?: ProposalConversion;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  message: string;
  context?: {
    line_account_id?: string;
    tenant_id?: string;
  };
  history?: ChatMessage[];
  bot_id?: string;
}

export interface AiChatResponse {
  intent: IntentName;
  confidence: number;
  proposal: Proposal | null;
  questions: string[];
  is_ready: boolean;
  display_message: string;
  raw_message?: string;
}

// === V1 Types (Legacy, kept for backward compatibility) ===

export interface SlotValue {
  name: string;
  value: string | number | boolean | null;
  source: 'extracted' | 'default' | 'context';
}

export interface MissingSlot {
  name: string;
  description: string;
  ask_question: string;
}

export interface PlanAction {
  type: string;
  description: string;
  params?: Record<string, unknown>;
}

export interface AiChatRequestV1 {
  message: string;
  context?: {
    line_account_id?: string;
  };
  history?: ChatMessage[];
  accumulated_slots?: SlotValue[];
  bot_id?: string;
  knowledge_ids?: string[];
}

export interface AiChatResponseV1 {
  intent: IntentName;
  confidence: number;
  slots: SlotValue[];
  missing_slots: MissingSlot[];
  plan: {
    description: string;
    actions: PlanAction[];
  };
  requires_confirmation: boolean;
  is_complete: boolean;
  raw_message: string;
}
