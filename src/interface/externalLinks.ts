/**
 * Input payload used to create a new external link.
 */
// interface CreateExternalLinkInput {
//   title: string;
//   url?: string;
//   is_active?: boolean;
// }

/**
 * Represents an external link record stored in the database.
 */
export interface ExternalLink {
  id: string;          // UUID
  title: string;
  url: string | null;
  is_active: boolean;
}