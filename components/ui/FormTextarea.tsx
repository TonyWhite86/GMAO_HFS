import React from 'react';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: boolean;
    helperText?: string;
}

export const FormTextarea = ({ label, error, helperText, className = '', ...props }: FormTextareaProps) => {
    const generatedId = React.useId();
    const fieldId = props.id || generatedId;
    return (
        <div className={className}>
            {label && (
                <label htmlFor={fieldId} className={`block text-xs font-bold mb-2 uppercase tracking-wider ${error ? 'text-ko' : 'text-txt-2'}`}>
                    {label}
                </label>
            )}
            <textarea id={fieldId}
                className={`
                    fld-input w-full p-3 rounded-[6px] outline-none font-sans transition-all resize-none
                    ${error ? 'error' : ''}
                `}
                {...props}
            />
            {helperText && (
                <p className={`text-[10px] font-bold mt-1 ${error ? 'text-ko animate-pulse' : 'text-txt-3'}`}>
                    {helperText}
                </p>
            )}
        </div>
    );
};
