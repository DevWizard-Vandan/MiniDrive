/**
 * VaultCrypto - Client-side encryption utilities using WebCrypto API.
 * 
 * This implements true Zero-Knowledge encryption:
 * - Keys are derived from user password using PBKDF2
 * - Encryption/decryption happens entirely in the browser
 * - Server never sees the plaintext or encryption keys
 * 
 * Algorithm: AES-256-GCM
 * Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
 */

// Configuration
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12;   // 96 bits (recommended for GCM)
const KEY_LENGTH = 256; // AES-256

/**
 * Generate a random salt for key derivation.
 * Should be stored alongside the encrypted data.
 */
export const generateSalt = () => {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
};

/**
 * Derive an AES-256 key from a password using PBKDF2.
 * 
 * @param {string} password - User's password
 * @param {Uint8Array} salt - Random salt (store this!)
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
export const deriveVaultKey = async (password, salt) => {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // Derive AES-GCM key
    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt a file (ArrayBuffer) using AES-256-GCM.
 * 
 * @param {ArrayBuffer} data - File content to encrypt
 * @param {CryptoKey} key - Derived AES-GCM key
 * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array, salt: Uint8Array}>}
 */
export const encryptData = async (data, key, salt) => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );

    return { encrypted, iv, salt };
};

/**
 * Decrypt data using AES-256-GCM.
 * 
 * @param {ArrayBuffer} encryptedData - Encrypted content
 * @param {CryptoKey} key - Derived AES-GCM key
 * @param {Uint8Array} iv - Initialization vector used during encryption
 * @returns {Promise<ArrayBuffer>} Decrypted content
 */
export const decryptData = async (encryptedData, key, iv) => {
    return await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
    );
};

/**
 * Encrypt a File object for vault upload.
 * Returns the encrypted blob with IV and salt prepended.
 * 
 * Format: [salt (16 bytes)][iv (12 bytes)][encrypted data]
 * 
 * @param {File} file - File to encrypt
 * @param {string} password - Vault password
 * @returns {Promise<{encryptedBlob: Blob, salt: Uint8Array}>}
 */
export const encryptFile = async (file, password) => {
    const salt = generateSalt();
    const key = await deriveVaultKey(password, salt);

    const fileData = await file.arrayBuffer();
    const { encrypted, iv } = await encryptData(fileData, key, salt);

    // Combine: salt + iv + encrypted data
    const combined = new Uint8Array(
        SALT_LENGTH + IV_LENGTH + encrypted.byteLength
    );
    combined.set(salt, 0);
    combined.set(iv, SALT_LENGTH);
    combined.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

    return {
        encryptedBlob: new Blob([combined], { type: 'application/octet-stream' }),
        salt: salt,
        originalType: file.type,
        originalName: file.name
    };
};

/**
 * Decrypt a vault file blob.
 * 
 * @param {Blob} encryptedBlob - Encrypted file with prepended salt and IV
 * @param {string} password - Vault password
 * @returns {Promise<Blob>} Decrypted file
 */
export const decryptFile = async (encryptedBlob, password) => {
    const data = await encryptedBlob.arrayBuffer();
    const dataArray = new Uint8Array(data);

    // Extract salt, iv, and encrypted content
    const salt = dataArray.slice(0, SALT_LENGTH);
    const iv = dataArray.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encryptedData = dataArray.slice(SALT_LENGTH + IV_LENGTH);

    // Derive key from password
    const key = await deriveVaultKey(password, salt);

    // Decrypt
    const decrypted = await decryptData(encryptedData.buffer, key, iv);

    return new Blob([decrypted]);
};

/**
 * Convert Uint8Array to Base64 string for storage.
 */
export const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

/**
 * Convert Base64 string back to Uint8Array.
 */
export const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

/**
 * Get or create vault password from session storage.
 * In a real app, this would be more secure (e.g., derived from login).
 */
export const getVaultPassword = () => {
    return sessionStorage.getItem('vaultPassword');
};

export const setVaultPassword = (password) => {
    sessionStorage.setItem('vaultPassword', password);
};

export const clearVaultPassword = () => {
    sessionStorage.removeItem('vaultPassword');
};

export default {
    generateSalt,
    deriveVaultKey,
    encryptData,
    decryptData,
    encryptFile,
    decryptFile,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    getVaultPassword,
    setVaultPassword,
    clearVaultPassword
};
