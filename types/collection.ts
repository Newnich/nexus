export type CollectionType = "manual" | "auto" | "query";
export type CollectionVisibility = "private" | "team" | "public";

export interface CollectionRule {
  field: "type" | "tag" | "category" | "domain" | "date_added";
  operator: "equals" | "contains" | "before" | "after" | "gt" | "lt";
  value: string;
}

export interface CollectionQuery {
  naturalLanguageQuery?: string;
  filters?: CollectionRule[];
  sortBy?: "date" | "title" | "relevance" | "type";
  sortOrder?: "asc" | "desc";
  autoUpdate: boolean;
}

export interface CollectionAI {
  description?: string;
  suggestedItems?: string[];
  relatedCollections?: string[];
  weeklyDigest?: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: CollectionType;
  icon?: string;
  color?: string;
  parentId?: string;
  itemCount: number;
  items?: string[];
  rules?: CollectionRule[];
  query?: CollectionQuery;
  aiData?: CollectionAI;
  collaborators?: string[];
  visibility: CollectionVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  type?: CollectionType;
  icon?: string;
  color?: string;
  parentId?: string;
  rules?: CollectionRule[];
  query?: CollectionQuery;
  visibility?: CollectionVisibility;
}

export interface UpdateCollectionInput extends Partial<CreateCollectionInput> {
  itemCount?: number;
}
