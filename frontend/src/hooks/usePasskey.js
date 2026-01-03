/**
 * usePasskey - WebAuthn/Passkeys hook for passwordless authentication.
 * 
 * Passkeys are phishing-resistant, biometric-enabled credentials.
 * Private key never leaves the device. Server only stores public key.
 */

import { useState, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

// WebAuthn utilities
const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

export const usePasskey = () => {
    const [loading, setLoading] = useState(false);
    const [isSupported, setIsSupported] = useState(
        typeof window !== 'undefined' &&
        window.PublicKeyCredential !== undefined
    );

    /**
     * Check if the browser supports passkeys.
     */
    const checkSupport = useCallback(async () => {
        if (!window.PublicKeyCredential) {
            return { supported: false, reason: 'WebAuthn not supported' };
        }

        // Check for platform authenticator (Touch ID, Face ID, Windows Hello)
        try {
            const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            return {
                supported: true,
                platformAuthenticator: available,
                reason: available ? 'Full passkey support' : 'Security key only'
            };
        } catch (e) {
            return { supported: true, platformAuthenticator: false };
        }
    }, []);

    /**
     * Register a new passkey for the current user.
     */
    const registerPasskey = useCallback(async (username) => {
        setLoading(true);
        try {
            // 1. Get registration options from server
            const optionsRes = await api.post('/auth/passkey/register-options', { username });
            const options = optionsRes.data;

            // 2. Convert base64 to ArrayBuffer
            const publicKeyOptions = {
                challenge: base64ToArrayBuffer(options.challenge),
                rp: options.rp,
                user: {
                    id: base64ToArrayBuffer(options.user.id),
                    name: options.user.name,
                    displayName: options.user.displayName
                },
                pubKeyCredParams: options.pubKeyCredParams,
                timeout: options.timeout || 60000,
                authenticatorSelection: options.authenticatorSelection || {
                    authenticatorAttachment: 'platform',
                    userVerification: 'preferred',
                    residentKey: 'required'
                },
                attestation: options.attestation || 'none'
            };

            // 3. Create credential (browser prompts user)
            toast.loading('Waiting for device verification...', { id: 'passkey-register' });
            const credential = await navigator.credentials.create({
                publicKey: publicKeyOptions
            });
            toast.dismiss('passkey-register');

            if (!credential) {
                throw new Error('Credential creation cancelled');
            }

            // 4. Send credential to server
            const attestationResponse = {
                id: credential.id,
                rawId: arrayBufferToBase64(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                    attestationObject: arrayBufferToBase64(credential.response.attestationObject)
                }
            };

            const verifyRes = await api.post('/auth/passkey/register-verify', {
                username,
                credential: attestationResponse
            });

            toast.success('Passkey registered successfully!', { icon: '🔐' });
            return { success: true, data: verifyRes.data };

        } catch (error) {
            console.error('Passkey registration error:', error);
            toast.error(error.message || 'Failed to register passkey');
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Authenticate with passkey.
     */
    const loginWithPasskey = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Get authentication options from server
            const optionsRes = await api.post('/auth/passkey/login-options', {});
            const options = optionsRes.data;

            // 2. Convert base64 to ArrayBuffer
            const publicKeyOptions = {
                challenge: base64ToArrayBuffer(options.challenge),
                timeout: options.timeout || 60000,
                rpId: options.rpId,
                userVerification: options.userVerification || 'preferred'
            };

            // Add allowed credentials if specified
            if (options.allowCredentials && options.allowCredentials.length > 0) {
                publicKeyOptions.allowCredentials = options.allowCredentials.map(cred => ({
                    id: base64ToArrayBuffer(cred.id),
                    type: cred.type,
                    transports: cred.transports
                }));
            }

            // 3. Get credential (browser prompts user)
            toast.loading('Waiting for device verification...', { id: 'passkey-login' });
            const credential = await navigator.credentials.get({
                publicKey: publicKeyOptions
            });
            toast.dismiss('passkey-login');

            if (!credential) {
                throw new Error('Authentication cancelled');
            }

            // 4. Send assertion to server
            const assertionResponse = {
                id: credential.id,
                rawId: arrayBufferToBase64(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
                    authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
                    signature: arrayBufferToBase64(credential.response.signature),
                    userHandle: credential.response.userHandle
                        ? arrayBufferToBase64(credential.response.userHandle)
                        : null
                }
            };

            const verifyRes = await api.post('/auth/passkey/login-verify', {
                credential: assertionResponse
            });

            // Store token
            localStorage.setItem('token', verifyRes.data.token);
            localStorage.setItem('username', verifyRes.data.username);

            toast.success('Welcome back!', { icon: '👋' });
            return { success: true, data: verifyRes.data };

        } catch (error) {
            console.error('Passkey login error:', error);
            toast.error(error.message || 'Failed to authenticate');
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        isSupported,
        loading,
        checkSupport,
        registerPasskey,
        loginWithPasskey
    };
};

export default usePasskey;
