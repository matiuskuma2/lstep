export type IntentName =
  | 'create_step_scenario'
  | 'edit_step_scenario'
  | 'create_tracking_link'
  | 'set_conversion_point'
  | 'publish_internal_lp_plan'
  | 'generate_external_lp_tracking_guide'
  | 'show_funnel_report'
  | 'unknown';

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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  message: string;
  context?: {
    line_account_id?: string;
  };
  history?: ChatMessage[];
  accumulated_slots?: SlotValue[];
  bot_id?: string;
  knowledge_ids?: string[];
}

export interface AiChatResponse {
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
