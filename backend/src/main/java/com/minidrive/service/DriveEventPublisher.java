package com.minidrive.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service for publishing drive events via WebSocket.
 * Enables real-time sync across all user devices.
 */
@Service
public class DriveEventPublisher {

    private static final Logger logger = LoggerFactory.getLogger(DriveEventPublisher.class);

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Publish file uploaded event.
     * Clients subscribed to /topic/drive/{username} will receive this.
     */
    public void publishFileUploaded(String username, String fileId, String fileName, long size, String folderId) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "FILE_UPLOADED");
        event.put("fileId", fileId);
        event.put("fileName", fileName);
        event.put("size", size);
        event.put("folderId", folderId);
        event.put("timestamp", System.currentTimeMillis());
        
        sendToUser(username, event);
    }

    /**
     * Publish file deleted event.
     */
    public void publishFileDeleted(String username, String fileId, String fileName, boolean permanent) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", permanent ? "FILE_PERMANENTLY_DELETED" : "FILE_TRASHED");
        event.put("fileId", fileId);
        event.put("fileName", fileName);
        event.put("timestamp", System.currentTimeMillis());
        
        sendToUser(username, event);
    }

    /**
     * Publish folder created event.
     */
    public void publishFolderCreated(String username, String folderId, String folderName, String parentId) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "FOLDER_CREATED");
        event.put("folderId", folderId);
        event.put("folderName", folderName);
        event.put("parentId", parentId);
        event.put("timestamp", System.currentTimeMillis());
        
        sendToUser(username, event);
    }

    /**
     * Publish file restored from trash event.
     */
    public void publishFileRestored(String username, String fileId, String fileName) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "FILE_RESTORED");
        event.put("fileId", fileId);
        event.put("fileName", fileName);
        event.put("timestamp", System.currentTimeMillis());
        
        sendToUser(username, event);
    }

    /**
     * Publish file starred/unstarred event.
     */
    public void publishStarChanged(String username, String itemId, String itemType, boolean starred) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "STAR_CHANGED");
        event.put("itemId", itemId);
        event.put("itemType", itemType);
        event.put("starred", starred);
        event.put("timestamp", System.currentTimeMillis());
        
        sendToUser(username, event);
    }

    /**
     * Publish file version created event.
     */
    public void publishVersionCreated(String username, String fileId, String fileName, int versionNumber) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", "VERSION_CREATED");
        event.put("fileId", fileId);
        event.put("fileName", fileName);
        event.put("versionNumber", versionNumber);
        event.put("timestamp", System.currentTimeMillis());
        
        sendToUser(username, event);
    }

    private void sendToUser(String username, Map<String, Object> event) {
        if (messagingTemplate == null) {
            logger.debug("WebSocket messaging not available, skipping event: {}", event.get("type"));
            return;
        }
        
        String destination = "/topic/drive/" + username;
        logger.info("Publishing event {} to {}", event.get("type"), destination);
        messagingTemplate.convertAndSend(destination, event);
    }
}
