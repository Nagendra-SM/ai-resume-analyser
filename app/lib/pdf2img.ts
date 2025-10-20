export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    
    // Import the PDF.js library and its worker
    loadPromise = (async () => {
        try {
            // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
            const lib = await import("pdfjs-dist/build/pdf.mjs");
            
            // In development, use the worker from the package
            if (import.meta.env.DEV) {
                const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
                lib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
            } else {
                // In production, use the worker from the public directory
                lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
            }
            
            pdfjsLib = lib;
            isLoading = false;
            return lib;
        } catch (error) {
            console.error('Error loading PDF.js:', error);
            throw error;
        }
    })();

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    console.log('Starting PDF to image conversion...');
    
    try {
        console.log('Loading PDF.js library...');
        const lib = await loadPdfJs();
        console.log('PDF.js library loaded successfully');

        console.log('Reading file as array buffer...');
        const arrayBuffer = await file.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error('File is empty or could not be read');
        }
        console.log(`File read successfully, size: ${arrayBuffer.byteLength} bytes`);

        console.log('Loading PDF document...');
        const pdf = await lib.getDocument({ 
            data: arrayBuffer,
            disableWorker: false,
            isEvalSupported: true,
            useSystemFonts: true
        }).promise;
        
        console.log(`PDF loaded, number of pages: ${pdf.numPages}`);
        
        if (pdf.numPages === 0) {
            throw new Error('PDF has no pages');
        }

        console.log('Getting first page...');
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 4 });
        
        console.log('Creating canvas...');
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        
        if (!context) {
            throw new Error('Could not get 2D context from canvas');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        console.log('Rendering page to canvas...');
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        console.log('Page rendered successfully');

        return new Promise((resolve) => {
            console.log('Converting canvas to blob...');
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        console.error('Failed to create image blob');
                        return resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob: blob is null"
                        });
                    }
                    
                    try {
                        console.log('Blob created, size:', blob.size, 'bytes');
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File(
                            [blob],
                            `${originalName}.png`,
                            { type: "image/png" }
                        );

                        console.log('Conversion completed successfully');
                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } catch (error) {
                        console.error('Error creating File object:', error);
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: `Error creating File object: ${error}`
                        });
                    }
                },
                "image/png",
                0.9 // Slightly reduced quality for better performance
            );
        });
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('PDF conversion error:', errorMessage, err);
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${errorMessage}`,
        };
    }
}
