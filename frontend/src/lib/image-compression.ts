export async function compressImage(
    file: File,
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    } else {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to Blob failed"));
                            return;
                        }
                        const newFile = new File([blob], file.name, {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = (err) => reject(new Error("Failed to load image for compression"));
        };
        reader.onerror = (err) => reject(new Error("Failed to read file"));
    });
}
