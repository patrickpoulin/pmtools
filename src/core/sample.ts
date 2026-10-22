import type { Backlog } from './types'
import { defaultCriteria } from '../methods/weighted/scoring'

export function emptyBacklog(): Backlog {
  return {
    name: 'Untitled backlog',
    author: '',
    items: [],
    notes: {},
    settings: {
      impactEffort: { effortMid: 5.5, impactMid: 5.5 },
      moscow: { capacity: null },
      weighted: { criteria: defaultCriteria() },
    },
  }
}

type Row = [string, string, string[], number, number, number, number, number, number, number, number[]]

const rows: Row[] = [
  // title, description, tags, IE impact, IE effort, reach, RICE impact, confidence, person-months,
  // MoSCoW (4 Must … 1 Won't), Weighted [customer value, strategic fit, revenue, effort, risk] on 1–5
  ['Single sign-on (SAML)', 'Enterprise customers keep asking for Okta / Azure AD login.', ['enterprise', 'security'], 8, 7, 1200, 2, 80, 4, 4, [3, 5, 5, 4, 3]],
  ['Onboarding checklist', 'Guide new users to their first report in under 5 minutes.', ['activation'], 8, 3, 9000, 1, 80, 1.5, 4, [5, 4, 3, 2, 1]],
  ['Dark mode', 'Frequently requested on the feedback board.', ['ux'], 4, 3, 6000, 0.5, 100, 1, 2, [2, 1, 1, 2, 1]],
  ['CSV bulk import', 'Let teams migrate from spreadsheets in one step.', ['activation', 'data'], 7, 4, 3500, 2, 80, 2, 3, [4, 3, 3, 2, 2]],
  ['Rebuild billing engine', 'Replace the legacy billing service to support usage pricing.', ['revenue', 'platform'], 6, 9, 800, 2, 50, 8, 1, [2, 4, 4, 5, 5]],
  ['Slack notifications', 'Post alerts to a Slack channel when thresholds are hit.', ['integrations'], 6, 3, 4000, 1, 100, 1, 3, [3, 2, 2, 1, 1]],
  ['Custom report themes', 'Brand colors and logos on exported reports.', ['enterprise'], 3, 6, 700, 0.5, 50, 2, 1, [2, 2, 2, 3, 2]],
  ['Fix slow dashboard load', 'P95 load is 6s for accounts with >50 widgets.', ['performance'], 7, 2, 2500, 1, 100, 0.5, 4, [4, 3, 2, 1, 1]],
  ['Mobile app', 'Native iOS / Android app for viewing dashboards.', ['mobile'], 5, 10, 3000, 1, 50, 12, 1, [3, 2, 2, 5, 4]],
  ['Audit log export', 'Required by two prospects in security review.', ['enterprise', 'security'], 4, 2, 300, 2, 80, 0.5, 3, [2, 4, 4, 1, 1]],
]

export function sampleBacklog(): Backlog {
  return {
    ...emptyBacklog(),
    name: 'Q3 Analytics Roadmap (sample)',
    author: 'Product Team',
    // One quarter for a team of four: 4 people × 3 months, in person-months like the effort estimates.
    settings: { ...emptyBacklog().settings, moscow: { capacity: 12 } },
    items: rows.map(([title, description, tags, ieImpact, ieEffort, reach, impact, confidence, effort, category, [value, strategy, revenue, wEffort, risk]], i) => ({
      id: `sample-${i + 1}`,
      title,
      description,
      tags,
      scores: {
        'impact-effort': { impact: ieImpact, effort: ieEffort },
        rice: { reach, impact, confidence, effort },
        // MoSCoW effort reuses the RICE estimate, in person-months.
        moscow: { category, effort },
        weighted: { value, strategy, revenue, effort: wEffort, risk },
      },
    })),
  }
}
