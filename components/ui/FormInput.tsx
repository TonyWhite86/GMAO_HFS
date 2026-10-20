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
                <label htmlFor={fieldId} className={`block text-xs font-bold mb-2 uppercase tracking-wider ${error ? 'text-ko' : 'text-txt-2'}`}>
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none">
                        {icon}
                    </div>
                )}
                <input id={fieldId}
                    className={`
                        fld-input w-full p-3 rounded-[6px] outline-none font-sans transition-all
                        ${icon ? 'pl-10' : ''}
                        ${error ? 'error' : ''}
                    `}
                    {...props}
                />
            </div>
            {helperText && (
                <p className={`text-[10px] font-bold mt-1 ${error ? 'text-ko animate-pulse' : 'text-txt-3'}`}>
                    {helperText}
                </p>
            )}
        </div>
    );
};
