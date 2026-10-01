import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface UseSpeechRecognitionReturn {
    isSupported: boolean;
    isRecording: boolean;
    recognitionError: string | null;
    startRecording: (onResult: (transcript: string) => void) => void;
    stopRecording: () => void;
}

export const useSpeechRecognition = (lang: string = 'es-ES'): UseSpeechRecognitionReturn => {
    const [isRecording, setIsRecording] = useState(false);
    const [recognitionError, setRecognitionError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = lang;
            setIsSupported(true);
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, [lang]);

    const startRecording = useCallback((onResult: (transcript: string) => void) => {
        if (!recognitionRef.current) {
            toast.error('Tu navegador no soporta reconocimiento de voz');
            return;
        }

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
            setIsRecording(false);
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setRecognitionError(event.error);
            setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
            setIsRecording(false);
        };

        try {
            setIsRecording(true);
            setRecognitionError(null);
            recognitionRef.current.start();
        } catch (err) {
            console.error('Failed to start recognition', err);
            setIsRecording(false);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    return {
        isSupported,
        isRecording,
        recognitionError,
        startRecording,
        stopRecording
    };
};
