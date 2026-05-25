import type { FormMapDefinition } from './types';

class FormMapRegistry {
  private readonly forms = new Map<string, FormMapDefinition>();

  register(form: FormMapDefinition): void {
    this.forms.set(form.formId, form);
  }

  get(formId: string): FormMapDefinition | undefined {
    return this.forms.get(formId);
  }

  list(): FormMapDefinition[] {
    return Array.from(this.forms.values());
  }
}

export const formMapRegistry = new FormMapRegistry();
