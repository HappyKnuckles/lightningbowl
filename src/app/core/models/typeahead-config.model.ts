export interface TypeaheadDisplayField {
  isPrimary?: boolean;
  isSecondary?: boolean;
  key: string;
  label?: string;
}

export interface TypeaheadSearchKey {
  name: string;
  weight: number;
}

export interface TypeaheadConfig<T> {
  apiSearchFn?: (searchTerm: string) => Promise<{ items: T[] }>;
  customDisplayFormatter?: (item: T, fieldKey: string) => string;
  customDisplayLogic?: (item: T) => { cssClass?: string; disabled?: boolean };
  displayFields: TypeaheadDisplayField[];
  identifierKey: keyof T;
  imageShape?: 'round' | 'rect';
  imageUrlGenerator?: (item: T) => string;
  loadingText: string;
  maxSelections?: number;
  noDataText?: string;
  searchKeys: TypeaheadSearchKey[];
  searchMode: 'local' | 'api';
  searchPlaceholder: string;
  showImages?: boolean;
  title: string;
  valueKey?: keyof T;
}
