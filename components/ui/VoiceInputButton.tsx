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
                className={`p-2 rounded-[10px] transition-all border ${isRecording
                    ? 'text-ko animate-pulse border-ko-border'
                    : 'text-ko border-ko-border hover:bg-ko-dim'
                }`}
                style={isRecording ? { background: 'var(--reddim)' } : undefined}
            >
                {isRecording ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            </button>
            {recognitionError && (
                <p className="text-[10px] text-ko mt-1 font-medium absolute top-full right-0 whitespace-nowrap z-10">
                    Error al escuchar
                </p>
            )}
        </div>
    );
};
