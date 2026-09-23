export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PlatformPref = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'other';
export type NichePref =
  | 'comedy'
  | 'education'
  | 'lifestyle'
  | 'fitness'
  | 'beauty'
  | 'food'
  | 'gaming'
  | 'business'
  | 'tech'
  | 'other';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type GrowthGoal = 'followers' | 'engagement' | 'views' | 'sales' | 'brand_awareness';

export type AnalysisStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export type SubscriptionStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';
export type PlanType = 'none' | 'trial' | 'monthly' | 'annual';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  platform: PlatformPref | null;
  niche: NichePref | null;
  experience: ExperienceLevel | null;
  growth_goal: GrowthGoal | null;
  onboarding_completed: boolean;
  ai_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  user_id: string;
  status: AnalysisStatus;
  storage_path: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  platform_hint: string | null;
  result: Json | null;
  error_message: string | null;
  video_expires_at: string | null;
  video_deleted_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AnalysisEvent {
  id: string;
  analysis_id: string;
  status: AnalysisStatus;
  message: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan: PlanType;
  product_id: string | null;
  rc_app_user_id: string | null;
  entitlement_active: boolean;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  updated_at: string;
  created_at: string;
}

export interface Usage {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  analyses_used: number;
  plan: PlanType;
  updated_at: string;
}

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, Partial<Profile> & { id: string }>;
      analyses: TableDef<Analysis, Partial<Analysis> & { user_id: string }>;
      analysis_events: TableDef<
        AnalysisEvent,
        Partial<AnalysisEvent> & { analysis_id: string; status: AnalysisStatus }
      >;
      subscriptions: TableDef<Subscription, Partial<Subscription> & { user_id: string }>;
      usage: TableDef<
        Usage,
        Partial<Usage> & { user_id: string; period_start: string; period_end: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      platform_pref: PlatformPref;
      niche_pref: NichePref;
      experience_level: ExperienceLevel;
      growth_goal: GrowthGoal;
      analysis_status: AnalysisStatus;
      subscription_status: SubscriptionStatus;
      plan_type: PlanType;
    };
    CompositeTypes: Record<string, never>;
  };
}
