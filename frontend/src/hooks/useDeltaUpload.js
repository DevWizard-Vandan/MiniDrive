import { useState, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
    computeFileSignature,
    computeDelta,
    isDeltaWorthwhile,
    createDeltaFormData,
    BLOCK_SIZE
} from '../utils/DeltaSync';
import { calculateHash } from '../utils/helpers';

/**
 * Hook for smart delta uploads.
 * 
 * Automatically detects if a file is an update to an existing file
 * and uses delta sync to upload only changed blocks.
 */
export const useDeltaUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [deltaStats, setDeltaStats] = useState(null);

    /**
     * Smart upload that automatically uses delta sync when beneficial.
     * 
     * @param {File} file - File to upload
     * @param {string} existingFileId - ID of existing file (for updates)
     * @param {string} folderId - Target folder
     */
    const smartUpload = useCallback(async (file, existingFileId = null, folderId = null) => {
        setUploading(true);
        setProgress(0);
        setDeltaStats(null);

        try {
            // If this is an update to existing file, try delta sync
            if (existingFileId) {
                const result = await attemptDeltaUpload(file, existingFileId);
                if (result.success) {
                    setDeltaStats(result.stats);
                    toast.success(
                        `Delta sync: ${result.stats.savingsPercent}% bandwidth saved!`,
                        { icon: '⚡', duration: 4000 }
                    );
                    return result;
                }
                // Fall through to full upload if delta not worthwhile
            }

            // Full upload (no delta or delta not beneficial)
            return await fullUpload(file, folderId);

        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Upload failed');
            throw error;
        } finally {
            setUploading(false);
            setProgress(0);
        }
    }, []);

    /**
     * Attempt delta upload for file update.
     */
    const attemptDeltaUpload = async (file, existingFileId) => {
        setProgress(5);

        // 1. Get server signature for existing file
        let serverSignature;
        try {
            const sigRes = await api.get(`/drive/signature/${existingFileId}`);
            serverSignature = sigRes.data;
        } catch (e) {
            console.log('Server signature not available, falling back to full upload');
            return { success: false };
        }

        setProgress(15);

        // 2. Compute local signature and delta
        toast.loading('Computing delta...', { id: 'delta-compute' });
        const deltaResult = await computeDelta(file, serverSignature);
        toast.dismiss('delta-compute');

        setProgress(25);

        // 3. Check if delta is worthwhile (>20% savings)
        if (!isDeltaWorthwhile(deltaResult, 20)) {
            console.log(`Delta not worthwhile: only ${deltaResult.stats.savingsPercent}% savings`);
            return { success: false };
        }

        // 4. Upload delta
        setProgress(30);
        const formData = await createDeltaFormData(existingFileId, deltaResult);
        formData.append('filename', file.name);
        formData.append('totalSize', file.size);

        await api.post('/drive/delta-upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => {
                const percent = Math.round(30 + (e.loaded / e.total) * 70);
                setProgress(percent);
            }
        });

        return {
            success: true,
            stats: deltaResult.stats,
            fileId: existingFileId
        };
    };

    /**
     * Full upload (original chunked upload).
     */
    const fullUpload = async (file, folderId) => {
        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Initialize upload
        const formData = new FormData();
        formData.append('filename', file.name);
        formData.append('size', file.size);
        if (folderId) formData.append('folderId', folderId);

        const initRes = await api.post('/drive/init', formData);
        const uploadId = initRes.data;

        // Upload chunks
        for (let i = 0; i < totalChunks; i++) {
            const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
            const hash = await calculateHash(chunk);

            const chunkData = new FormData();
            chunkData.append('uploadId', uploadId);
            chunkData.append('index', i);
            chunkData.append('hash', hash);
            chunkData.append('chunk', chunk);

            await api.post('/drive/upload/chunk', chunkData);
            setProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        // Complete upload
        const completeRes = await api.post(`/drive/complete?uploadId=${uploadId}`);
        toast.success(`Uploaded ${file.name}`);

        return {
            success: true,
            fileId: completeRes.data,
            stats: { savingsPercent: 0, deltaSize: file.size, originalSize: file.size }
        };
    };

    /**
     * Check if a file already exists (for delta detection).
     */
    const checkFileExists = useCallback(async (filename, folderId = null) => {
        try {
            const res = await api.get('/drive/content', {
                params: { folderId: folderId || 'root' }
            });
            const existingFile = res.data.files?.find(f => f.name === filename);
            return existingFile?.file_id || null;
        } catch (e) {
            return null;
        }
    }, []);

    return {
        smartUpload,
        checkFileExists,
        uploading,
        progress,
        deltaStats
    };
};

export default useDeltaUpload;
