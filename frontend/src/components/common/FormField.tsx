import React from 'react';
import '../../styles/components.css';

type BaseFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

type InputFieldProps = BaseFieldProps & {
  as?: 'input';
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

type TextareaFieldProps = BaseFieldProps & {
  as: 'textarea';
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'>;

type SelectFieldProps = BaseFieldProps & {
  as: 'select';
  children: React.ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'>;

export type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function FormField(props: FormFieldProps) {
  const {
    id,
    label,
    error,
    hint,
    required = false,
    className = '',
    as = 'input',
    ...controlProps
  } = props;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <label className={`form-field ${error ? 'form-field--error' : ''} ${className}`.trim()} htmlFor={id}>
      <span className="form-field__label">
        {label}
        {required && <span className="form-field__required">*</span>}
      </span>

      {as === 'textarea' ? (
        <textarea
          id={id}
          className="form-field__control form-field__control--textarea"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...(controlProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : as === 'select' ? (
        <select
          id={id}
          className="form-field__control"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...(controlProps as React.SelectHTMLAttributes<HTMLSelectElement>)}
        />
      ) : (
        <input
          id={id}
          className="form-field__control"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...(controlProps as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error ? (
        <span id={`${id}-error`} className="form-field__message form-field__message--error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="form-field__message">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export default FormField;
