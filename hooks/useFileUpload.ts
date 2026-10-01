import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Attachment } from '../types';
import { compressImage } from '../utils/compressImage';
import { toast } from 'sonner';

interface UseFileUploadReturn {
    isUploading: boolean;
    uploadFiles: (files: FileList | File[], bucket: string, pathPrefix?: string) => Promise<Attachment[]>;
    removeFile: (url: string, bucket: string) => Promise<void>;
    extractPathFromUrl: (url: string, bucket: string) => string | null;
}

export const useFileUpload = (): UseFileUploadReturn => {
    const [isUploading, setIsUploading] = useState(false);

    /**
     * Uploads multiple files to Supabase storage.
     * Handles image compression automatically.
     */
    const uploadFiles = async (
        files: FileList | File[],
        bucket: string,
        pathPrefix: string = ''
    ): Promise<Attachment[]> => {
        setIsUploading(true);
        const uploadedAttachments: Attachment[] = [];
        const fileArray = Array.from(files);

        try {
            for (const file of fileArray) {
                // Compress if image
                let fileToUpload = file;
                if (file.type.startsWith('image/')) {
                    try {
                        fileToUpload = await compressImage(file);
                    } catch (err) {
                        console.error("Error compressing image", err);
                        // Continue with original file if compression fails
                    }
                }

                // Sanitize filename and creating unique path
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const fileName = `${timestamp}_${randomStr}_${sanitizedName}`;

                // Construct full path (e.g. "work-orders/123123_abc_image.png")
                const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

                const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, fileToUpload);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                // Determine type
                let type: 'image' | 'video' | 'pdf' | 'file' = 'file';
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('video/')) type = 'video';
                else if (file.type === 'application/pdf') type = 'pdf';

                uploadedAttachments.push({
                    id: Math.random().toString(36).substring(7),
                    name: file.name,
                    url: data.publicUrl,
                    type: type
                });
            }

            if (uploadedAttachments.length > 0) {
                toast.success(`${uploadedAttachments.length} archivo(s) subido(s) correctamente`);
            }

            return uploadedAttachments;

        } catch (error) {
            console.error('Error uploading files:', error);
            toast.error('Error al subir archivos');
            throw error;
        } finally {
            setIsUploading(false);
        }
    };

    /**
     * Removes a single file from Supabase storage using its public URL.
     */
    const removeFile = async (url: string, bucket: string) => {
        try {
            const path = extractPathFromUrl(url, bucket);
            if (path) {
                const { error } = await supabase.storage.from(bucket).remove([path]);
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error removing file:', error);
            // We usually don't toast on cleanups to avoid noise, 
            // but can log warning
        }
    };

    /**
     * Helper to extract the relative storage path from a full public URL.
     * Useful for cleanup logic.
     */
    const extractPathFromUrl = (url: string, bucket: string): string | null => {
        // Validation: Ensure URL belongs to this bucket
        if (!url.includes(`/${bucket}/`)) return null;

        const parts = url.split(`/${bucket}/`);
        // parts[1] should be the path "folder/filename.ext" or "filename.ext"
        return parts.length > 1 ? parts[1] : null;
    };

    return {
        isUploading,
        uploadFiles,
        removeFile,
        extractPathFromUrl
    };
};
