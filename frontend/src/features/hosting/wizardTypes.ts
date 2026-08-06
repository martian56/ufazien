/**
 * The create-website wizard's form.
 *
 * Each of the four steps declared its own copy of this when they were split
 * out, and they drifted: the page's form carries a zip file and a PHP version
 * that the step copies did not know about. One definition, imported by all
 * five.
 */
export interface WizardFormData {
  // Step 1: basic information
  name: string
  subdomain: string
  description: string
  /** "new" to register a subdomain, or "existing" to pick one you own. */
  domainOption: string
  selectedDomainId: string | null

  // Step 2: what kind of site
  website_type: string

  // Step 3: configuration
  phpVersion: string
  environment_variables: { key: string; value: string }[]
  ssl: boolean

  // Step 4: how the files arrive
  deploymentMethod: string
  files: File[]
  git_repository: string
  deployment_branch: string
  zipFile: File | null
}

/** Per-field validation messages, keyed by the field they belong to. */
export type WizardErrors = Record<string, string | undefined>
