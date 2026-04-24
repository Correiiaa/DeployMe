import type { ApplicationRow } from '../components/ApplicationTable'

export const DEFAULT_APPLICATIONS: ApplicationRow[] = [
  {
    id: 'my-first-app',
    name: 'My First App',
    role: 'Software Engineer',
    status: 'Applied',
    dateApplied: '2024-06-01',
    notes: 'Initial application',
    cvPath: undefined
  }
]
