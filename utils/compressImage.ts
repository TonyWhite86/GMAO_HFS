/**
 * Compresses an image file using the browser's Canvas API.
 * 
 * @param file The original image File object.
 * @param maxWidth The maximum width for the resized image (default: 1920px).
 * @param quality The JPEG compression quality (0 to 1, default: 0.7).
 * @returns A Promise that resolves to a new compressed File object, or the original file if compression fails or isn't needed.
 */
export const compressImage = async (file: File, maxWidth = 1920, quality = 0.7): Promise<File> => {
    // 1. Validate if it's an image
    if (!file.type.startsWith('image/')) {
        return file;
    }

    // 2. Load image
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };

        reader.onerror = (err) => resolve(file); // Fallback to original on error

        img.onload = () => {
            // 3. Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            // 4. Draw to canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }

            // High quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // 5. Export to blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Check if we actually saved space. If new blob is larger, keep original.
                        if (blob.size < file.size) {
                            const newFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(newFile);
                        } else {
                            resolve(file);
                        }
                    } else {
                        resolve(file);
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => resolve(file);

        reader.readAsDataURL(file);
    });
};
