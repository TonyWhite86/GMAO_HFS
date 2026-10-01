import React from 'react';

interface Option {
    value: string | number;
    label: string;
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: Option[];
    error?: boolean;
    helperText?: string;
    icon?: React.ReactNode;
}

export const FormSelect = ({ label, options, error, helperText, icon, className = '', ...props }: FormSelectProps) => {
    const generatedId = React.useId();
    const fieldId = props.id || generatedId;
    return (
        <div className={className}>
            {label && (
                <label htmlFor={fieldId} className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        {icon}
                    </div>
                )}
                <select id={fieldId}
                    className={`
                        w-full p-3 bg-white dark:bg-slate-700 border rounded-xl 
                        text-slate-900 dark:text-white outline-none font-sans transition-all appearance-none
                        ${icon ? 'pl-10' : ''}
                        ${error
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                        }
                    `}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
            {helperText && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{helperText}</p>
            )}
        </div>
    );
};
