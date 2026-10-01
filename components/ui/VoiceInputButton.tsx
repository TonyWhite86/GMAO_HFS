import React from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
    onTranscript: (transcript: string) => void;
    className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
    onTranscript,
    className = ''
}) => {
    const { isRecording, recognitionError, startRecording } = useSpeechRecognition();

    const handleStart = () => {
        startRecording(onTranscript);
    };

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={handleStart}
                title="Dictar por voz"
                className={`p-2 rounded-xl transition-all ${isRecording
                    ? 'bg-red-100 text-red-600 animate-pulse shadow-md shadow-red-500/30'
                    : 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-800 hover:border-red-500'
                }`}
            >
                {isRecording ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            </button>
            {recognitionError && (
                <p className="text-[10px] text-red-500 mt-1 font-medium absolute top-full right-0 whitespace-nowrap z-10">
                    Error al escuchar
                </p>
            )}
        </div>
    );
};
