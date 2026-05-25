// Side-effect import must run before any registry.get() call
import './definitions';

export { formMapRegistry } from './registry';
export type {
  FormFieldOption,
  FormFieldType,
  CatalogSource,
  FormField,
  FormMapDefinition,
  ResolvedFormField,
  ResolvedFormMap,
  WizardCatalogs,
  WizardSelection,
  ChatSuggestion,
} from './types';
