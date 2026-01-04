import { useState, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
    encryptFile,
    decryptFile,
    getVaultPassword,
    setVaultPassword
} from '../utils/VaultCrypto';

/**
 * Hook for uploading files to the vault with client-side encryption.
 * 
 * Files are encrypted in the browser using AES-256-GCM before upload.
 * The server never sees the plaintext or encryption key.
 */
export const useVaultUpload = (onComplete = null) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
    const [pendingFiles, setPendingFiles] = useState(null);

    /**
     * Upload files to the vault with client-side encryption.
     * Prompts for vault password if not set.
     */
    const uploadToVault = useCallback(async (files, currentFolder = null) => {
        let vaultPassword = getVaultPassword();

        // If no password set, need to prompt user
        if (!vaultPassword) {
            setPendingFiles(files);
            setPasswordPromptOpen(true);
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProgress(Math.round((i / files.length) * 50));

                // Encrypt file in browser
                toast.loading(`Encrypting ${file.name}...`, { id: 'vault-encrypt' });
                const { encryptedBlob, originalName, originalType } = await encryptFile(file, vaultPassword);
                toast.dismiss('vault-encrypt');

                // Upload encrypted file
                const formData = new FormData();
                formData.append('filename', originalName + '.vault'); // Mark as vault file
                formData.append('size', encryptedBlob.size);
                formData.append('isVault', 'true');
                formData.append('originalType', originalType);
                if (currentFolder) formData.append('folderId', currentFolder);

                // Initialize upload
                const initRes = await api.post('/drive/init', formData);
                const uploadId = initRes.data;

                // Upload as single chunk (encrypted files are typically smaller)
                const CHUNK_SIZE = 1024 * 1024;
                const totalChunks = Math.ceil(encryptedBlob.size / CHUNK_SIZE);

                for (let j = 0; j < totalChunks; j++) {
                    const start = j * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, encryptedBlob.size);
                    const chunk = encryptedBlob.slice(start, end);

                    // Calculate hash of encrypted chunk
                    const hashBuffer = await crypto.subtle.digest('SHA-256', await chunk.arrayBuffer());
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    const chunkData = new FormData();
                    chunkData.append('uploadId', uploadId);
                    chunkData.append('index', j);
                    chunkData.append('hash', hash);
                    chunkData.append('chunk', chunk);

                    await api.post('/drive/upload/chunk', chunkData);
                    setProgress(Math.round(50 + ((j + 1) / totalChunks) * 25 + (i / files.length) * 25));
                }

                // Complete upload and get file ID
                const completeRes = await api.post(`/drive/complete?uploadId=${uploadId}`);
                const fileId = completeRes.data?.fileId || completeRes.data;

                // Mark the file as vault file in backend
                if (fileId) {
                    try {
                        await api.post('/drive/action/vault', {
                            id: fileId,
                            type: 'file',
                            value: true
                        });
                    } catch (vaultErr) {
                        console.warn('Could not mark file as vault:', vaultErr);
                    }
                }

                toast.success(`Vault: Encrypted & uploaded ${file.name}`, { icon: '🔐' });
            }

            // Refresh content after upload
            if (onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error('Vault upload error:', error);
            toast.error('Failed to upload to vault');
        } finally {
            setUploading(false);
            setProgress(0);
        }
    }, [onComplete]);

    /**
     * Continue upload after password is provided.
     */
    const onPasswordSubmit = useCallback((password) => {
        setVaultPassword(password);
        setPasswordPromptOpen(false);
        if (pendingFiles) {
            uploadToVault(pendingFiles);
            setPendingFiles(null);
        }
    }, [pendingFiles, uploadToVault]);

    /**
     * Download and decrypt a vault file.
     */
    const downloadFromVault = useCallback(async (item) => {
        let vaultPassword = getVaultPassword();

        if (!vaultPassword) {
            // Prompt for password
            const password = prompt('Enter vault password to decrypt file:');
            if (!password) return;
            vaultPassword = password;
        }

        try {
            toast.loading('Downloading...', { id: 'vault-download' });
            const res = await api.get(`/drive/download/${item.name}`, { responseType: 'blob' });

            toast.loading('Decrypting...', { id: 'vault-download' });
            const decryptedBlob = await decryptFile(res.data, vaultPassword);

            // Remove .vault extension for download
            const originalName = item.name.replace('.vault', '');

            const url = window.URL.createObjectURL(decryptedBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = originalName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Decrypted & downloaded', { id: 'vault-download', icon: '🔓' });
        } catch (error) {
            console.error('Vault download error:', error);
            toast.error('Failed to decrypt. Check your vault password.', { id: 'vault-download' });
        }
    }, []);

    return {
        uploadToVault,
        downloadFromVault,
        uploading,
        progress,
        passwordPromptOpen,
        setPasswordPromptOpen,
        onPasswordSubmit,
        cancelPasswordPrompt: () => {
            setPasswordPromptOpen(false);
            setPendingFiles(null);
        }
    };
};

export default useVaultUpload;
