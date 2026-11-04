import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, optional, leftIcon, rightIcon, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={`input-group ${className}`}>
        {label && (
          <label htmlFor={inputId} className="input-label text-label">
            {label}
            {optional && <span className="input-optional"> (opsional)</span>}
            {!optional && <span className="input-required">*</span>}
          </label>
        )}
        <div className="input-wrapper">
          {leftIcon && <div className="input-icon input-icon-left">{leftIcon}</div>}
          <input
            id={inputId}
            ref={ref}
            className={`input-field ${error ? 'input-error' : ''} ${leftIcon ? 'has-left-icon' : ''} ${rightIcon ? 'has-right-icon' : ''}`}
            {...props}
          />
          {rightIcon && <div className="input-icon input-icon-right">{rightIcon}</div>}
        </div>
        {error && <div className="input-error-msg">{error}</div>}
        {hint && !error && <div className="input-hint">{hint}</div>}
      </div>
    );
  }
);

Input.displayName = 'Input';
