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
                <label htmlFor={fieldId} className={`block text-xs font-bold mb-2 uppercase tracking-wider ${error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {label}
                </label>
            )}
            <textarea id={fieldId}
                className={`
                    w-full p-3 bg-white dark:bg-slate-700 border rounded-xl 
                    text-slate-900 dark:text-white outline-none font-sans transition-all resize-none
                    ${error
                        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-2 ring-red-500/10'
                        : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                    }
                `}
                {...props}
            />
            {helperText && (
                <p className={`text-[10px] font-bold mt-1 ${error ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                    {helperText}
                </p>
            )}
        </div>
    );
};
