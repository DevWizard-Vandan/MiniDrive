package com.minidrive.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enable async processing for background tasks like:
 * - Thumbnail generation
 * - Text extraction
 * - Embedding generation
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}
