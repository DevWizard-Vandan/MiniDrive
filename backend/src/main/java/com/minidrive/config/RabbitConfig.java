package com.minidrive.config;

import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {
	@Bean
	public Queue fileQueue() {
		// This creates the queue in RabbitMQ automatically if it doesn't exist
		return new Queue("file-processing-queue", true);
	}
}