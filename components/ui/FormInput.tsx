import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: boolean;
    helperText?: string;
    icon?: React.ReactNode;
}

export const FormInput = ({ label, error, helperText, icon, className = '', ...props }: FormInputProps) => {
    const generatedId = React.useId();
    const fieldId = props.id || generatedId;
    return (
        <div className={className}>
            {label && (
                <label htmlFor={fieldId} className={`block text-xs font-bold mb-2 uppercase tracking-wider ${error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        {icon}
                    </div>
                )}
                <input id={fieldId}
                    className={`
                        w-full p-3 bg-white dark:bg-slate-700 border rounded-xl 
                        text-slate-900 dark:text-white outline-none font-sans transition-all
                        ${icon ? 'pl-10' : ''}
                        ${error
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20 ring-2 ring-red-500/10'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                        }
                    `}
                    {...props}
                />
            </div>
            {helperText && (
                <p className={`text-[10px] font-bold mt-1 ${error ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                    {helperText}
                </p>
            )}
        </div>
    );
};
