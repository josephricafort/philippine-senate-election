// GA4 event tracking — thin wrapper around gtag so call sites stay typed and
// consent/availability checks live in one place instead of being repeated at every call site.

type GtagEventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEvent =
  | { name: 'select_candidate'; params: {
      candidate_id: string; candidate_name: string;
      selection_source: 'search' | 'leaderboard_row' | 'year_pill' | 'suggestion_chip' | 'url_param';
      year: number;
    } }
  | { name: 'select_year'; params: {
      year: number; previous_year: number;
      source: 'year_selector' | 'candidate_pill';
    } }
  | { name: 'select_metric'; params: {
      metric: 'rank' | 'vote_share' | 'votes' | 'swing'; previous_metric: string;
    } }
  | { name: 'search_candidate'; params: { query_length: number; result_count: number } }
  | { name: 'search_no_results'; params: { query_length: number } }
  | { name: 'view_candidate_trend'; params: { candidate_id: string; years_shown: number } }
  | { name: 'map_interact'; params: {
      interaction_type: 'pan' | 'zoom' | 'drag'; candidate_id: string; year: number;
    } }
  | { name: 'map_hover_municipality'; params: { has_data: boolean; metric: string } }
  | { name: 'map_reset_view'; params: Record<string, never> }
  | { name: 'view_top_table'; params: {
      table_type: 'municipalities' | 'provinces'; candidate_id: string; year: number;
    } }
  | { name: 'switch_mobile_tab'; params: { tab_name: string } }
  | { name: 'switch_profile_tab'; params: { tab_name: string } }
  | { name: 'select_swing_province'; params: { province: string; candidate_id: string } }
  | { name: 'select_swing_year_pair'; params: { year_a: number; year_b: number } }
  | { name: 'click_info_menu'; params: { link_target: string } }
  | { name: 'click_share'; params: { candidate_id: string; method: 'web_share' | 'copy_link' | 'platform_facebook' | 'platform_messenger' | 'platform_x' } }
  | { name: 'no_data_for_candidate'; params: { candidate_id: string; year: number } }
  | { name: 'data_fetch_error'; params: { resource: string; error_type: string } };

export function trackEvent<E extends AnalyticsEvent>(name: E['name'], params: E['params']): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params as GtagEventParams);
}
