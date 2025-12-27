package com.minidrive.worker;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class FileProcessor {

	@RabbitListener(queues = "file-processing-queue")
	public void processFile(String message) {
		// This runs in the background!
		System.out.println("🤖 WORKER: Received Task -> " + message);

		try {
			// SIMULATING HEAVY WORK (e.g., Virus Scan, Video Transcoding)
			System.out.println("   [..] Scanning for viruses...");
			Thread.sleep(2000);

			System.out.println("   [..] Generating thumbnails...");
			Thread.sleep(2000);

			System.out.println("✅ WORKER: Processing complete. File is safe.");

		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}
}